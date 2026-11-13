"""Inicia a Papelaria Cristã em http://localhost:5000"""
import os

from backend.app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"Papelaria Cristã rodando em http://localhost:{port}  (Ctrl+C para parar)")
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=port, debug=False)
