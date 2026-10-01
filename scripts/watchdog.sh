#!/bin/bash
# Zapix AI - Automated Health Watchdog
# Checks http://localhost:3001/api/health
# If server fails to respond within 8 seconds or returns non-200, automatically restarts zapix-ai cleanly

HEALTH_URL="http://localhost:3001/api/health"
HTTP_STATUS=$(curl -s -m 8 -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null)

if [ "$HTTP_STATUS" != "200" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WATCHDOG ALERT] Zapix AI indisponível (HTTP $HTTP_STATUS). Reiniciando processo no PM2..."
    pm2 restart zapix-ai --update-env
else
    # Server is healthy
    exit 0
fi
