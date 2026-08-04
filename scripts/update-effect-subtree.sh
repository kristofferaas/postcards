#!/usr/bin/env bash

set -euo pipefail

readonly repository_root="$(git rev-parse --show-toplevel)"

cd "${repository_root}"

if [[ ! -d repos/effect ]]; then
  echo "repos/effect is missing; add the Effect subtree before updating it." >&2
  exit 1
fi

git subtree pull \
  --prefix=repos/effect \
  https://github.com/Effect-TS/effect.git \
  main \
  --squash
