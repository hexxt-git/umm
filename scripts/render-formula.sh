#!/usr/bin/env bash
# Renders the Homebrew formula for a given version to stdout, computing sha256s
# from the freshly built binaries in the dist dir. Kept in this repo (not the
# tap) so the formula's shape lives next to the code that produces the binaries.
# Usage: scripts/render-formula.sh <version> [dist-dir]
set -euo pipefail

VERSION="${1:?usage: render-formula.sh <version> [dist-dir]}"
DIST="${2:-dist-bin}"

sha() { shasum -a 256 "$DIST/$1" | awk '{print $1}'; }

cat <<EOF
class Umm < Formula
  desc "A faster way to ask — direct, structured answers in your terminal"
  homepage "https://github.com/hexxt-git/umm"
  version "$VERSION"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/hexxt-git/umm/releases/download/v$VERSION/umm-darwin-arm64"
      sha256 "$(sha umm-darwin-arm64)"
    end
    on_intel do
      url "https://github.com/hexxt-git/umm/releases/download/v$VERSION/umm-darwin-x64"
      sha256 "$(sha umm-darwin-x64)"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/hexxt-git/umm/releases/download/v$VERSION/umm-linux-arm64"
      sha256 "$(sha umm-linux-arm64)"
    end
    on_intel do
      url "https://github.com/hexxt-git/umm/releases/download/v$VERSION/umm-linux-x64"
      sha256 "$(sha umm-linux-x64)"
    end
  end

  def install
    # The release asset is a single self-contained binary named per-platform
    # (e.g. umm-darwin-arm64). Install whichever one was downloaded as \`umm\`.
    bin.install Dir["umm-*"].first => "umm"
  end

  test do
    assert_path_exists bin/"umm"
  end
end
EOF
