"""Inicia a Papelaria Cristã.

    python run.py                 -> https://localhost:5000 (abre o navegador sozinho)
    python run.py --rede          -> também acessível pelo celular na mesma rede Wi-Fi
    python run.py --http          -> sem HTTPS
    python run.py --sem-navegador -> não abre o navegador automaticamente
"""
import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def fail(message):
    print("\n" + "!" * 66)
    print("  NÃO FOI POSSÍVEL INICIAR A LOJA")
    print(f"  {message}")
    print("!" * 66 + "\n")
    sys.exit(1)


def port_free(host, port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind((host, port))
            return True
        except OSError:
            return False


def lan_ip():
    """IP do computador na rede local (para abrir no celular)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))  # não envia nada, só descobre a interface
            return s.getsockname()[0]
    except OSError:
        return None


def main(argv):
    try:
        from backend.app import create_app
    except ImportError as exc:
        fail(f"Falta instalar as dependências ({exc.name}). Rode:  pip install -r requirements.txt")

    network = "--rede" in argv
    host = os.environ.get("HOST", "0.0.0.0" if network else "127.0.0.1")
    port = int(os.environ.get("PORT", "5000"))

    # Porta ocupada (outro programa ou a loja já aberta)? Usa a próxima livre.
    original = port
    while not port_free(host, port):
        port += 1
        if port > original + 20:
            fail(f"As portas {original} a {port} estão ocupadas. Feche outros servidores e tente de novo.")
    if port != original:
        print(f"Aviso: a porta {original} já está em uso; usando a porta {port}.")

    ip = lan_ip() if network else None
    use_https = "--http" not in argv and os.environ.get("HTTPS", "1") != "0"
    ssl_context = None
    cert_ok, cert_msg = True, ""
    if use_https:
        try:
            from backend.certs import ensure_certificate, trust_ca
            ssl_context = ensure_certificate(ROOT / "data" / "certs", extra_ips=[ip] if ip else [])
            cert_ok, cert_msg = trust_ca(ROOT / "data" / "certs")
        except ImportError:
            print("Aviso: pacote 'cryptography' não instalado — iniciando SEM HTTPS.")
            print("       Para HTTPS rode:  pip install -r requirements.txt\n")
            use_https = False

    try:
        app = create_app()
    except Exception as exc:  # banco corrompido, permissão de pasta etc.
        fail(f"Erro ao preparar a loja: {exc}")

    scheme = "https" if use_https else "http"
    url = f"{scheme}://localhost:{port}"
    print("\n" + "=" * 66)
    print("  ✝ Papelaria Cristã está no ar!")
    print(f"  No computador:  {url}")
    print(f"  Painel admin:   {url}/admin.html")
    if network:
        if ip:
            print(f"  No celular (mesmo Wi-Fi):  {scheme}://{ip}:{port}")
        else:
            print("  Não foi possível descobrir o IP da rede local.")
    if use_https:
        print(f"  {'🔒' if cert_ok else '⚠'} {cert_msg}")
        if cert_ok:
            print("  Se o navegador já estava aberto, feche-o e abra de novo uma vez.")
        else:
            print("  O navegador pode mostrar um aviso: clique em 'Avançado' > 'Continuar'.")
            print("  Para tentar de novo:  python -m backend.manage certificado")
        if network:
            print("  No celular aparece um aviso de segurança (o certificado é do seu PC).")
            print("  Para a loja na internet SEM avisos, use o GitHub Pages (veja o README).")
    print("  Mantenha esta janela aberta. Para parar: Ctrl+C")
    print("=" * 66 + "\n")

    if "--sem-navegador" not in argv:
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()

    try:
        app.run(host=host, port=port, debug=False, ssl_context=ssl_context)
    except OSError as exc:
        fail(f"Erro ao abrir a porta {port}: {exc}")


# usado por servidores WSGI (ex.: waitress-serve run:app)
if __name__ != "__main__":
    from backend.app import create_app
    app = create_app()

if __name__ == "__main__":
    main(sys.argv)
