from typing import Optional
from pydantic import BaseModel, Field

class ItemCalculationInput(BaseModel):
    product_name: str
    quantity: int = Field(1, gt=0)
    unit_price: Optional[float] = Field(None, ge=0)
    unit_cost: float = Field(ge=0)
    margin_pct: Optional[float] = Field(None, lt=100)  # margen sobre el precio de venta, no sobre el coste

class ItemCalculationOutput(BaseModel):
    product_name: str
    quantity: int
    unit_price: float
    unit_cost: float
    subtotal: float
    net_profit: float

def compute_item_financials(item: ItemCalculationInput) -> ItemCalculationOutput:
    qty = item.quantity
    cost = item.unit_cost

    if item.unit_price is not None:
        price = item.unit_price
    elif item.margin_pct is not None:
        price = round(cost / (1.0 - item.margin_pct / 100.0), 2)
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
