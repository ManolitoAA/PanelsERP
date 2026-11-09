"""Datos de demostración para enseñar el MVP. Uso: python -m src.seed --demo"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlmodel import Session, select
from src.models import Client, Order, OrderItem, Supplier, Template, User
from src.services.profit_calculator import ItemCalculationInput, compute_item_financials

# (producto, cantidad, precio, coste)
PERFIL = ("Perfil polietileno 2m", 200, 15.0, 9.0)
CANTONERA = ("Cantonera foam", 100, 8.5, 5.0)
FILM = ("Film burbuja 1,5m", 60, 22.0, 14.0)
ESQUINERO = ("Esquinero EPE", 400, 1.8, 0.9)
PLANCHA = ("Plancha PE 5mm", 80, 31.0, 19.5)
MANGA = ("Manga protectora", 150, 4.2, 2.6)
LIQUIDACION = ("Perfil polietileno 2m (liquidación)", 120, 7.0, 9.0)  # vendido por debajo de coste

# comercial, nombre, empresa, email, estado, [(días atrás, [líneas])]
CLIENTS = [
    ("comercial1@panelserp.com", "Hans Müller", "Bauhaus GmbH", "hans@bauhaus.de", "cliente",
     [(150, [PERFIL]), (122, [CANTONERA, ESQUINERO]), (125, [PERFIL]), (61, [FILM]), (61, [ESQUINERO]), (33, [PERFIL, MANGA]), (6, [PLANCHA])]),
    ("comercial1@panelserp.com", "Claire Dubois", "Matériaux Lyon", "claire@materiaux-lyon.fr", "cliente",
     [(150, [FILM]), (93, [LIQUIDACION]), (34, [CANTONERA]), (34, [MANGA]), (5, [PERFIL])]),
    ("comercial1@panelserp.com", "Marco Rossi", "Edilizia Rossi Srl", "marco@ediliziarossi.it", "lead", []),
    ("comercial1@panelserp.com", "Anna Kowalska", "Budmax Sp. z o.o.", "anna@budmax.pl", "cliente",
     [(63, [PLANCHA]), (35, [ESQUINERO]), (4, [CANTONERA, FILM])]),
    ("comercial2@panelserp.com", "Pieter de Vries", "Bouwgroep Utrecht", "pieter@bouwgroep.nl", "cliente",
     [(125, [PLANCHA]), (95, [PERFIL]), (64, [CANTONERA]), (36, [FILM]), (7, [MANGA, ESQUINERO])]),
    ("comercial2@panelserp.com", "Sofia Almeida", "Construções Porto", "sofia@construcoesporto.pt", "lead", []),
    ("comercial2@panelserp.com", "Lars Nilsson", "Nordbygg AB", "lars@nordbygg.se", "cliente",
     [(66, [PERFIL]), (37, [PLANCHA]), (37, [CANTONERA]), (3, [FILM])]),
]

SUPPLIERS = [
    ("Plásticos del Mediterráneo", "ventas@plasticosmed.com | +34 961 000 000", "Bobinas de polietileno expandido. Plazo 7 días."),
    ("Espumas Levante", "pedidos@espumaslevante.es | +34 963 111 222", "Cantoneras y esquineros de foam."),
    ("Embalajes Europa Logística", "comercial@embeuropa.eu | +34 912 333 444", "Palets y transporte internacional."),
]

TEMPLATES = [
    ("Presupuesto", "Presupuesto para {{ empresa }}",
     "Hola {{ nombre }},\n\nTe enviamos el presupuesto solicitado por un importe de {{ importe }}.\n\nUn saludo,\n{{ comercial }}"),
    ("Seguimiento de lead", "¿Seguimos hablando, {{ nombre }}?",
     "Hola {{ nombre }},\n\nQuería saber si has podido revisar nuestra propuesta para {{ empresa }}.\n\nQuedo atento,\n{{ comercial }}"),
    ("Confirmación de pedido", "Pedido #{{ pedido }} confirmado",
     "Hola {{ nombre }},\n\nConfirmamos tu pedido #{{ pedido }} ({{ importe }}). Te avisaremos al enviarlo.\n\n{{ comercial }}"),
]

def seed_demo(session: Session, today: Optional[datetime] = None) -> None:
    if session.exec(select(Client)).first():
        return  # ya hay datos: no se duplica ni se toca nada
    today = today or datetime.now(timezone.utc)
    users = {u.email: u for u in session.exec(select(User)).all()}

    for email, name, company, contact, status, orders in CLIENTS:
        client = Client(name=name, company=company, contact_email=contact, status=status, commercial_id=users[email].id)
        session.add(client)
        session.flush()
        for days_ago, lines in orders:
            items = [compute_item_financials(ItemCalculationInput(product_name=p, quantity=q, unit_price=pr, unit_cost=c)) for p, q, pr, c in lines]
            billed = round(sum(i.subtotal for i in items), 2)
            profit = round(sum(i.net_profit for i in items), 2)
            order = Order(client_id=client.id, commercial_id=client.commercial_id, total_billed=billed, net_profit=profit,
                          created_at=today - timedelta(days=days_ago))
            session.add(order)
            session.flush()
            session.add_all([OrderItem(order_id=order.id, product_name=i.product_name, quantity=i.quantity,
                                       unit_price=i.unit_price, unit_cost=i.unit_cost) for i in items])
            client.total_billed = round(client.total_billed + billed, 2)
            client.total_profit = round(client.total_profit + profit, 2)

    session.add_all([Supplier(name=n, contact_info=c, notes=notes) for n, c, notes in SUPPLIERS])
    session.add_all([Template(name=n, subject=s, body_content=b) for n, s, b in TEMPLATES])
    session.commit()
