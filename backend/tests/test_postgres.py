import os
import pytest
from sqlalchemy.engine import make_url
from sqlmodel import Session, SQLModel, create_engine, select
from src.models import Supplier

URL = os.getenv("TEST_POSTGRES_URL")

def is_test_db(url):
    """La prueba borra todas las tablas: solo se permite en una BD cuyo nombre contenga «test»."""
    return bool(url) and "test" in make_url(url).database.lower()

def test_is_test_db_guard():
    assert is_test_db("postgresql+psycopg://u:p@localhost:5433/panelserp_test")
    assert not is_test_db("postgresql+psycopg://u:p@localhost:5433/panelserp")
    assert not is_test_db("postgresql+psycopg://test:p@test-host:5433/panelserp")
    assert not is_test_db(None)

@pytest.mark.skipif(not is_test_db(URL), reason="TEST_POSTGRES_URL no definida o su BD no se llama *test* (la prueba borra tablas)")
def test_postgres_roundtrip():
    engine = create_engine(URL)
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        s.add(Supplier(name="Proveedor PG", contact_info="pg@x.com"))
        s.commit()
        assert s.exec(select(Supplier)).one().name == "Proveedor PG"
    SQLModel.metadata.drop_all(engine)
