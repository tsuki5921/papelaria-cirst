#!/usr/bin/env bash
# Inicia a Papelaria Cristã no Linux/Mac:  ./iniciar.sh   (ou ./iniciar.sh --rede)
set -e
cd "$(dirname "$0")"
PY=$(command -v python3 || command -v python || true)
[ -z "$PY" ] && { echo "Python não encontrado. Instale em https://www.python.org/downloads/"; exit 1; }
[ -x .venv/bin/python ] || "$PY" -m venv .venv
.venv/bin/python -m pip install --disable-pip-version-check -q -r requirements.txt
exec .venv/bin/python run.py "$@"
