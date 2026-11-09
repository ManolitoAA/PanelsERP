from sqlmodel import Session, SQLModel, create_engine, select
from src.auth import verify_password
from src.models import RoleEnum, User
from src.seed import seed

def test_seed_creates_users_once():
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        seed(s)
        seed(s)  # idempotente
        users = s.exec(select(User)).all()
        assert {u.role for u in users} == set(RoleEnum)
        assert len(users) == 4
        com = s.exec(select(User).where(User.email == "comercial1@panelserp.com")).one()
        assert verify_password("password123", com.hashed_password)
        assert s.exec(select(User).where(User.email == "comercial2@panelserp.com")).one().role == RoleEnum.COMERCIAL
