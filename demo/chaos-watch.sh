#!/bin/zsh
# Fires requests at the mock and prints each status in colour.
# The visual centrepiece: green 200s, red failures, live.
#   ./chaos-watch.sh [count] [delay-seconds]
source ${0:A:h}/.session
N=${1:-40}; DELAY=${2:-0.12}
G=$'\e[32m'; R=$'\e[31m'; Y=$'\e[33m'; D=$'\e[90m'; X=$'\e[0m'

printf "%s→ GET %s/products  (%s requests)%s\n\n" "$D" "$MOCK" "$N" "$X"
for i in $(seq 1 $N); do
  read -r code ms <<< "$(curl -s -o /dev/null -w '%{http_code} %{time_total}' $MOCK/products)"
  msf=$(printf "%.0f" $((ms * 1000)))
  case $code in
    200) c=$G; tag="ok" ;;
    503) c=$R; tag="db down" ;;
    500|502) c=$R; tag="error" ;;
    504) c=$Y; tag="timeout" ;;
    000) c=$R; tag="connection dropped" ;;
    *)   c=$Y; tag="" ;;
  esac
  slow=""; [[ $msf -gt 150 ]] && slow=" ${Y}(slow)${X}"
  printf "  %s%s%s  %5sms  %s%s\n" "$c" "$code" "$X" "$msf" "$tag" "$slow"
  sleep $DELAY
done
