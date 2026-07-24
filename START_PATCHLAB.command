#!/bin/bash
cd "$(dirname "$0")"
PORT=8081
while lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT+1))
done
echo "Starting PATCHLAB at http://localhost:$PORT"
python3 -m http.server "$PORT" &
SERVER_PID=$!
sleep 1
open "http://localhost:$PORT"
wait $SERVER_PID
