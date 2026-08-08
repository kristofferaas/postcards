#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Manage a squashed Git subtree. Add and update create subtree commits; delete
removes the prefix and creates a removal commit.

Usage:
  scripts/git-subtree.sh add <repository> [ref] [prefix]
  scripts/git-subtree.sh update <repository> [ref] [prefix]
  scripts/git-subtree.sh delete <prefix>

Arguments:
  repository  Any repository accepted by git (URL, remote, or local path).
  ref         Branch, tag, or commit to import. Defaults to HEAD.
  prefix      Destination in this repository. Defaults to repos/<repository-name>.

Examples:
  scripts/git-subtree.sh add https://github.com/Effect-TS/effect.git main
  scripts/git-subtree.sh update https://github.com/Effect-TS/effect.git main
  scripts/git-subtree.sh delete repos/effect
EOF
}

fail() {
  echo "Error: $*" >&2
  exit 1
}

repository_name() {
  local input_repository="${1%/}"
  local name="${input_repository##*/}"

  # Also support scp-like URLs without a slash, such as host:repository.git.
  name="${name##*:}"
  name="${name%.git}"

  if [[ -z "${name}" || "${name}" == "." || "${name}" == ".." ]]; then
    fail "cannot infer a destination from '${1}'; pass an explicit prefix"
  fi

  printf '%s\n' "${name}"
}

validate_prefix() {
  local input_prefix="$1"
  local segment
  local -a segments

  [[ -n "${input_prefix}" ]] || fail "prefix cannot be empty"
  [[ "${input_prefix}" != /* ]] || fail "prefix must be relative to the repository root"
  [[ "${input_prefix}" != ".git" && "${input_prefix}" != .git/* ]] || fail "prefix cannot be inside .git"
  [[ "${input_prefix}" != */ ]] || fail "prefix cannot end with a slash"

  IFS='/' read -r -a segments <<< "${input_prefix}"
  for segment in "${segments[@]}"; do
    if [[ -z "${segment}" || "${segment}" == "." || "${segment}" == ".." ]]; then
      fail "prefix must not contain empty, '.' or '..' path segments"
    fi
  done
}

require_clean_worktree() {
  if [[ -n "$(git status --porcelain)" ]]; then
    fail "the working tree must be clean before managing a subtree"
  fi
}

if [[ $# -eq 0 ]]; then
  usage >&2
  exit 2
fi

readonly command="$1"
shift

if [[ "${command}" == "-h" || "${command}" == "--help" || "${command}" == "help" ]]; then
  usage
  exit 0
fi

repository_root="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  fail "run this script from inside a git repository"
readonly repository_root

cd "${repository_root}"

case "${command}" in
  add | update)
    if [[ $# -lt 1 || $# -gt 3 ]]; then
      usage >&2
      exit 2
    fi

    repository="$1"
    ref="${2:-HEAD}"
    if [[ $# -eq 3 ]]; then
      prefix="$3"
    else
      prefix="repos/$(repository_name "${repository}")"
    fi
    readonly repository ref prefix

    validate_prefix "${prefix}"
    require_clean_worktree

    if [[ "${command}" == "add" ]]; then
      if [[ -e "${prefix}" || -L "${prefix}" ]]; then
        fail "${prefix} already exists; use 'update' instead"
      fi

      git subtree add \
        --prefix="${prefix}" \
        --squash \
        "${repository}" \
        "${ref}"
    else
      [[ -d "${prefix}" ]] || fail "${prefix} does not exist; use 'add' instead"

      git subtree pull \
        --prefix="${prefix}" \
        --squash \
        "${repository}" \
        "${ref}"
    fi
    ;;
  delete)
    if [[ $# -ne 1 ]]; then
      usage >&2
      exit 2
    fi

    readonly prefix="$1"

    validate_prefix "${prefix}"
    require_clean_worktree
    [[ -e "${prefix}" || -L "${prefix}" ]] || fail "${prefix} does not exist"

    git rm -r -- "${prefix}"
    git commit -m "Remove ${prefix} subtree"
    ;;
  *)
    echo "Unknown command: ${command}" >&2
    usage >&2
    exit 2
    ;;
esac
