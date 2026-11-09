from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select
from src.auth import create_access_token, get_current_user, hash_password, verify_password
from src.db import create_db_and_tables, get_session
from src.models import RoleEnum, User
from src.routers import clients

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(title="PanelsERP API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clients.router)

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "PanelsERP"}

@app.post("/api/auth/login", response_model=TokenResponse)
def login(creds: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == creds.email)).first()
    if not user or not verify_password(creds.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas"
        )
    token = create_access_token({"sub": user.email, "role": user.role.value})
    return TokenResponse(access_token=token, role=user.role.value, name=user.name)

@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "name": user.name, "role": user.role}
