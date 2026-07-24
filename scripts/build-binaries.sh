#!/usr/bin/env bash
# Cross-compiles standalone binaries with Bun, one per platform, optimized for
# size. Bun embeds its runtime, so these are inherently large; --minify shrinks
# the bundled JS, and we strip sourcemaps. Output lands in dist-bin/.
set -euo pipefail

cd "$(dirname "$0")/.."
ENTRY="src/index.ts"
OUTDIR="dist-bin"
mkdir -p "$OUTDIR"

# Ensure the embedded skill is current before compiling.
node scripts/embed-skill.ts

# platform matrix: bun target -> output name
targets=(
  "bun-darwin-arm64:umm-darwin-arm64"
  "bun-darwin-x64:umm-darwin-x64"
  "bun-linux-x64:umm-linux-x64"
  "bun-linux-arm64:umm-linux-arm64"
  "bun-windows-x64:umm-windows-x64.exe"
)

# Optional extra compression. Bun embeds its full runtime (~60MB floor), which
# no build flag removes; UPX packs the on-disk binary to roughly a third of that
# but costs a decompression step at every startup and can trip macOS Gatekeeper.
# Off by default; opt in with UMM_UPX=1 when you have upx installed.
UPX="${UMM_UPX:-0}"

for pair in "${targets[@]}"; do
  target="${pair%%:*}"
  name="${pair##*:}"
  echo "building ${name} (${target})…"
  bun build "$ENTRY" \
    --compile \
    --minify \
    --sourcemap=none \
    --target="$target" \
    --outfile "$OUTDIR/$name"

  if [[ "$UPX" == "1" ]]; then
    if command -v upx >/dev/null 2>&1; then
      # --best/--lzma give the smallest output; skip on darwin where packed
      # binaries frequently fail Gatekeeper.
      case "$target" in
        *darwin*) echo "  (skipping upx on darwin — Gatekeeper)";;
        *) upx --best --lzma "$OUTDIR/$name" >/dev/null 2>&1 && echo "  upx-compressed";;
      esac
    else
      echo "  (UMM_UPX=1 but upx not installed — skipping)"
    fi
  fi
done

echo
echo "binaries in $OUTDIR:"
ls -lh "$OUTDIR" | awk 'NR>1 {print "  " $9 "  " $5}'
