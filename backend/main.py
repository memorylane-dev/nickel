from __future__ import annotations

import logging
import math
from contextlib import asynccontextmanager
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Query
from fastapi.staticfiles import StaticFiles

from backend.database import get_latest, get_prices, get_stats, get_total_count, init_db
from backend.models import PriceListResponse, PriceRecord, StatsResponse
from backend.scraper import scrape_westmetall

logger = logging.getLogger("coal")


async def run_scrape():
    try:
        count = await scrape_westmetall()
        logger.info("Scrape complete: %d rows", count)
    except Exception:
        logger.exception("Scrape failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await run_scrape()
    scheduler = AsyncIOScheduler()
    scheduler.add_job(run_scrape, "cron", hour=18, minute=0)  # 18:00 UTC
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Coal - Nickel Price Dashboard", lifespan=lifespan)


@app.get("/api/prices", response_model=PriceListResponse)
async def api_prices(
    page: int = Query(1, ge=1),
    per_page: int = Query(30, ge=1, le=100),
):
    data = await get_prices(page, per_page)
    total = await get_total_count()
    return PriceListResponse(
        data=[PriceRecord(**row) for row in data],
        page=page,
        per_page=per_page,
        total=total,
        total_pages=math.ceil(total / per_page) if total else 0,
    )


@app.get("/api/prices/latest", response_model=Optional[PriceRecord])
async def api_latest():
    row = await get_latest()
    return PriceRecord(**row) if row else None


@app.get("/api/prices/stats", response_model=StatsResponse)
async def api_stats():
    stats = await get_stats()
    return StatsResponse(**stats)


@app.post("/api/scrape")
async def api_scrape():
    count = await scrape_westmetall()
    return {"status": "ok", "rows": count}


app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
