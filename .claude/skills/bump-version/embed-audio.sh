#!/usr/bin/env bash
# Write an mp3 out as a script file holding it as base64, so the game can play it
# when index.html is opened straight from disk (file://).
#
# Usage: embed-audio.sh <file.mp3> <output.js> <CONST_NAME>
# Example: embed-audio.sh batting-practice-v2.0/bat-hit.mp3 batting-practice-v2.0/bat-hit-v2.0.js BAT_HIT_MP3
set -euo pipefail

if [ $# -ne 3 ]; then
  echo "Usage: $0 <file.mp3> <output.js> <CONST_NAME>" >&2
  exit 1
fi

mp3="$1"
out="$2"
name="$3"

{
  printf '// %s embedded as base64 so it loads when index.html is opened straight from disk (file://)\n' "$(basename "$mp3")"
  printf 'const %s = "' "$name"
  base64 -w0 "$mp3"
  printf '";\n'
} > "$out"

echo "Wrote $out from $mp3 as $name"
