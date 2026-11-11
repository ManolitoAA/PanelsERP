from types import SimpleNamespace
import pytest
from sqlmodel import select
from src.catalog_models import Product, ProductVariant
from src.models import RoleEnum, User
from src.services.catalog_schemas import CatalogDraft, DraftProduct, DraftVariant, ImportPreview
from src.services.catalog_service import allowed_actions, apply_import, classify, normalize, same_variant
from src.services.order_service import OrderError


@pytest.fixture
def env(db_session):
    users = {
        "com1": User(id=1, email="c1@t", name="C1", hashed_password="x", role=RoleEnum.COMERCIAL),
        "jefe": User(id=2, email="j@t", name="J", hashed_password="x", role=RoleEnum.JEFE),
        "rrhh": User(id=3, email="r@t", name="R", hashed_password="x", role=RoleEnum.ADMIN_RRHH),
        "com4": User(id=4, email="c4@t", name="C4", hashed_password="x", role=RoleEnum.COMERCIAL),
    }
    db_session.add_all(users.values())
    product = Product(name="BOLARDO PCK", table_headers=["Ø", "Altura"], created_by=1)
    db_session.add(product)
    db_session.commit()
    variant = ProductVariant(product_id=product.id, dimensions=["100", "430"], unit_price=15, unit_cost=9, created_by=1)
    db_session.add(variant)
    db_session.commit()
    return SimpleNamespace(session=db_session, product=product, variant=variant, **users)


def draft_with(*dims, name="Bolardo PCK"):
    return CatalogDraft(products=[DraftProduct(name=name, table_headers=["Ø", "Altura"],
                                               variants=[DraftVariant(dimensions=list(d)) for d in dims])])


def variants(session):
    return session.exec(select(ProductVariant)).all()


def test_normalize_ignores_thousands_accents_and_diameter():
    assert normalize(" Ø 1.500 ") == normalize("1500")
    assert normalize("GUARDARRAÍL PCK") == normalize("guardarrail  pck")


def test_same_variant_by_reference_else_name_and_dimensions():
    a = DraftVariant(reference="PE-1", dimensions=["100"])
    assert same_variant("X", a, "Y", DraftVariant(reference="pe-1", dimensions=["999"]))
    assert not same_variant("X", a, "X", DraftVariant(reference="PE-2", dimensions=["100"]))
    assert same_variant("Bolardo PCK", a, "BOLARDO PCK", DraftVariant(dimensions=["100"]))
    assert not same_variant("Bolardo PCK", a, "BOLARDO PCK", DraftVariant(dimensions=["120"]))


def test_allowed_actions_author_or_jefe_can_overwrite(env):
    assert allowed_actions(env.com1, env.variant) == ["crear", "mantener", "sobrescribir"]
    assert allowed_actions(env.jefe, env.variant) == ["crear", "mantener", "sobrescribir"]
    assert allowed_actions(env.com4, env.variant) == ["crear", "mantener"]


def test_classify_marks_conflict_and_actions_for_non_author(env):
    preview = classify(env.session, env.com4, draft_with(["100", "430"]))
    p = preview.products[0]
    v = p.variants[0]
    assert p.existing_product_id == env.product.id
    assert v.status == "conflicto" and v.existing_variant_id == env.variant.id
    assert v.allowed_actions == ["crear", "mantener"]
    assert v.existing.unit_price == 15
    jefe_v = classify(env.session, env.jefe, draft_with(["100", "430"])).products[0].variants[0]
    assert "sobrescribir" in jefe_v.allowed_actions


def test_classify_thousands_separator_counts_as_same(env):
    env.variant.dimensions = ["100", "1500"]
    env.session.add(env.variant)
    env.session.commit()
    assert classify(env.session, env.com4, draft_with(["100", "1.500"])).products[0].variants[0].status == "conflicto"


