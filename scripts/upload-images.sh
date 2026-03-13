#!/usr/bin/env bash
# Deploy script: sync config (Caddyfile, compose) and/or build+upload images to the droplet,
# then optionally run docker compose up on the server. Use env vars to choose what to deploy.
#
# Usage:
#   SERVER=root@159.89.29.29 ./scripts/upload-images.sh
#   DEPLOY_IMAGES=0 SERVER=root@host ./scripts/upload-images.sh   # config only (e.g. Caddy change)
#   DEPLOY_CONFIG=0 SERVER=root@host ./scripts/upload-images.sh   # images only
#   GIT_PULL_LOCAL=1 SERVER=root@host ./scripts/upload-images.sh   # pull latest locally, then full deploy
#   CONFIG_SOURCE=github SERVER=root@host ./scripts/upload-images.sh  # server git pull (server must be a clone)
#   SKIP_BUILD=1 SERVER=root@host ./scripts/upload-images.sh       # upload existing images only
#   RUN_ON_SERVER=0 SERVER=root@host ./scripts/upload-images.sh   # sync/build/upload only, no remote compose up
#
# Env:
#   SERVER         (required)  SSH target, e.g. root@159.89.29.29
#   DEPLOY_PATH    (optional)  Path on server; default: var/www/szczypta-smaku (relative to SSH user home; absolute recommended)
#   DEPLOY_CONFIG  (optional)  If 1, sync config (caddy + compose) to server; default: 1
#   DEPLOY_IMAGES  (optional)  If 1, build and upload backend+catering images; default: 1
#   CONFIG_SOURCE  (optional)  local = rsync from REPO_ROOT; github = run git pull on server (server must be clone); default: local
#   GIT_PULL_LOCAL (optional)  If 1, run git pull in REPO_ROOT before sync/build; default: 0
#   SKIP_BUILD     (optional)  If 1, skip docker compose build (only save/upload existing images); default: 0
#   RUN_ON_SERVER  (optional)  If 1, run load + compose up on server; default: 1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TAR_NAME="szczypta-smaku-images.tar"

SERVER="${SERVER:-root@159.89.29.29}"
DEPLOY_PATH="${DEPLOY_PATH:-var/www/szczypta-smaku}"
DEPLOY_CONFIG="${DEPLOY_CONFIG:-1}"
DEPLOY_IMAGES="${DEPLOY_IMAGES:-1}"
CONFIG_SOURCE="${CONFIG_SOURCE:-local}"
GIT_PULL_LOCAL="${GIT_PULL_LOCAL:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
RUN_ON_SERVER="${RUN_ON_SERVER:-1}"

if [[ -z "$SERVER" ]]; then
  echo "Error: SERVER is required (e.g. SERVER=root@159.89.29.29)." >&2
  exit 1
fi

cd "$REPO_ROOT"

UPLOADED_IMAGES_THIS_RUN=0

# 1. Optional local git pull
if [[ "$GIT_PULL_LOCAL" == "1" ]]; then
  echo "Pulling latest from git in $REPO_ROOT..."
  git pull
fi

# 2. Optional config sync
if [[ "$DEPLOY_CONFIG" == "1" ]]; then
  if [[ "$CONFIG_SOURCE" == "github" ]]; then
    echo "On server: pulling from GitHub at $DEPLOY_PATH..."
    ssh "$SERVER" "cd $DEPLOY_PATH && git pull"
  else
    echo "Syncing config (caddy, compose) to $SERVER:$DEPLOY_PATH/..."
    if command -v rsync &>/dev/null; then
      rsync -avz --delete \
        caddy/ \
        "$SERVER:$DEPLOY_PATH/caddy/"
      rsync -avz \
        docker-compose.yml \
        docker-compose.prod.yml \
        "$SERVER:$DEPLOY_PATH/"
    else
      echo "rsync not found, using scp..."
      ssh "$SERVER" "mkdir -p $DEPLOY_PATH/caddy"
      scp docker-compose.yml docker-compose.prod.yml "$SERVER:$DEPLOY_PATH/"
      scp -r caddy/. "$SERVER:$DEPLOY_PATH/caddy/"
    fi
  fi
fi

# 3. Optional build
if [[ "$DEPLOY_IMAGES" == "1" ]]; then
  if [[ "$SKIP_BUILD" != "1" ]]; then
    echo "Building images..."
    docker compose build backend catering
  else
    echo "Skipping build (SKIP_BUILD=1)."
  fi

  # 4. Export and upload images
  echo "Saving images to $TAR_NAME..."
  docker save -o "$TAR_NAME" szczypta-smaku-backend szczypta-smaku-catering
  echo "Uploading to $SERVER:$DEPLOY_PATH/..."
  scp "$TAR_NAME" "$SERVER:$DEPLOY_PATH/"
  UPLOADED_IMAGES_THIS_RUN=1
  rm -f "$REPO_ROOT/$TAR_NAME"
fi

# 5. Optional run on server
if [[ "$RUN_ON_SERVER" == "1" ]]; then
  echo "On server: loading images (if any) and running compose up..."
  if [[ "$UPLOADED_IMAGES_THIS_RUN" == "1" ]]; then
    ssh "$SERVER" "cd $DEPLOY_PATH && docker load -i $TAR_NAME && rm -f $TAR_NAME && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
  else
    ssh "$SERVER" "cd $DEPLOY_PATH && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
  fi
  echo "Done."
else
  if [[ "$UPLOADED_IMAGES_THIS_RUN" == "1" ]]; then
    echo "Skipping remote load/up (RUN_ON_SERVER=0). Upload complete; run on server:"
    echo "  cd $DEPLOY_PATH && docker load -i $TAR_NAME && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d && rm -f $TAR_NAME"
  else
    echo "Skipping remote load/up (RUN_ON_SERVER=0). Run on server to apply config:"
    echo "  cd $DEPLOY_PATH && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
  fi
fi
