from sqlmodel import select
from src.models import Supplier

def test_db_session_fixture_is_isolated_and_works(db_session):
    db_session.add(Supplier(name="Proveedor", contact_info="p@x.com"))
    db_session.commit()
    assert len(db_session.exec(select(Supplier)).all()) == 1

def test_db_session_fixture_starts_empty(db_session):
    assert db_session.exec(select(Supplier)).all() == []