def test_classify_marks_repeated_inside_same_pdf(env):
    preview = classify(env.session, env.com4, draft_with(["70", "266"], ["70", "266"]))
    assert [v.status for v in preview.products[0].variants] == ["nueva", "repetida"]
    assert preview.products[0].variants[1].allowed_actions == ["crear", "descartar"]


def test_apply_import_creates_new_product_and_variants(env):
    preview = classify(env.session, env.com4, draft_with(["70", "266"], ["120", "530"], name="GUARDARRAÍL PCK"))
    result = apply_import(env.session, env.com4, preview)
    assert result == {"created": 2, "overwritten": 0, "kept": 0, "discarded": 0}
    new_product = env.session.exec(select(Product).where(Product.name == "GUARDARRAÍL PCK")).one()
    assert new_product.created_by == 4
    assert {tuple(v.dimensions) for v in variants(env.session) if v.product_id == new_product.id} == {("70", "266"), ("120", "530")}


def test_apply_import_new_variant_joins_existing_product(env):
    preview = classify(env.session, env.com4, draft_with(["70", "266"]))
    apply_import(env.session, env.com4, preview)
    assert len(env.session.exec(select(Product)).all()) == 1
    assert len(variants(env.session)) == 2


def test_apply_import_each_conflict_action(env):
    for action, expected_count in (("mantener", 1), ("crear", 2)):
        preview = classify(env.session, env.com1, draft_with(["100", "430"]))
        preview.products[0].variants[0].action = action
        apply_import(env.session, env.com1, preview)
        assert len(variants(env.session)) == expected_count


def test_apply_import_overwrite_by_author_updates_price(env):
    preview = classify(env.session, env.com1, draft_with(["100", "430"]))
    v = preview.products[0].variants[0]
    v.action, v.unit_price, v.reference = "sobrescribir", 18.0, "BP-100"
    assert apply_import(env.session, env.com1, preview)["overwritten"] == 1
    env.session.refresh(env.variant)
    assert env.variant.unit_price == 18.0 and env.variant.unit_cost == 9 and env.variant.reference == "BP-100"


def test_apply_import_discard_new_variant(env):
    preview = classify(env.session, env.com4, draft_with(["70", "266"]))
    preview.products[0].variants[0].action = "descartar"
    assert apply_import(env.session, env.com4, preview)["discarded"] == 1
    assert len(variants(env.session)) == 1


def test_apply_import_409_when_new_conflict_appeared(env):
    preview = classify(env.session, env.com4, draft_with(["70", "266"]))
    env.session.add(ProductVariant(product_id=env.product.id, dimensions=["70", "266"], created_by=1))
    env.session.commit()
    with pytest.raises(OrderError) as e:
        apply_import(env.session, env.com4, preview)
    assert e.value.status_code == 409
    assert ImportPreview.model_validate(e.value.detail).products[0].variants[0].status == "conflicto"
    assert len(variants(env.session)) == 2


def test_apply_import_403_overwrite_foreign_and_rolls_back(env):
    preview = classify(env.session, env.com4, draft_with(["100", "430"], ["70", "266"]))
    preview.products[0].variants[0].action = "sobrescribir"
    preview.products[0].variants[0].unit_price = 1.0
    with pytest.raises(OrderError) as e:
        apply_import(env.session, env.com4, preview)
    assert e.value.status_code == 403
    env.session.refresh(env.variant)
    assert env.variant.unit_price == 15 and len(variants(env.session)) == 1


def test_apply_import_conflict_without_action_is_422(env):
    preview = classify(env.session, env.com4, draft_with(["100", "430"]))
    with pytest.raises(OrderError) as e:
        apply_import(env.session, env.com4, preview)
    assert e.value.status_code == 422


def test_apply_import_rrhh_forbidden(env):
    preview = classify(env.session, env.rrhh, draft_with(["70", "266"]))
    with pytest.raises(OrderError) as e:
        apply_import(env.session, env.rrhh, preview)
    assert e.value.status_code == 403
