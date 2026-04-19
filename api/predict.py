"""Vercel Python serverless function for birth-weight risk prediction.

Loads the exported logistic-regression model (model.json, trained via
model/train.py) and returns the probability of low birth weight along with
the top contributing factors for the given inputs.

Endpoint: POST /api/predict
Body:    JSON of {feature_key: value, ...} using the schema in public/feature_schema.json
Returns: JSON of PredictionResult (matches the TypeScript type in lib/model.ts)
"""
from __future__ import annotations

import json
import math
import os
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

# The model JSON lives in /public so it's served statically too; we also keep a
# copy at /model/model.json for local dev. At deploy time the function runs with
# cwd at the project root.
_CANDIDATES = [
    Path(__file__).parent.parent / "public" / "model.json",
    Path(__file__).parent.parent / "model" / "model.json",
    Path("public/model.json"),
]


def _load_model() -> dict[str, Any]:
    last_err: Exception | None = None
    for p in _CANDIDATES:
        try:
            with p.open("r") as f:
                return json.load(f)
        except FileNotFoundError as e:
            last_err = e
    raise RuntimeError(f"model.json not found in {_CANDIDATES}") from last_err


_MODEL = _load_model()

_RACE_LEVELS = [
    "Unknown", "Other_Non_White", "White", "Black",
    "American_Indian", "Chinese", "Japanese",
    "Hawaiian", "Filipino",
]
_HISP_LEVELS = ["Cuban", "Mexican", "Colombian", "Peruvian", "Salvadoran", "Guatemalan"]


def _expand(ui: dict[str, Any]) -> dict[str, float]:
    out: dict[str, float] = {}
    for k, v in ui.items():
        if k in ("racemom", "racedad"):
            for lvl in _RACE_LEVELS:
                out[f"{k}{lvl}"] = 1.0 if v == lvl else 0.0
            continue
        if k in ("hispmom", "hispdad"):
            for lvl in _HISP_LEVELS:
                out[f"{k}{lvl}"] = 1.0 if v == lvl else 0.0
            continue
        try:
            out[k] = float(v)
        except (TypeError, ValueError):
            out[k] = 0.0
    return out


def _sigmoid(z: float) -> float:
    if z >= 30:
        return 1 - 1e-14
    if z <= -30:
        return 1e-14
    return 1.0 / (1.0 + math.exp(-z))


def predict(ui: dict[str, Any]) -> dict[str, Any]:
    x = _expand(ui)
    logit = float(_MODEL["intercept"])
    pretty = {c["name"]: c["pretty_name"] for c in _MODEL["coefficients_table"]}
    contribs: list[dict[str, Any]] = []

    for feat in _MODEL["features"]:
        val = x.get(feat["name"], 0.0)
        contrib = val * float(feat["coef"])
        logit += contrib
        if val != 0.0:
            contribs.append({
                "name": feat["name"],
                "pretty_name": pretty.get(feat["name"], feat["name"]),
                "contribution": contrib,
                "odds_ratio": math.exp(max(min(feat["coef"], 50), -50)),
                "value": val,
            })

    probability = _sigmoid(logit)
    contribs.sort(key=lambda c: abs(c["contribution"]), reverse=True)
    risk = "high" if probability >= 0.25 else ("moderate" if probability >= 0.1 else "low")

    return {
        "probability": probability,
        "logit": logit,
        "topContributors": contribs[:6],
        "risk": risk,
    }


# Vercel Python entrypoint: BaseHTTPRequestHandler-style handler
class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel requires this exact name
    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("content-length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            ui = json.loads(raw.decode("utf-8") or "{}")
            if not isinstance(ui, dict):
                raise ValueError("body must be a JSON object")
            result = predict(ui)
            self._send(200, result)
        except Exception as e:  # surface the error to the client for debugging
            self._send(400, {"error": str(e)})

    def do_OPTIONS(self):  # noqa: N802 — CORS preflight, handy during local dev
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.end_headers()

    def do_GET(self):  # noqa: N802 — tiny health-check
        self._send(200, {"ok": True, "metrics": _MODEL["metrics"]})

    def _send(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.send_header("access-control-allow-origin", "*")
        self.end_headers()
        self.wfile.write(body)
