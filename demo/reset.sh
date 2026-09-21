#!/bin/zsh
# Puts MockFlow into a clean, identical starting state for a demo take.
# Leaves the project freshly imported (placeholder bodies) so the
# "before -> after" generation scene works. Run before every take.
#
#   source demo/reset.sh     <- source it, so $PID/$TOKEN land in your shell
set -e
export API=${API:-http://localhost:4000}
HERE=${0:A:h}

EMAIL="demo@storefront.test"; PASS="Passw0rd!23"
curl -s -X POST $API/api/auth/register -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" >/dev/null 2>&1 || true

export TOKEN=$(curl -s -X POST $API/api/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
export AUTH="authorization: Bearer $TOKEN"

WS=$(curl -s $API/api/workspaces -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')
export PID=$(curl -s -X POST $API/api/workspaces/$WS/projects -H "$AUTH" \
  -H 'content-type: application/json' -d "{\"name\":\"Storefront\"}" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')

curl -s -X POST $API/api/projects/$PID/import -H "$AUTH" \
  -H 'content-type: application/json' -d @$HERE/spec.json >/dev/null

eps=$(curl -s $API/api/projects/$PID/endpoints -H "$AUTH")
pick() { echo $eps | python3 -c "import sys,json;print([e['id'] for e in json.load(sys.stdin) if e['method']=='$1' and e['path']=='$2'][0])"; }
export GET_PRODUCTS=$(pick GET /products)
export POST_PRODUCTS=$(pick POST /products)
export GET_ORDERS=$(pick GET /orders)
export MOCK="$API/mock/$PID"

cat > $HERE/.session <<ENV
export API="$API"
export TOKEN="$TOKEN"
export AUTH="authorization: Bearer $TOKEN"
export PID="$PID"
export MOCK="$MOCK"
export GET_PRODUCTS="$GET_PRODUCTS"
export POST_PRODUCTS="$POST_PRODUCTS"
export GET_ORDERS="$GET_ORDERS"
ENV

echo "Ready. 6 endpoints imported, nothing generated yet."
echo "  mock base : $MOCK"
echo "  dashboard : http://localhost:3000/projects/$PID"
