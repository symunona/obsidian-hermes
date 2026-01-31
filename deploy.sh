#!/usr/bin/env bash

set -e

mode="${1:-}"
target=""

if [ "$mode" = "prod" ]; then
  target="${TARGET_PROD:-}"
elif [ "$mode" = "dev" ] || [ -z "$mode" ]; then
  target="${TARGET_DEV:-}"
else
  echo "Usage: ./deploy.sh [dev|prod]"
  exit 1
fi

if [ -z "$target" ]; then
  if [ "$mode" = "prod" ]; then
    echo "Deploy: TARGET_PROD not set, skipping."
  else
    echo "Deploy: TARGET_DEV not set, skipping."
  fi
  exit 0
fi

plugin_dir="$target/.obsidian/plugins/plugin-hermes"

if [ -d "$plugin_dir" ]; then
  echo "ALERT: target plugin folder exists: $plugin_dir"
else
  mkdir -p "$plugin_dir"
fi

missing_files=""
for file in manifest.json main.js styles.css; do
  if [ ! -f "$file" ]; then
    missing_files="$missing_files $file"
  fi
done

if [ -n "$missing_files" ]; then
  echo "Deploy: missing build files:$missing_files"
  exit 1
fi

cp manifest.json main.js styles.css "$plugin_dir"/
echo "Deploy: copied files to $plugin_dir"
