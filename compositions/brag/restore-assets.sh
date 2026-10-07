#!/usr/bin/env bash
# Restores the brag composition's un-generatable assets from git history.
#
# The slides are produced by tests/brag-slides.test.ts, but the six template
# thumbnails and the licensed music track have no generator in this repo. They
# were tracked until 10cf24f untracked all of brag-output/; history was
# deliberately not rewritten, so the blobs are still reachable at SOURCE below.
#
# Usage: compositions/brag/restore-assets.sh
set -euo pipefail

SOURCE=c797162bd2818a22da19fcae805dea41f705bb8d
SOURCE_DIR=brag-output/composition/assets
MUSIC=happy-beats-business-moves-vol-1-by-ende-dot-app.mp3

root=$(git rev-parse --show-toplevel)
dest="$root/compositions/brag/assets"

if ! git -C "$root" cat-file -e "$SOURCE^{commit}" 2>/dev/null; then
  echo "error: $SOURCE is not in this clone." >&2
  echo "       A shallow clone will not have it — run: git fetch --unshallow" >&2
  exit 1
fi

mkdir -p "$dest/thumbs" "$dest/music"

for n in 1 2 3 4 5 6; do
  git -C "$root" show "$SOURCE:$SOURCE_DIR/thumbs/t$n.png" > "$dest/thumbs/t$n.png"
done
git -C "$root" show "$SOURCE:$SOURCE_DIR/music/$MUSIC" > "$dest/music/$MUSIC"

echo "Restored 6 thumbnails and 1 music track to compositions/brag/assets/."
echo "Slides are generated separately — see compositions/brag/README.md."
