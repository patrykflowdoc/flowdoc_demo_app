#!/bin/sh
set -eu
# Named volume mounts are root-owned; app runs as nodejs (UID 1001).
mkdir -p /app/uploads
chown -R nodejs:nodejs /app/uploads
exec runuser -u nodejs -g nodejs -- "$@"
