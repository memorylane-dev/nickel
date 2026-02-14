from pydantic import BaseModel


class PriceRecord(BaseModel):
    id: int
    date: str
    cash_settlement: float | None
    three_month: float | None
    stock: int | None
    cash_change: float | None
    cash_change_pct: float | None


class PriceListResponse(BaseModel):
    data: list[PriceRecord]
    page: int
    per_page: int
    total: int
    total_pages: int


class StatsResponse(BaseModel):
    min_price: float | None
    max_price: float | None
    avg_price: float | None
    first_date: str | None
    last_date: str | None
    total_records: int
