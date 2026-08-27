#!/bin/sh
# Seed ~/.houdry-agent (or $HERMES_HOME) with Houdry fabric defaults.
set -e
HOME_DIR="${HERMES_HOME:-${HOME}/.houdry-agent}"
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
mkdir -p "$HOME_DIR"
if [ ! -f "$HOME_DIR/config.yaml" ]; then
  cp "$ROOT/config/houdry-fabric.defaults.yaml" "$HOME_DIR/config.yaml"
  echo "Wrote $HOME_DIR/config.yaml"
else
  echo "config.yaml already exists at $HOME_DIR (left unchanged)"
fi
if [ ! -f "$HOME_DIR/.env" ]; then
  printf 'OPENAI_API_KEY=houdry\n' > "$HOME_DIR/.env"
  echo "Wrote $HOME_DIR/.env"
fi
