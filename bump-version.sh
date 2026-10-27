#!/bin/sh
# Sätter en ny version i version.txt och js/update.js. Körs före varje commit som ska ut till barnen.
cd "$(dirname "$0")"
V=$(date +%Y-%m-%d.%H%M)
echo "$V" > version.txt
sed -i '' "s/export const VERSION = '.*';/export const VERSION = '$V';/" js/update.js
echo "Version $V"
