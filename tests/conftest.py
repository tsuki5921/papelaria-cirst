import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend import auth  # noqa: E402
from backend.app import create_app  # noqa: E402

PASSWORD = "senha-de-teste-123"


@pytest.fixture
def app(tmp_path):
    auth.reset_attempts()
    return create_app({
        "DATABASE": str(tmp_path / "test.db"),
        "UPLOAD_DIR": str(tmp_path / "uploads"),
        "ADMIN_PASSWORD": PASSWORD,
        "TESTING": True,
    })


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def admin(client):
    token = client.post("/api/admin/login", json={"password": PASSWORD}).get_json()["token"]
    return {"Authorization": f"Bearer {token}"}
