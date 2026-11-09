"""Usuarios de demo/E2E. Uso: python -m src.seed (desde backend/)."""
from sqlmodel import Session, select
from src.auth import hash_password
from src.db import create_db_and_tables, engine
from src.models import RoleEnum, User

DEMO_USERS = [
    ("comercial1@panelserp.com", "Comercial Uno", RoleEnum.COMERCIAL),
    ("comercial2@panelserp.com", "Comercial Dos", RoleEnum.COMERCIAL),
    ("jefe@panelserp.com", "Jefe Global", RoleEnum.JEFE),
    ("admin@panelserp.com", "Admin RRHH", RoleEnum.ADMIN_RRHH),
]

def seed(session: Session, password: str = "password123") -> None:
    for email, name, role in DEMO_USERS:
        if session.exec(select(User).where(User.email == email)).first():
            continue
        session.add(User(email=email, name=name, role=role, hashed_password=hash_password(password)))
    session.commit()

if __name__ == "__main__":
    create_db_and_tables()
    with Session(engine) as s:
        seed(s)
