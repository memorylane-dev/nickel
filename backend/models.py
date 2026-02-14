from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class PriceRecord(BaseModel):
    id: int
    date: str
    cash_settlement: Optional[float] = None
    three_month: Optional[float] = None
    stock: Optional[int] = None
    cash_change: Optional[float] = None
    cash_change_pct: Optional[float] = None


class PriceListResponse(BaseModel):
    data: List[PriceRecord]
    page: int
    per_page: int
    total: int
    total_pages: int


class StatsResponse(BaseModel):
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    avg_price: Optional[float] = None
    first_date: Optional[str] = None
    last_date: Optional[str] = None
    total_records: int
