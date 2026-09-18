#!/bin/zsh
# Point the demo scripts at a project you created in the dashboard, so the
# terminal and the browser show the same thing during a recording.
#
#   source demo/adopt.sh                 # pick a project interactively
#   source demo/adopt.sh <projectId>     # use this one
#
# Credentials are prompted for, never stored. Set MOCKFLOW_EMAIL /
# MOCKFLOW_PASSWORD to skip the prompts.
export API=${API:-http://localhost:4000}
HERE=${${(%):-%x}:A:h}

EMAIL=${MOCKFLOW_EMAIL}
[[ -z $EMAIL ]] && { print -n "dashboard email: "; read EMAIL; }
PASSWORD=${MOCKFLOW_PASSWORD}
[[ -z $PASSWORD ]] && { print -n "password: "; read -s PASSWORD; echo; }

export TOKEN=$(curl -s -X POST $API/api/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("accessToken",""))')
if [[ -z $TOKEN ]]; then print "login failed — check the email and password"; return 1 2>/dev/null || exit 1; fi
export AUTH="authorization: Bearer $TOKEN"

WS=$(curl -s $API/api/workspaces -H "$AUTH" | python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')

if [[ -n $1 ]]; then
  export PID=$1
else
  echo "\nyour projects:"
  curl -s $API/api/workspaces/$WS/projects -H "$AUTH" \
    | python3 -c 'import sys,json;[print("  {}  {}".format(p["id"],p["name"])) for p in json.load(sys.stdin)]'
  print -n "\nproject id: "; read PID; export PID
fi

export MOCK="$API/mock/$PID"
eps=$(curl -s $API/api/projects/$PID/endpoints -H "$AUTH")
pick() { echo $eps | python3 -c "
import sys,json
m=[e['id'] for e in json.load(sys.stdin) if e['method']=='$1' and e['path']=='$2']
print(m[0] if m else '')"; }
export GET_PRODUCTS=$(pick GET /products)
export POST_PRODUCTS=$(pick POST /products)
export GET_ORDERS=$(pick GET /orders)
# If this project has no /products, fall back to its first endpoint so the
# generate and chaos scenes still have something to aim at.
if [[ -z $GET_PRODUCTS ]]; then
  export GET_PRODUCTS=$(echo $eps | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["id"] if d else "")')
  FIRST_PATH=$(echo $eps | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[0]["path"] if d else "")')
  echo "\nnote: no /products here — scenes will target $FIRST_PATH"
fi

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

echo "\nnow pointed at $PID"
echo "  mock base : $MOCK"
echo "  dashboard : http://localhost:3000/projects/$PID"
curl -s $API/api/projects/$PID/endpoints -H "$AUTH" \
  | python3 -c 'import sys,json;[print("  {:7} {}".format(e["method"],e["path"])) for e in json.load(sys.stdin)]'
