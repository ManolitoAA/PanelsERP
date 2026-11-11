from types import SimpleNamespace
from src.models import Client
from src.services.order_parser import DraftItem, NewClient, OrderDraft, find_missing, parse_order, summary

CLIENTS = [
    Client(id=10, name="Hans", company="Bauhaus", contact_email="h@b.de", commercial_id=1),
    Client(id=11, name="Hans", company="Obi", contact_email="h@o.de", commercial_id=1),
]


class FakeGenai:
    def __init__(self, reply: OrderDraft):
        self.reply = reply
        self.calls = []
        self.models = self

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(text=self.reply.model_dump_json())


def full_item():
    return DraftItem(product_name="Perfil", quantity=200, unit_price=15, unit_cost=9)


def test_parse_order_sends_clients_text_and_previous():
    fake = FakeGenai(OrderDraft(client_id=10, items=[full_item()]))
    prev = OrderDraft(client_mentioned="Hans")
    draft = parse_order(fake, "m", CLIENTS, text="200 perfiles", previous=prev)
    assert draft.client_id == 10
    contents = fake.calls[0]["contents"]
    assert "10: Hans (Bauhaus)" in contents[0] and '"client_mentioned":"Hans"' in contents[0]
    assert contents[1] == "Mensaje: 200 perfiles"


def test_parse_order_sends_audio_as_ogg():
    fake = FakeGenai(OrderDraft())
    parse_order(fake, "m", CLIENTS, audio=b"OggS")
    part = fake.calls[0]["contents"][1]
    assert part.inline_data.mime_type == "audio/ogg" and part.inline_data.data == b"OggS"


def test_complete_draft_has_nothing_missing():
    assert find_missing(OrderDraft(client_id=10, items=[full_item()]), CLIENTS) == []


def test_missing_cost_price_and_quantity():
    draft = OrderDraft(client_id=10, items=[DraftItem(product_name="Perfil")])
    missing = find_missing(draft, CLIENTS)
    assert missing == ["Falta la cantidad de Perfil.", "Falta el coste unitario de Perfil.",
                       "Falta el precio o el margen de Perfil."]


def test_margin_replaces_price():
    draft = OrderDraft(client_id=10, items=[DraftItem(product_name="P", quantity=1, unit_cost=9, margin_pct=40)])
    assert find_missing(draft, CLIENTS) == []


def test_ambiguous_client_asks_which():
    draft = OrderDraft(client_candidates=[10, 11], items=[full_item()])
    assert find_missing(draft, CLIENTS) == ["¿Para qué cliente? Hans (Bauhaus), Hans (Obi)"]


def test_unknown_or_foreign_client():
    draft = OrderDraft(client_id=99, client_mentioned="Marie", items=[full_item()])
    assert find_missing(draft, CLIENTS) == ["No existe el cliente «Marie» entre los tuyos. ¿Lo creo? Dime nombre, empresa y email."]


def test_empty_items():
    assert "No veo productos en el pedido." in find_missing(OrderDraft(client_id=10), CLIENTS)


def test_summary_case_1():
    text = summary(OrderDraft(client_id=10, items=[full_item()]), CLIENTS)
    assert "200 × Perfil a 15.00 €" in text
    assert "Total: 3000.00 € · Beneficio: 1200.00 €" in text


ANA = NewClient(name="Ana", company="Budmax", contact_email="ana@budmax.pl")


def test_new_client_only_is_complete():
    draft = OrderDraft(new_client=ANA)
    assert find_missing(draft, CLIENTS) == []
    assert summary(draft, CLIENTS) == "Cliente nuevo: Ana (Budmax, ana@budmax.pl)"


def test_new_client_with_order_summary():
    text = summary(OrderDraft(new_client=ANA, items=[full_item()]), CLIENTS)
    assert text.startswith("Cliente nuevo: Ana (Budmax, ana@budmax.pl)\nPedido:")
    assert "Beneficio: 1200.00 €" in text


def test_new_client_missing_fields_and_bad_email():
    draft = OrderDraft(new_client=NewClient(name="Ana", contact_email="ana"))
    assert find_missing(draft, CLIENTS) == ["Falta la empresa del cliente nuevo.",
                                            "El email «ana» no parece válido."]


def test_new_client_duplicate_company():
    draft = OrderDraft(new_client=NewClient(name="Otro", company=" bauhaus ", contact_email="o@b.de"))
    assert find_missing(draft, CLIENTS) == ["Ya tienes un cliente de Bauhaus: Hans. Dime si es para él o /cancelar."]
