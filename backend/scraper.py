import re
from datetime import datetime

import httpx
from bs4 import BeautifulSoup

from backend.database import upsert_prices

URL = "https://www.westmetall.com/en/markdaten.php?action=table&field=LME_Ni_cash"


def parse_date(raw: str) -> str:
    """'13. February 2026' -> '2026-02-13'"""
    cleaned = re.sub(r"\s+", " ", raw.strip())
    dt = datetime.strptime(cleaned, "%d. %B %Y")
    return dt.strftime("%Y-%m-%d")


def parse_price(raw: str) -> float | None:
    text = raw.strip()
    if not text or text == "-":
        return None
    return float(text.replace(",", ""))


def parse_stock(raw: str) -> int | None:
    text = raw.strip()
    if not text or text == "-":
        return None
    return int(text.replace(",", ""))


async def scrape_westmetall() -> int:
    """Scrape Westmetall LME Nickel page and store in DB. Returns row count."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(URL, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")

    # First table with thead containing "date" header
    table = None
    for t in soup.find_all("table"):
        th = t.find("th")
        if th and "date" in th.get_text(strip=True).lower():
            table = t
            break

    if table is None:
        raise ValueError("Could not find price table on Westmetall page")

    tbody = table.find("tbody")
    if tbody is None:
        raise ValueError("No tbody found in price table")

    rows_data: list[dict] = []
    for tr in tbody.find_all("tr"):
        cells = tr.find_all("td")
        if len(cells) < 4:
            continue
        try:
            date = parse_date(cells[0].get_text())
            cash = parse_price(cells[1].get_text())
            three_month = parse_price(cells[2].get_text())
            stock = parse_stock(cells[3].get_text())
            rows_data.append({
                "date": date,
                "cash_settlement": cash,
                "three_month": three_month,
                "stock": stock,
                "cash_change": None,
                "cash_change_pct": None,
            })
        except (ValueError, IndexError):
            continue

    # Sort by date ascending to compute changes
    rows_data.sort(key=lambda r: r["date"])

    # Compute day-over-day change
    for i, row in enumerate(rows_data):
        if i == 0 or row["cash_settlement"] is None:
            continue
        prev = rows_data[i - 1]["cash_settlement"]
        if prev is not None and prev != 0:
            change = row["cash_settlement"] - prev
            row["cash_change"] = round(change, 2)
            row["cash_change_pct"] = round((change / prev) * 100, 2)

    if rows_data:
        await upsert_prices(rows_data)

    return len(rows_data)
