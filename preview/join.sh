#!/bin/sh
cd "$(dirname "$0")"
cat app.part* > app.html
echo "Built app.html — open it in Chrome"
