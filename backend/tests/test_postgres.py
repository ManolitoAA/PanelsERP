import os
import pytest
from sqlmodel import Session, SQLModel, create_engine, select
from src.models import Supplier

URL = os.getenv("TEST_POSTGRES_URL")

@pytest.mark.skipif(not URL, reason="TEST_POSTGRES_URL no definida (Postgres no levantado)")
def test_postgres_roundtrip():
    engine = create_engine(URL)
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        s.add(Supplier(name="Proveedor PG", contact_info="pg@x.com"))
        s.commit()
        assert s.exec(select(Supplier)).one().name == "Proveedor PG"
    SQLModel.metadata.drop_all(engine)
