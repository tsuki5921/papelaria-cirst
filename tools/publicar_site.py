"""Publica a loja (frontend/index.html) no GitHub Pages — HTTPS de verdade, sem avisos.

Uso:
    python tools/publicar_site.py

O que faz: gera o index.html atualizado e envia para o ramo `gh-pages` do seu
repositório no GitHub. Na PRIMEIRA vez, ative o site no GitHub:
    Settings > Pages > Build and deployment > Source: "Deploy from a branch"
    Branch: gh-pages   /(root)   > Save
Em 1–2 minutos a loja fica em https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/
"""
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def git(*args, cwd=ROOT, check=True):
    r = subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"Erro no git {' '.join(args)}:\n{r.stderr.strip()}")
    return r.stdout.strip()


def main():
    subprocess.run([sys.executable, str(ROOT / "tools" / "build_loja.py")], check=True)
    remote = git("remote", "get-url", "origin", check=False)
    if not remote:
        sys.exit("Este projeto ainda não está ligado a um repositório do GitHub (git remote 'origin').")

    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        shutil.copy(ROOT / "frontend" / "index.html", tmp / "index.html")
        shutil.copy(ROOT / "frontend" / "index.html", tmp / "404.html")  # links diretos também abrem a loja
        (tmp / ".nojekyll").write_text("")
        (tmp / "robots.txt").write_text("User-agent: *\nAllow: /\n")
        git("init", "-q", "-b", "gh-pages", cwd=tmp)
        git("add", "-A", cwd=tmp)
        nome = git("config", "user.name", check=False) or "Papelaria Cristã"
        email = git("config", "user.email", check=False) or "loja@papelaria.local"
        git("-c", f"user.name={nome}", "-c", f"user.email={email}", "commit", "-q", "-m", "Publicar loja", cwd=tmp)
        git("push", "-q", "--force", remote, "gh-pages", cwd=tmp)

    m = re.search(r"github\.com[:/]([^/]+)/([^/.]+)", remote)
    site = f"https://{m.group(1)}.github.io/{m.group(2)}/" if m else "(veja em Settings > Pages)"
    print(f"\nLoja enviada para o ramo gh-pages.\nEndereço: {site}")
    print("Primeira vez? Ative em: Settings > Pages > Source: Deploy from a branch > gh-pages / (root).")


if __name__ == "__main__":
    main()
