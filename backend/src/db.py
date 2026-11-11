import os
from typing import Generator
from sqlalchemy import inspect
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./panelserp.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)

def add_missing_columns(db_engine) -> None:
    """create_all no añade columnas a tablas ya creadas: las nuevas se añaden aquí."""
    insp = inspect(db_engine)
    if insp.has_table("orderitem") and "variant_id" not in {c["name"] for c in insp.get_columns("orderitem")}:
        with db_engine.begin() as conn:
            conn.exec_driver_sql("ALTER TABLE orderitem ADD COLUMN variant_id INTEGER")

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
    add_missing_columns(engine)

def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
