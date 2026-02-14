from __future__ import annotations

import os
from typing import Optional

import aiosqlite

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "nickel.db")


async def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS nickel_prices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT UNIQUE NOT NULL,
                cash_settlement REAL,
                three_month REAL,
                stock INTEGER,
                cash_change REAL,
                cash_change_pct REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_nickel_date ON nickel_prices(date DESC)"
        )
        await db.commit()


async def upsert_prices(rows: list[dict]):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executemany(
            """
            INSERT INTO nickel_prices (date, cash_settlement, three_month, stock, cash_change, cash_change_pct)
            VALUES (:date, :cash_settlement, :three_month, :stock, :cash_change, :cash_change_pct)
            ON CONFLICT(date) DO UPDATE SET
                cash_settlement = excluded.cash_settlement,
                three_month = excluded.three_month,
                stock = excluded.stock,
                cash_change = excluded.cash_change,
                cash_change_pct = excluded.cash_change_pct
            """,
            rows,
        )
        await db.commit()


async def get_prices(page: int = 1, per_page: int = 30) -> list[dict]:
    offset = (page - 1) * per_page
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM nickel_prices ORDER BY date DESC LIMIT ? OFFSET ?",
            (per_page, offset),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_latest() -> Optional[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM nickel_prices ORDER BY date DESC LIMIT 1"
        )
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_total_count() -> int:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("SELECT COUNT(*) FROM nickel_prices")
        row = await cursor.fetchone()
        return row[0]


async def get_stats() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            SELECT
                MIN(cash_settlement) as min_price,
                MAX(cash_settlement) as max_price,
                AVG(cash_settlement) as avg_price,
                MIN(date) as first_date,
                MAX(date) as last_date,
                COUNT(*) as total_records
            FROM nickel_prices
            WHERE cash_settlement IS NOT NULL
        """)
        row = await cursor.fetchone()
        return {
            "min_price": row[0],
            "max_price": row[1],
            "avg_price": round(row[2], 2) if row[2] else None,
            "first_date": row[3],
            "last_date": row[4],
            "total_records": row[5],
        }
