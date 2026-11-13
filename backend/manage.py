"""Comandos de manutenção.

    python -m backend.manage senha      # define/troca a senha do painel
    python -m backend.manage backup     # cria cópia do banco em data/backups/
    python -m backend.manage reset      # apaga e recria o banco com os dados iniciais
    python -m backend.manage certificado  # (re)instala o certificado HTTPS local no sistema
"""
import getpass
import os
import sys
from datetime import datetime
from pathlib import Path

from .auth import set_admin_password
from .db import backup_db, connect, init_db

ROOT = Path(__file__).resolve().parent.parent
DB = os.environ.get("PAPELARIA_DB", str(ROOT / "data" / "papelaria.db"))


def main(argv):
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "senha":
        init_db(DB)
        pwd = getpass.getpass("Nova senha (mín. 8 caracteres): ")
        if pwd != getpass.getpass("Repita a senha: "):
            sys.exit("As senhas não conferem.")
        conn = connect(DB)
        try:
            set_admin_password(conn, pwd)
        except ValueError as e:
            sys.exit(str(e))
        print("Senha atualizada. Sessões anteriores foram encerradas.")
    elif cmd == "backup":
        dest = ROOT / "data" / "backups" / f"papelaria-{datetime.now():%Y%m%d-%H%M%S}.db"
        backup_db(DB, dest)
        print(f"Backup criado: {dest}")
    elif cmd == "reset":
        if input("Isso apaga TODOS os dados. Digite APAGAR para confirmar: ") != "APAGAR":
            sys.exit("Cancelado.")
        for suffix in ("", "-wal", "-shm"):
            Path(DB + suffix).unlink(missing_ok=True)
        init_db(DB)
        print("Banco recriado com os dados iniciais.")
    elif cmd == "certificado":
        from .certs import ensure_certificate, trust_ca
        folder = ROOT / "data" / "certs"
        ensure_certificate(folder)
        ok, msg = trust_ca(folder, force=True)
        print(msg)
        if not ok:
            sys.exit(1)
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv)
