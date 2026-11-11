"""Bot de Telegram (polling) que apunta pedidos a partir de texto o audio.

Arranque: cd backend && set -a && . ../.env && set +a && ../.venv/bin/python -m src.telegram_bot
"""
import logging
import os
import time
from typing import Dict, Optional
import httpx
from google.genai import errors as genai_errors
from sqlmodel import Session, select
from src.models import User
from src.services.order_parser import OrderDraft, find_missing, make_genai_client, parse_order, summary, to_items
from src.services.order_service import OrderError, clients_for, create_client, create_order
from src.services.catalog_service import catalog_text, fill_from_variant

log = logging.getLogger("telegram_bot")

HELP = ("Mándame un texto o un audio con el pedido, por ejemplo:\n"
        "«Apúntame 200 perfiles a 15 € con coste 9 € para Hans de Bauhaus».\n"
        "También puedo dar de alta clientes: «Crea el cliente Ana Kowalska, de Budmax, ana@budmax.pl».\n"
        "Te enseñaré un resumen para confirmar. /cancelar descarta el pedido en curso.")
KEYBOARD = {"inline_keyboard": [[{"text": "✅ Confirmar", "callback_data": "ok"},
                                 {"text": "❌ Cancelar", "callback_data": "no"}]]}


class TelegramAPI:
    def __init__(self, token: str):
        self.token = token
        self.http = httpx.Client(timeout=40)

    def call(self, method: str, **params):
        r = self.http.post(f"https://api.telegram.org/bot{self.token}/{method}", json=params)
        r.raise_for_status()
        return r.json()["result"]

    def download(self, file_id: str) -> bytes:
        path = self.call("getFile", file_id=file_id)["file_path"]
        r = self.http.get(f"https://api.telegram.org/file/bot{self.token}/{path}")
        r.raise_for_status()
        return r.content


class OrderBot:
    def __init__(self, tg, genai_client, model: str, engine, allowed_user_id: int, erp_email: str):
        self.tg = tg
        self.genai = genai_client
        self.model = model
        self.engine = engine
        self.allowed_user_id = allowed_user_id
        self.erp_email = erp_email
        # shortcut: borradores en memoria, se pierden al reiniciar el bot; pasar a BD si se usa en equipo.
        self.pending: Dict[int, OrderDraft] = {}

    def send(self, chat_id: int, text: str, keyboard: Optional[dict] = None):
        params = {"chat_id": chat_id, "text": text}
        if keyboard:
            params["reply_markup"] = keyboard
        self.tg.call("sendMessage", **params)

    def handle_update(self, update: dict):
        if "callback_query" in update:
            return self._on_button(update["callback_query"])
        msg = update.get("message")
        if not msg or msg.get("from", {}).get("id") != self.allowed_user_id:
            return  # solo atiende al usuario autorizado
        chat_id = msg["chat"]["id"]
        text = msg.get("text")
        if text in ("/start", "/help"):
            return self.send(chat_id, HELP)
        if text == "/cancelar":
            self.pending.pop(chat_id, None)
            return self.send(chat_id, "Pedido descartado.")
        voice = msg.get("voice") or msg.get("audio")
        if not text and not voice:
            return self.send(chat_id, "Solo entiendo texto o audios.")
        self._on_order_message(chat_id, text, voice["file_id"] if voice else None)

    def _on_order_message(self, chat_id: int, text: Optional[str], file_id: Optional[str]):
        with Session(self.engine) as session:
            user = self._erp_user(session)
            if not user:
                return self.send(chat_id, f"No existe el usuario {self.erp_email} en el ERP.")
            clients = clients_for(session, user)
            try:
                audio = self.tg.download(file_id) if file_id else None
                draft = parse_order(self.genai, self.model, clients, text=text, audio=audio,
                                    previous=self.pending.get(chat_id), catalog=catalog_text(session))
            except genai_errors.ServerError:
                log.exception("Gemini no disponible")
                return self.send(chat_id, "Gemini está saturado. Prueba otra vez en un minuto.")
            except Exception:
                log.exception("Fallo al interpretar el mensaje")
                return self.send(chat_id, "No he podido entender el mensaje. Prueba otra vez.")
            draft.items = [self._fill(session, it) for it in draft.items]
            self.pending[chat_id] = draft
            missing = find_missing(draft, clients)
            if missing:
                return self.send(chat_id, "\n".join(missing) + "\nRespóndeme con lo que falta o /cancelar.")
            self.send(chat_id, summary(draft, clients), KEYBOARD)

    @staticmethod
    def _fill(session, item):
        try:
            return fill_from_variant(session, item)
        except OrderError:  # Gemini inventó un variant_id: se trata como producto libre
            return item.model_copy(update={"variant_id": None})

    def _on_button(self, query: dict):
        self.tg.call("answerCallbackQuery", callback_query_id=query["id"])
        if query.get("from", {}).get("id") != self.allowed_user_id:
            return
        chat_id = query["message"]["chat"]["id"]
        self.tg.call("editMessageReplyMarkup", chat_id=chat_id, message_id=query["message"]["message_id"])
        draft = self.pending.pop(chat_id, None)
        if query.get("data") != "ok":
            return self.send(chat_id, "Pedido cancelado.")
        if not draft:
            return self.send(chat_id, "No hay ningún pedido pendiente.")
        with Session(self.engine) as session:
            user = self._erp_user(session)
            clients = clients_for(session, user) if user else []
            if not user or find_missing(draft, clients):
                return self.send(chat_id, "El pedido ya no es válido. Mándamelo otra vez.")
            done = []
            try:
                client_id = draft.client_id
                if client_id not in {c.id for c in clients}:
                    nc = draft.new_client
                    new = create_client(session, user, nc.name.strip(), nc.company.strip(), nc.contact_email.strip(),
                                        status="cliente" if draft.items else "lead")
                    client_id = new.id
                    done.append(f"✅ Cliente #{new.id} {new.name} ({new.company}) creado como {new.status}.")
                if draft.items:
                    order = create_order(session, user, client_id, to_items(draft))
                    done.append(f"✅ Pedido #{order['id']} guardado: {order['total_billed']:.2f} €, "
                                f"beneficio {order['net_profit']:.2f} €.")
            except OrderError as e:
                done.append(f"No se pudo guardar: {e.detail}")
        self.send(chat_id, "\n".join(done))

    def _erp_user(self, session: Session) -> Optional[User]:
        return session.exec(select(User).where(User.email == self.erp_email)).first()

    def run(self):
        offset = None
        log.info("Bot en marcha (polling)")
        while True:
            try:
                updates = self.tg.call("getUpdates", timeout=30, offset=offset)
            except httpx.HTTPError:
                log.exception("Fallo al leer de Telegram")
                time.sleep(5)
                continue
            for update in updates:
                offset = update["update_id"] + 1
                try:
                    self.handle_update(update)
                except Exception:
                    log.exception("Fallo procesando un mensaje")


def main():
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("httpx").setLevel(logging.WARNING)  # sus logs incluyen la URL con el token
    from src.db import create_db_and_tables, engine
    create_db_and_tables()
    OrderBot(
        tg=TelegramAPI(os.environ["TELEGRAM_BOT_TOKEN"]),
        genai_client=make_genai_client(),
        model=os.getenv("GEMINI_MODEL") or "gemini-3.5-flash-lite",
        engine=engine,
        allowed_user_id=int(os.environ["TELEGRAM_ALLOWED_USER_ID"]),
        erp_email=os.environ["TELEGRAM_ERP_USER_EMAIL"],
    ).run()


if __name__ == "__main__":
    main()
