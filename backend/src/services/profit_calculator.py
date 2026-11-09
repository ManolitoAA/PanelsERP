from typing import Optional
from pydantic import BaseModel

class ItemCalculationInput(BaseModel):
    product_name: str
    quantity: int = 1
    unit_price: Optional[float] = None
    unit_cost: Optional[float] = None
    margin_pct: Optional[float] = None

class ItemCalculationOutput(BaseModel):
    product_name: str
    quantity: int
    unit_price: float
    unit_cost: float
    subtotal: float
    net_profit: float

def compute_item_financials(item: ItemCalculationInput) -> ItemCalculationOutput:
    qty = max(0, item.quantity)
    cost = item.unit_cost if item.unit_cost is not None else 0.0

    if item.unit_price is not None:
        price = item.unit_price
    elif item.margin_pct is not None:
        price = round(cost * (1.0 + (item.margin_pct / 100.0)), 2)
    else:
        price = cost

    subtotal = round(qty * price, 2)
    net_profit = round(qty * (price - cost), 2)

    return ItemCalculationOutput(
        product_name=item.product_name,
        quantity=qty,
        unit_price=price,
        unit_cost=cost,
        subtotal=subtotal,
        net_profit=net_profit,
    )
