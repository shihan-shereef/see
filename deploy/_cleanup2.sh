#!/usr/bin/env bash
echo "=== stray 708449 + parent 708424 ==="
ps -o pid,ppid,rss,etime,args -p 708449 2>/dev/null
ps -o pid,ppid,rss,etime,args -p 708424 2>/dev/null
echo "=== listening sockets for those pids ==="
ss -ltnp 2>/dev/null | grep -E "708449|708424" || echo "(none listening)"
echo "=== kill stray next-server (and its leftover parent if not systemd/init) ==="
kill 708449 2>/dev/null && echo "killed 708449"
ppid=$(ps -o ppid= -p 708424 2>/dev/null | tr -d ' ')
pcmd=$(ps -o args= -p 708424 2>/dev/null)
echo "708424 parent=$ppid cmd=$pcmd"
case "$pcmd" in
  *bash*|*sh*|*npm*|*bun*|*node*) kill 708424 2>/dev/null && echo "killed leftover parent 708424" ;;
  *) echo "left parent 708424 alone (not an obvious leftover shell)" ;;
esac
sleep 2
echo "=== remaining next-server procs ==="
ps -eo pid,rss,args | grep -F "next-server" | grep -v grep
echo ""
echo "=== NEW BASELINE: memory ==="; free -h
echo "=== app still serving? ==="; systemctl is-active myos-app; curl -s -o /dev/null -w "app /en/login: %{http_code}\n" http://localhost:3000/en/login
echo CLEANUP_DONE
