#!/usr/bin/env bash
echo "=== myos-app (systemd MainPID 2087095) + children ==="
ps -o pid,ppid,rss,args -p 2087095 2>/dev/null
for p in $(pgrep -P 2087095 2>/dev/null); do ps -o pid,ppid,rss,args -p "$p"; done
echo ""
echo "=== ALL next-server processes ==="
ps -eo pid,ppid,rss,etime,args | grep -F "next-server" | grep -v grep
echo ""
echo "=== stop cvxlogs dev tailer ==="
systemctl stop cvxlogs 2>/dev/null
systemctl reset-failed cvxlogs 2>/dev/null
rm -f /tmp/cvxlogs.txt
echo "cvxlogs: $(systemctl is-active cvxlogs 2>/dev/null || echo inactive)"
echo CLEANUP_DIAG_DONE
