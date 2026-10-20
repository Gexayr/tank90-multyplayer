#!/bin/sh
# Sets the container memory ceiling to a share (default 80%) of the RAM that is
# available right now, so the game can never starve the other services.
# Writes TANK_MEM_LIMIT and TANK_HEAP_MB into .env (other keys are kept).
set -eu

PERCENT="${1:-80}"
ENV_FILE="$(dirname "$0")/../.env"

available_kb=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
limit_mb=$(( available_kb * PERCENT / 100 / 1024 ))
# Node heap ~60% of the ceiling; the rest is stack, buffers, sockets and native memory
heap_mb=$(( limit_mb * 60 / 100 ))

if [ "$limit_mb" -lt 256 ]; then
  echo "Only ${limit_mb} MB would be allowed - too little to run the game safely." >&2
  exit 1
fi

touch "$ENV_FILE"
tmp=$(mktemp)
grep -v -E '^(TANK_MEM_LIMIT|TANK_HEAP_MB)=' "$ENV_FILE" > "$tmp" || true
{
  cat "$tmp"
  echo "TANK_MEM_LIMIT=${limit_mb}m"
  echo "TANK_HEAP_MB=${heap_mb}"
} > "$ENV_FILE"
rm -f "$tmp"

echo "MemAvailable: $(( available_kb / 1024 )) MB -> ${PERCENT}% = ${limit_mb} MB (Node heap ${heap_mb} MB)"
