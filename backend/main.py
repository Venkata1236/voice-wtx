from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from loguru import logger
import uvicorn
import os
from dotenv import load_dotenv

from api.routes import auth, copy, compare, forge, brands, kb, insights, export
from api.routes.kb import feature_flags_router

load_dotenv()

# ── Lifespan ──────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("VOICE backend starting up...")
    yield
    logger.info("VOICE backend shutting down...")

# ── App ───────────────────────────────────────────────────────────
app = FastAPI(
    title="VOICE API",
    description="WTX India AI Copywriting Platform",
    version="1.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(copy.router)
app.include_router(compare.router)
app.include_router(forge.router)
app.include_router(brands.router)
app.include_router(kb.router)
app.include_router(insights.router)
app.include_router(export.router)
app.include_router(feature_flags_router)

# ── Health Check ──────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "app": os.getenv("APP_NAME", "VOICE"),
        "env": os.getenv("APP_ENV", "development"),
    }

# ── Entry Point ───────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("APP_PORT", 8000)),
        reload=True,
    )