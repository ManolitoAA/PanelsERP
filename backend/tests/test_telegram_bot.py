from types import SimpleNamespace
import pytest
from src.models import Client, Order, RoleEnum, User
from src.services.order_parser import DraftItem, NewClient, OrderDraft
from src.telegram_bot import OrderBot

ME = 555


class FakeTelegram:
    def __init__(self):
        self.calls = []

    def call(self, method, **params):
        self.calls.append((method, params))

    def download(self, file_id):
        self.calls.append(("download", {"file_id": file_id}))
        return b"OggS"

    def sent(self):
        return [p for m, p in self.calls if m == "sendMessage"]


class FakeGenai:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []
        self.models = self

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(text=self.replies.pop(0).model_dump_json())


COMPLETE = OrderDraft(client_id=10, items=[DraftItem(product_name="Perfil", quantity=200, unit_price=15, unit_cost=9)])


@pytest.fixture
def make_bot(db_engine, db_session):
    db_session.add_all([
        User(id=1, email="com@t.com", name="Com", hashed_password="x", role=RoleEnum.COMERCIAL),
        Client(id=10, name="Hans", company="Bauhaus", contact_email="h@b.de", commercial_id=1),
    ])
    db_session.commit()

    def factory(*replies):
        return OrderBot(FakeTelegram(), FakeGenai(*replies), "m", db_engine, ME, "com@t.com")
    return factory


def text_msg(text, user_id=ME):
    return {"message": {"from": {"id": user_id}, "chat": {"id": 1}, "text": text}}


def button(data, user_id=ME):
    return {"callback_query": {"id": "q", "from": {"id": user_id}, "data": data,
                               "message": {"chat": {"id": 1}, "message_id": 7}}}


def orders(db_engine):
    from sqlmodel import Session, select
    with Session(db_engine) as s:
        return s.exec(select(Order)).all()


def test_ignores_strangers(make_bot):
    bot = make_bot(COMPLETE)
    bot.handle_update(text_msg("200 perfiles", user_id=999))
    assert bot.tg.calls == [] and bot.genai.calls == []


def test_complete_text_shows_summary_with_buttons(make_bot):
    bot = make_bot(COMPLETE)
    bot.handle_update(text_msg("200 perfiles a 15 coste 9 para Hans"))
    msg = bot.tg.sent()[0]
    assert "Beneficio: 1200.00 €" in msg["text"] and "reply_markup" in msg


def test_confirm_creates_order(make_bot, db_engine):
    bot = make_bot(COMPLETE)
    bot.handle_update(text_msg("pedido"))
    bot.handle_update(button("ok"))
    assert "Pedido #1 guardado: 3000.00 €" in bot.tg.sent()[-1]["text"]
    assert len(orders(db_engine)) == 1


def test_cancel_creates_nothing(make_bot, db_engine):
    bot = make_bot(COMPLETE)
    bot.handle_update(text_msg("pedido"))
    bot.handle_update(button("no"))
    assert bot.tg.sent()[-1]["text"] == "Pedido cancelado."
    assert orders(db_engine) == []


def test_missing_data_asks_then_merges_answer(make_bot):
    incomplete = OrderDraft(client_id=10, items=[DraftItem(product_name="Perfil", quantity=200, unit_price=15)])
    bot = make_bot(incomplete, COMPLETE)
    bot.handle_update(text_msg("200 perfiles a 15 para Hans"))
    assert "Falta el coste unitario de Perfil." in bot.tg.sent()[0]["text"]
    bot.handle_update(text_msg("coste 9"))
    assert '"unit_price":15.0' in bot.genai.calls[1]["contents"][0]  # le pasa el borrador anterior
    assert "reply_markup" in bot.tg.sent()[1]


def test_voice_is_downloaded_and_sent_to_gemini(make_bot):
    bot = make_bot(COMPLETE)
    bot.handle_update({"message": {"from": {"id": ME}, "chat": {"id": 1}, "voice": {"file_id": "f1"}}})
    assert ("download", {"file_id": "f1"}) in bot.tg.calls
    assert bot.genai.calls[0]["contents"][1].inline_data.data == b"OggS"


def test_gemini_failure_is_reported(make_bot):
    bot = make_bot()  # sin respuestas: generate_content lanza IndexError
    bot.handle_update(text_msg("pedido"))
    assert "No he podido entender" in bot.tg.sent()[0]["text"]
    assert bot.pending == {}


def test_button_without_pending(make_bot):
    bot = make_bot()
    bot.handle_update(button("ok"))
    assert bot.tg.sent()[-1]["text"] == "No hay ningún pedido pendiente."


def test_stranger_button_does_nothing(make_bot, db_engine):
    bot = make_bot(COMPLETE)
    bot.handle_update(text_msg("pedido"))
    bot.handle_update(button("ok", user_id=999))
    assert orders(db_engine) == [] and 1 in bot.pending


def clients(db_engine):
    from sqlmodel import Session, select
    with Session(db_engine) as s:
        return s.exec(select(Client).order_by(Client.id)).all()


NEW = NewClient(name="Ana", company="Budmax", contact_email="ana@budmax.pl")


def test_creates_client_only_as_lead(make_bot, db_engine):
    bot = make_bot(OrderDraft(new_client=NEW))
    bot.handle_update(text_msg("crea el cliente Ana de Budmax, ana@budmax.pl"))
    assert bot.tg.sent()[0]["text"] == "Cliente nuevo: Ana (Budmax, ana@budmax.pl)"
    bot.handle_update(button("ok"))
    new = clients(db_engine)[-1]
    assert (new.name, new.status, new.commercial_id) == ("Ana", "lead", 1)
    assert orders(db_engine) == []


def test_order_for_new_client_creates_both(make_bot, db_engine):
    unknown = OrderDraft(client_mentioned="Ana", items=COMPLETE.items)
    bot = make_bot(unknown, OrderDraft(new_client=NEW, items=COMPLETE.items))
    bot.handle_update(text_msg("200 perfiles para Ana"))
    assert "¿Lo creo?" in bot.tg.sent()[0]["text"]
    bot.handle_update(text_msg("sí, Ana de Budmax, ana@budmax.pl"))
    bot.handle_update(button("ok"))
    new = clients(db_engine)[-1]
    assert new.status == "cliente" and new.total_billed == 3000.0
    assert orders(db_engine)[0].client_id == new.id
    assert "Cliente #" in bot.tg.sent()[-1]["text"] and "Pedido #1" in bot.tg.sent()[-1]["text"]


def test_gemini_overloaded_message(make_bot):
    from google.genai import errors
    bot = make_bot()

    def overloaded(**kwargs):
        raise errors.ServerError(503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})
    bot.genai.generate_content = overloaded
    bot.handle_update(text_msg("pedido"))
    assert bot.tg.sent()[0]["text"] == "Gemini está saturado. Prueba otra vez en un minuto."
