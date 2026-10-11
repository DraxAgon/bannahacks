#!/usr/bin/env bash
# Restart the production server on :3000 in the background (dev helper).
pkill -f '^next-server' >/dev/null 2>&1 || true
sleep 1
cd "$(dirname "$0")/.." && PORT=3000 nohup npx next start > /tmp/next-server.log 2>&1 &
for i in $(seq 1 30); do curl -s -o /dev/null http://localhost:3000/api/health && exit 0; sleep 0.5; done
echo "server did not start"; tail -20 /tmp/next-server.log; exit 1
