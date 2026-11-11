from pathlib import Path
from types import SimpleNamespace
from src.services.catalog_parser import parse_catalog, parse_catalog_from_env
from src.services.catalog_schemas import CatalogDraft

FIXTURE = Path(__file__).parent / "fixtures" / "catalog_draft.json"


class FakeGenai:
    def __init__(self, reply: CatalogDraft):
        self.reply = reply
        self.calls = []
        self.models = self

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(text=self.reply.model_dump_json())


def test_parse_catalog_sends_pdf_part_and_schema():
    fake = FakeGenai(CatalogDraft(products=[]))
    parse_catalog(fake, "m", b"%PDF-1.4")
    call = fake.calls[0]
    assert "transpaleta" in call["contents"][0]
    assert call["contents"][1].inline_data.mime_type == "application/pdf"
    assert call["config"].response_schema is CatalogDraft


def test_parse_catalog_from_env_uses_fake_file(monkeypatch):
    monkeypatch.setenv("GEMINI_FAKE_CATALOG", str(FIXTURE))
    draft = parse_catalog_from_env(b"%PDF")
    assert draft.products[0].name == "BOLARDO PCK" and len(draft.products[0].variants) == 2
