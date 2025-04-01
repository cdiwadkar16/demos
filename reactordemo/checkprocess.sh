#!/bin/bash

if ! pgrep -f "reactors.js" > /dev/null; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') Process not found. Starting it now..."
    nohup node --trace-warnings ./reactors.js >> ./reactors.log 2>&1 &
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') Process is already running."
fi

sleep 300

exec "$0" "$@"
