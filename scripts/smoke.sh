#!/bin/zsh
# End-to-end walkthrough of every MockFlow feature against a running API.
# Usage:  API must be on :4000 and Postgres up (pnpm db:up).
set -e
API=${API:-http://localhost:4000}
EMAIL="demo$(date +%s)@mockflow.test"; PASS="Passw0rd!23"
j() { python3 -c "import sys,json;d=json.load(sys.stdin);print($1)"; }

echo "== 1. health =="
curl -s $API/health; echo

echo "\n== 2. register + login =="
curl -s -X POST $API/api/auth/register -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" >/dev/null
TOKEN=$(curl -s -X POST $API/api/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | j 'd["accessToken"]')
AUTH="authorization: Bearer $TOKEN"
echo "logged in as $EMAIL"

WS=$(curl -s $API/api/workspaces -H "$AUTH" | j 'd[0]["id"]')
PID=$(curl -s -X POST $API/api/workspaces/$WS/projects -H "$AUTH" \
  -H 'content-type: application/json' -d '{"name":"Demo"}' | j 'd["id"]')
echo "project $PID"

echo "\n== 3. import an OpenAPI spec =="
python3 - <<'PY' > /tmp/mockflow-demo-spec.json
import json
item={"type":"object","properties":{
 "id":{"type":"string","format":"uuid"},"productName":{"type":"string"},
 "category":{"type":"string"},"subcategory":{"type":"string"},"brand":{"type":"string"},
 "price":{"type":"number"},"stock":{"type":"integer"},
 "rating":{"type":"number","minimum":1,"maximum":5}}}
ok200={"description":"ok","content":{"application/json":{"schema":{"type":"array","items":item}}}}
created={"description":"created","content":{"application/json":{"schema":item}}}
print(json.dumps({"openapi":"3.0.0","info":{"title":"Demo API","version":"1.0.0"},
 "paths":{"/products":{"get":{"responses":{"200":ok200}},
                       "post":{"responses":{"201":created}}}}}))
PY
curl -s -X POST $API/api/projects/$PID/import -H "$AUTH" \
  -H 'content-type: application/json' -d @/tmp/mockflow-demo-spec.json; echo
EID=$(curl -s $API/api/projects/$PID/endpoints -H "$AUTH" | j '[e["id"] for e in d if e["method"]=="GET"][0]')
POST_EID=$(curl -s $API/api/projects/$PID/endpoints -H "$AUTH" | j '[e["id"] for e in d if e["method"]=="POST"][0]')

echo "\n== 4. the mock is live (schema-generated placeholder body) =="
curl -s $API/mock/$PID/products; echo

echo "\n== 5. fill it with realistic data =="
curl -s -X POST $API/api/projects/$PID/ai/endpoints/$EID/generate -H "$AUTH" \
  -H 'content-type: application/json' -d '{"count":3,"save":true}' \
  | python3 -c '
import sys,json
d=json.load(sys.stdin); print("source:",d["source"])
for p in d["data"]:
    print("  {:14} {:12} {:11} {:34} price={:>9}".format(
        p["category"],p["subcategory"],p["brand"],p["productName"],p["price"]))'

echo "\n== 6. failure simulation: 50% errors, 20% slow =="
curl -s -X PATCH $API/api/projects/$PID/endpoints/$EID -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{"failureRules":[{"type":"error","percent":50,"statusCode":503},{"type":"slow","percent":20,"delayMs":200}]}' >/dev/null
echo -n "  20 requests: "
for i in $(seq 1 20); do curl -s -o /dev/null -w "%{http_code} " $API/mock/$PID/products; done; echo

echo "\n  validation — rules totalling >100% are rejected:"
curl -s -X PATCH $API/api/projects/$PID/endpoints/$EID -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{"failureRules":[{"type":"error","percent":70},{"type":"slow","percent":50}]}' | j 'd["message"]'

echo "\n== 7. stats separate injected chaos from real errors =="
curl -s $API/api/projects/$PID/stats -H "$AUTH" | python3 -c '
import sys,json;d=json.load(sys.stdin)
print("  requests:",d["totalRequests"],"| errorRate:",d["errorRate"],
      "| injected:",d["injectedFailures"]["rate"],d["injectedFailures"]["byType"])'

curl -s -X PATCH $API/api/projects/$PID/endpoints/$EID -H "$AUTH" \
  -H 'content-type: application/json' -d '{"failureRules":[]}' >/dev/null

echo "\n== 8. suggested validation rules + test cases =="
curl -s -X POST $API/api/projects/$PID/ai/endpoints/$EID/suggest -H "$AUTH" | python3 -c '
import sys,json;d=json.load(sys.stdin)
print("  examples:",[e["name"] for e in d["examples"]])
print("  rules:",len(d["validationRules"]),"| test cases:")
for t in d["testCases"]: print("    [{}] {}".format(t["expectStatus"],t["name"]))'

echo "\n== 9. stateful mode: POST then GET returns what you posted =="
for E in $EID $POST_EID; do
  curl -s -X PATCH $API/api/projects/$PID/endpoints/$E -H "$AUTH" \
    -H 'content-type: application/json' -d '{"stateful":true}' >/dev/null
done
curl -s -X POST $API/mock/$PID/products -H 'content-type: application/json' \
  -d '{"productName":"Hand-made Kettle","price":1999}' >/dev/null
curl -s -X POST $API/mock/$PID/products -H 'content-type: application/json' \
  -d '{"productName":"Cast Iron Pan","price":2499}' >/dev/null
echo "  after two POSTs, GET /products returns:"
curl -s "$API/mock/$PID/products" | python3 -c '
import sys,json
for r in json.load(sys.stdin): print("    {:20} {}".format(r["productName"],r["price"]))'
echo "  search (?q=pan) and sort (?_sort=price&_order=desc):"
curl -s "$API/mock/$PID/products?q=pan" | j '"    q=pan -> "+str([r["productName"] for r in d])'
curl -s "$API/mock/$PID/products?_sort=price&_order=desc" | j '"    sorted -> "+str([r["price"] for r in d])'

echo "\n== 10. webhooks: signed like the real provider =="
W=$(curl -s -X POST $API/api/projects/$PID/webhooks -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"Payments","provider":"stripe","targetUrl":"http://127.0.0.1:4999/hook"}')
echo "  created: $(echo $W | j '"provider="+d["provider"]+"  header="+d["signatureHeader"]')"
echo "  sample razorpay payload:"
curl -s "$API/api/projects/$PID/webhooks/providers/razorpay/sample?event=payment.captured" -H "$AUTH" \
  | python3 -c 'import sys,json;print("   ",json.dumps(json.load(sys.stdin)["payload"]["payload"]["payment"]["entity"])[:120])'

echo "\n== 11. request log shows which rule fired =="
curl -s "$API/api/projects/$PID/logs?limit=5" -H "$AUTH" | python3 -c '
import sys,json
for l in json.load(sys.stdin): print("  {:4} {:>5}ms  {}".format(l["statusCode"],l["latencyMs"],l["failureType"] or ""))'

echo "\nDone. Project id: $PID"
