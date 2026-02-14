"""Scrape Westmetall LME Nickel prices and output docs/data.json."""

import json
import os
import re
from datetime import datetime

import httpx
from bs4 import BeautifulSoup

URL = "https://www.westmetall.com/en/markdaten.php?action=table&field=LME_Ni_cash"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "docs", "data.json")


def parse_date(raw):
    cleaned = re.sub(r"\s+", " ", raw.strip())
    dt = datetime.strptime(cleaned, "%d. %B %Y")
    return dt.strftime("%Y-%m-%d")


def parse_price(raw):
    text = raw.strip()
    if not text or text == "-":
        return None
    return float(text.replace(",", ""))


def parse_stock(raw):
    text = raw.strip()
    if not text or text == "-":
        return None
    return int(text.replace(",", ""))


def main():
    resp = httpx.get(URL, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")

    tables = [
        t for t in soup.find_all("table")
        if t.find("th") and "date" in t.find("th").get_text(strip=True).lower()
    ]

    if not tables:
        raise ValueError("Could not find price tables on Westmetall page")

    rows = []
    for table in tables:
        tbody = table.find("tbody")
        if tbody is None:
            continue
        for tr in tbody.find_all("tr"):
            cells = tr.find_all("td")
            if len(cells) < 4:
                continue
            try:
                rows.append({
                    "date": parse_date(cells[0].get_text()),
                    "cash": parse_price(cells[1].get_text()),
                    "three_month": parse_price(cells[2].get_text()),
                    "stock": parse_stock(cells[3].get_text()),
                    "change": None,
                    "change_pct": None,
                })
            except (ValueError, IndexError):
                continue

    # Sort ascending by date for change calculation
    rows.sort(key=lambda r: r["date"])

    for i, row in enumerate(rows):
        if i == 0 or row["cash"] is None:
            continue
        prev = rows[i - 1]["cash"]
        if prev is not None and prev != 0:
            ch = row["cash"] - prev
            row["change"] = round(ch, 2)
            row["change_pct"] = round((ch / prev) * 100, 2)

    # Reverse so newest first
    rows.reverse()

    # Stats
    cash_values = [r["cash"] for r in rows if r["cash"] is not None]
    stats = {
        "min_price": min(cash_values) if cash_values else None,
        "max_price": max(cash_values) if cash_values else None,
        "avg_price": round(sum(cash_values) / len(cash_values), 2) if cash_values else None,
        "total_records": len(rows),
        "first_date": rows[-1]["date"] if rows else None,
        "last_date": rows[0]["date"] if rows else None,
        "updated_at": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    output = {"stats": stats, "prices": rows}

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(output, f, separators=(",", ":"))

    print(f"Wrote {len(rows)} records to {OUT_PATH}")


if __name__ == "__main__":
    main()
