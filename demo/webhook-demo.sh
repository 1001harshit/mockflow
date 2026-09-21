#!/bin/zsh
# Webhook scene: starts a receiver, registers a Stripe webhook, fires a
# delivery that fails twice and succeeds on the third attempt.
source ${0:A:h}/.session
API=${API:-http://localhost:4000}
HERE=${0:A:h}
D=$'\e[90m'; X=$'\e[0m'

W=$(curl -s -X POST $API/api/projects/$PID/webhooks -H "$AUTH" -H 'content-type: application/json' \
  -d '{"name":"Payments","provider":"stripe","targetUrl":"http://127.0.0.1:4999/hook"}')
WID=$(echo $W | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
SEC=$(echo $W | python3 -c 'import sys,json;print(json.load(sys.stdin)["secret"])')

echo "${D}registered webhook — secret ${SEC:0:22}…${X}\n"
python3 $HERE/receiver.py "$SEC" 2 &
RPID=$!
curl -s -o /dev/null --retry 20 --retry-delay 1 --retry-connrefused http://127.0.0.1:4999/ 2>/dev/null

echo "${D}firing payment_intent.succeeded …${X}\n"
curl -s -X POST $API/api/projects/$PID/webhooks/$WID/send -H "$AUTH" \
  -H 'content-type: application/json' \
  -d '{"event":"payment_intent.succeeded","maxAttempts":4}' | python3 -c '
import sys,json
d=json.load(sys.stdin)
G,R,X="\033[32m","\033[31m","\033[0m"
print()
for a in d["attempts"]:
    c=G if a["success"] else R
    print("  attempt {}  ->  {}{}{}".format(a["attempt"],c,a["statusCode"],X))
print("\n  delivered:", (G+"yes"+X) if d["delivered"] else (R+"no"+X))'
kill $RPID 2>/dev/null
