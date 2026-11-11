"""Fixtures compartidas: BD SQLite en memoria para pruebas rápidas, sin Docker."""
import os
os.environ.setdefault("SECRET_KEY", "test-only-secret-at-least-32-bytes-long")  # antes de importar src.auth
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

@pytest.fixture
def db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    yield engine
    engine.dispose()

@pytest.fixture
def db_session(db_engine):
    with Session(db_engine) as session:
        yield session
