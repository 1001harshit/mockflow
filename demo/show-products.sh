#!/bin/zsh
source ${0:A:h}/.session
curl -s $MOCK/products | python3 ${0:A:h}/_table.py
