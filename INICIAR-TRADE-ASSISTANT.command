#!/bin/bash
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1 || ! node -e 'const v=process.versions.node.split(".").map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=17)?0:1)' >/dev/null 2>&1; then
  printf '\nInstale o Node.js LTS, versão 22.17 ou mais recente.\n'
  printf 'Depois feche e abra este iniciador novamente.\n'
  read -r -p 'Abrir o site oficial do Node.js? [s/N] ' reply
  case "$reply" in s|S) open 'https://nodejs.org/en/download' ;; esac
  read -r -p 'Pressione Enter para fechar.'
  exit 1
fi
node scripts/setup-local.cjs "$@"
status=$?
if [ "$status" -ne 0 ]; then read -r -p 'Pressione Enter para fechar.'; fi
exit "$status"
