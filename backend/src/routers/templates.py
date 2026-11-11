import os
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from jinja2 import BaseLoader, TemplateError
from jinja2.sandbox import SandboxedEnvironment
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select
from src.auth import get_current_user
from src.db import get_session
from src.models import Template, User
from src.services import mailer

def _render_template(tpl: Template, context: Dict[str, Any]) -> tuple[str, str]:
    """Renderiza asunto y cuerpo; cualquier fallo de la plantilla del usuario es un 422, nunca un 500."""
    try:
        return (
            _jinja_env.from_string(tpl.subject).render(context),
            _jinja_env.from_string(tpl.body_content).render(context),
        )
    except TemplateError as exc:
        raise HTTPException(status_code=422, detail=f"Template syntax error: {exc}")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Template render error: {type(exc).__name__}: {exc}")

router = APIRouter(prefix="/api/templates", tags=["templates"])

# Sandboxed Jinja2 env: no filesystem access, autoescaping off (plain-text messages)
_jinja_env = SandboxedEnvironment(loader=BaseLoader(), autoescape=False)

class TemplateCreate(BaseModel):
    name: str
    subject: str
    body_content: str

class RenderRequest(BaseModel):
    context: Dict[str, Any] = {}

class RenderResponse(BaseModel):
    rendered_subject: str
    rendered_body: str

class SendRequest(BaseModel):
    to_email: str
    context: Dict[str, Any] = {}

@router.get("", response_model=List[Template])
def list_templates(
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    return session.exec(select(Template)).all()

@router.post("", response_model=Template, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: TemplateCreate,
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    tpl = Template(**payload.model_dump())
    session.add(tpl)
    session.commit()
    session.refresh(tpl)
    return tpl

@router.post("/{template_id}/render", response_model=RenderResponse)
def render_template(
    template_id: int,
    payload: RenderRequest,
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    tpl = session.get(Template, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    rendered_subject, rendered_body = _render_template(tpl, payload.context)

    return RenderResponse(rendered_subject=rendered_subject, rendered_body=rendered_body)

@router.post("/{template_id}/send", status_code=status.HTTP_202_ACCEPTED)
def send_template_email(
    template_id: int,
    payload: SendRequest,
    background_tasks: BackgroundTasks,
    _: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    tpl = session.get(Template, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    rendered_subject, rendered_body = _render_template(tpl, payload.context)
    if not os.getenv("SMTP_HOST"):
        raise HTTPException(status_code=503, detail="El envío por email no está configurado (falta SMTP_HOST en .env)")

    background_tasks.add_task(mailer.send_smtp_email, payload.to_email, rendered_subject, rendered_body)
    return {"status": "enqueued", "to": payload.to_email}
