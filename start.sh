#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Nu gasesc node_modules, instalez dependintele..."
  npm install
fi

echo "Pornesc CrissCall pe http://localhost:3000 ..."
node server.js &
SERVER_PID=$!

sleep 3
if command -v open > /dev/null; then
  open http://localhost:3000
elif command -v xdg-open > /dev/null; then
  xdg-open http://localhost:3000
fi

wait $SERVER_PID
