from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from src.auth import get_current_user
from src.db import get_session
from src.models import RoleEnum, User
from src.services.stats import StatsResponse, compute_stats

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("", response_model=StatsResponse)
def get_stats(
    commercial_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if current_user.role == RoleEnum.COMERCIAL:
        if commercial_id not in (None, current_user.id):
            raise HTTPException(status_code=403, detail="Solo puedes ver tus propias estadísticas")
        commercial_id = current_user.id
    return compute_stats(session, commercial_id)
