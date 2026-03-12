#!/usr/bin/env bash
# Build (optional), save backend + catering images to a single tar, upload to server,
# and optionally run docker load + compose up on the server.
#
# Usage:
#   SERVER=root@165.227.154.132 ./scripts/upload-images.sh
#   SKIP_BUILD=1 SERVER=user@host ./scripts/upload-images.sh   # upload only, no build
#   RUN_ON_SERVER=0 SERVER=user@host ./scripts/upload-images.sh # upload tars only, no remote load/up
#
# Env:
#   SERVER       (required)  SSH target, e.g. root@165.227.154.132
#   DEPLOY_PATH  (optional)  Path on server where project lives; default: /app/szczypta-smaku
#   SKIP_BUILD   (optional) If set to 1, skip "docker compose build"
#   RUN_ON_SERVER (optional) If set to 0, skip remote load and "docker compose up -d"; default: 1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAR_NAME="szczypta-smaku-images.tar"

SERVER="${SERVER:-root@159.89.29.29}"
DEPLOY_PATH="${DEPLOY_PATH:-var/www/szczypta-smaku}"
SKIP_BUILD="${SKIP_BUILD:-0}"
RUN_ON_SERVER="${RUN_ON_SERVER:-1}"

if [[ -z "$SERVER" ]]; then
  echo "Error: SERVER is required (e.g. SERVER=root@165.227.154.132)." >&2
  exit 1
fi

cd "$REPO_ROOT"

# 1. Build (optional)
if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "Building images..."
  docker compose build
else
  echo "Skipping build (SKIP_BUILD=1)."
fi

# 2. Export both images to one tar
echo "Saving images to $TAR_NAME..."
docker save -o "$TAR_NAME" szczypta-smaku-backend szczypta-smaku-catering

# 3. Upload
echo "Uploading to $SERVER:$DEPLOY_PATH/..."
scp "$TAR_NAME" "$SERVER:$DEPLOY_PATH/"

# 4. Remote load and up (optional)
if [[ "$RUN_ON_SERVER" == "1" ]]; then
  echo "On server: loading images and running compose up..."
  ssh "$SERVER" "cd $DEPLOY_PATH && docker load -i $TAR_NAME && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d && rm -f $TAR_NAME"
  echo "Done."
else
  echo "Skipping remote load/up (RUN_ON_SERVER=0). Upload complete; run on server:"
  echo "  cd $DEPLOY_PATH && docker load -i $TAR_NAME && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
fi

# Remove local tar to avoid clutter (optional; keep if you want to re-upload without rebuild)
rm -f "$REPO_ROOT/$TAR_NAME"
