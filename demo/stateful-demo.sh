#!/bin/zsh
# Stateful scene: flip the endpoints to stateful, POST two real records,
# then show GET returning them, plus search and sort.
source ${0:A:h}/.session
HERE=${0:A:h}
D=$'\e[90m'; X=$'\e[0m'

# Flip every endpoint to stateful so GET/POST/DELETE all hit the store.
for E in $(curl -s $API/api/projects/$PID/endpoints -H "$AUTH" \
            | python3 -c 'import sys,json;[print(e["id"]) for e in json.load(sys.stdin)]'); do
  curl -s -X PATCH $API/api/projects/$PID/endpoints/$E -H "$AUTH" \
    -H 'content-type: application/json' -d '{"stateful":true,"failureRules":[]}' >/dev/null
done

# Purge anything left from a previous take, so the scene is re-runnable.
for ID in $(curl -s $MOCK/products | python3 -c 'import sys,json;[print(r["id"]) for r in json.load(sys.stdin) if r.get("id")]' 2>/dev/null); do
  curl -s -X DELETE $MOCK/products/$ID >/dev/null
done

echo "${D}/products is now stateful, and empty${X}\n"

post() {
  curl -s -X POST $MOCK/products -H 'content-type: application/json' -d "$1" >/dev/null
  echo "  ${D}POST /products${X}  $1"
}
post '{"productName":"Hand-made Kettle","category":"Home & Kitchen","subcategory":"Cookware","brand":"Hawkins","price":1999,"stock":12}'
post '{"productName":"Cast Iron Pan","category":"Home & Kitchen","subcategory":"Cookware","brand":"Prestige","price":2499,"stock":40}'
post '{"productName":"Espresso Grinder","category":"Home & Kitchen","subcategory":"Small Appliances","brand":"Bosch","price":8499,"stock":7}'

echo "\n${D}GET /products — returns exactly what was posted${X}"
curl -s $MOCK/products | python3 $HERE/_table.py

echo "\n${D}GET /products?q=pan${X}"
curl -s "$MOCK/products?q=pan" | python3 $HERE/_table.py

echo "\n${D}GET /products?_sort=price&_order=desc${X}"
curl -s "$MOCK/products?_sort=price&_order=desc" | python3 $HERE/_table.py
