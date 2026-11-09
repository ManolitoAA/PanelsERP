from collections import defaultdict
from typing import List, Optional
from pydantic import BaseModel
from sqlmodel import Session, select
from src.models import Order

class Totals(BaseModel):
    billed: float = 0.0
    profit: float = 0.0
    orders: int = 0

class MonthStat(BaseModel):
    month: str
    billed: float
    profit: float

class DayStat(BaseModel):
    day: str
    sales: int

class StatsResponse(BaseModel):
    totals: Totals
    monthly: List[MonthStat]
    daily: List[DayStat]

def compute_stats(session: Session, commercial_id: Optional[int]) -> StatsResponse:
    stmt = select(Order)
    if commercial_id is not None:
        stmt = stmt.where(Order.commercial_id == commercial_id)
    orders = session.exec(stmt).all()

    months = defaultdict(lambda: [0.0, 0.0])
    days = defaultdict(int)
    for o in orders:
        months[o.created_at.strftime("%Y-%m")][0] += o.total_billed
        months[o.created_at.strftime("%Y-%m")][1] += o.net_profit
        days[o.created_at.strftime("%Y-%m-%d")] += 1

    return StatsResponse(
        totals=Totals(
            billed=round(sum(o.total_billed for o in orders), 2),
            profit=round(sum(o.net_profit for o in orders), 2),
            orders=len(orders),
        ),
        monthly=[MonthStat(month=k, billed=round(v[0], 2), profit=round(v[1], 2)) for k, v in sorted(months.items())],
        daily=[DayStat(day=k, sales=v) for k, v in sorted(days.items())],
    )
