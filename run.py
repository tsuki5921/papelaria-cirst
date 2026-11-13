"""Inicia a Papelaria Cristã.

    python run.py           -> https://localhost:5000  (padrão, com HTTPS)
    python run.py --http    -> http://localhost:5000   (sem HTTPS)
"""
import os
import sys
from pathlib import Path

from backend.app import create_app
from backend.certs import ensure_certificate

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "127.0.0.1")
    use_https = "--http" not in sys.argv and os.environ.get("HTTPS", "1") != "0"
    ssl_context = ensure_certificate(Path(__file__).parent / "data" / "certs") if use_https else None
    scheme = "https" if use_https else "http"
    print(f"\nPapelaria Cristã rodando em {scheme}://localhost:{port}   (Ctrl+C para parar)")
    if use_https:
        print("Se o navegador avisar sobre o certificado, clique em 'Avançado' > 'Continuar para localhost'.")
        print("Para não ver o aviso, veja a seção HTTPS do README (mkcert).\n")
    app.run(host=host, port=port, debug=False, ssl_context=ssl_context)
