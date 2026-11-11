import os
import subprocess
import sys
from pathlib import Path


def test_backend_refuses_to_start_without_secret_key():
    env = {k: v for k, v in os.environ.items() if k != "SECRET_KEY"}
    r = subprocess.run([sys.executable, "-c", "import src.auth"], env=env, capture_output=True, text=True,
                       cwd=Path(__file__).resolve().parents[1])
    assert r.returncode != 0
    assert "SECRET_KEY" in r.stderr
