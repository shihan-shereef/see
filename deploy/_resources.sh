#!/usr/bin/env bash
echo "===== HOST ====="
echo "CPU cores: $(nproc)   load:$(cut -d' ' -f1-3 /proc/loadavg)"
uptime
echo "----- memory -----"; free -h
echo "----- disk (/) -----"; df -h /
echo ""
echo "===== DOCKER (live per-container) ====="
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}'
echo ""
echo "===== DOCKER disk usage ====="
docker system df
echo ""
echo "===== BUILD / DISK SIZES ====="
du -sh /opt/myos/apps/app/.next 2>/dev/null
du -sh /opt/myos/node_modules 2>/dev/null
du -sh /opt/myos 2>/dev/null
echo "----- docker volumes -----"
docker system df -v 2>/dev/null | sed -n '/VOLUME NAME/,/^$/p' | head -20
echo ""
echo "===== app + tunnels (RSS) ====="
ps -eo rss,comm,args --sort=-rss 2>/dev/null | awk 'NR==1 || /next-server|cloudflared|node/ {printf "%6d MB  %s\n", $1/1024, substr($0, index($0,$2))}' | head -14
