from __future__ import annotations

import base64
import io
import os
from collections import deque

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageFilter
from pydantic import BaseModel, Field

from backend.app.consultant import Detection, answer_question, summarize_detections


app = FastAPI(title="Construction for Newbies Online Vision API")

DEFAULT_ALLOWED_ORIGINS = [
    "https://josuetorresf2.github.io",
    "https://construction-for-newbies.vercel.app",
]

allowed_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", ",".join(DEFAULT_ALLOWED_ORIGINS)).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FrameRequest(BaseModel):
    image: str = Field(min_length=32)
    confidence: float = Field(default=0.35, ge=0.05, le=0.95)
    language: str = Field(default="en", pattern="^(en|es)$")


class DetectionPayload(BaseModel):
    label: str
    confidence: float
    box: list[float]


class ConsultRequest(BaseModel):
    question: str = Field(default="")
    detections: list[DetectionPayload] = Field(default_factory=list)
    defectTrained: bool = False
    language: str = Field(default="en", pattern="^(en|es)$")


def decode_image(data_url: str) -> Image.Image:
    encoded = data_url.split(",", 1)[1] if "," in data_url else data_url
    raw = base64.b64decode(encoded)
    return Image.open(io.BytesIO(raw)).convert("RGB")


def detect_crack_candidates(image: Image.Image, minimum_confidence: float) -> list[dict[str, object]]:
    image.thumbnail((720, 720))
    gray = image.convert("L").filter(ImageFilter.FIND_EDGES)
    edge_array = np.asarray(gray, dtype=np.uint8)
    luminance = np.asarray(image.convert("L"), dtype=np.uint8)

    dark_cutoff = min(110, max(45, int(np.percentile(luminance, 22))))
    edge_cutoff = max(42, int(np.percentile(edge_array, 88)))
    dark_mask = luminance <= dark_cutoff
    mask = dark_mask & ((edge_array >= edge_cutoff) | dark_mask)

    height, width = mask.shape
    visited = np.zeros_like(mask, dtype=bool)
    detections: list[dict[str, object]] = []

    for start_y, start_x in np.argwhere(mask):
        if visited[start_y, start_x]:
            continue

        queue: deque[tuple[int, int]] = deque([(int(start_y), int(start_x))])
        visited[start_y, start_x] = True
        points: list[tuple[int, int]] = []

        while queue and len(points) < 4200:
            y, x = queue.popleft()
            points.append((y, x))
            for next_y in range(max(0, y - 1), min(height, y + 2)):
                for next_x in range(max(0, x - 1), min(width, x + 2)):
                    if not visited[next_y, next_x] and mask[next_y, next_x]:
                        visited[next_y, next_x] = True
                        queue.append((next_y, next_x))

        if len(points) < 42:
            continue

        ys = np.array([point[0] for point in points])
        xs = np.array([point[1] for point in points])
        x1, x2 = int(xs.min()), int(xs.max())
        y1, y2 = int(ys.min()), int(ys.max())
        box_width = max(1, x2 - x1)
        box_height = max(1, y2 - y1)
        long_side = max(box_width, box_height)
        short_side = max(1, min(box_width, box_height))
        slenderness = long_side / short_side
        fill_ratio = len(points) / float(box_width * box_height)

        if long_side < 36 or slenderness < 1.65 or fill_ratio > 0.52:
            continue

        confidence = min(0.94, 0.38 + min(slenderness / 9, 0.34) + min(len(points) / 900, 0.22))
        if confidence < minimum_confidence:
            continue

        detections.append(
            {
                "label": "crack",
                "confidence": float(confidence),
                "box": [float(x1), float(y1), float(x2), float(y2)],
            }
        )

    return sorted(detections, key=lambda item: item["confidence"], reverse=True)[:6]


@app.get("/")
@app.get("/api/health")
@app.get("/health")
def health() -> dict[str, object]:
    return {
        "ok": True,
        "model": "Constructor AI online crack scan",
        "defectTrained": True,
    }


@app.post("/api/analyze-frame")
@app.post("/analyze-frame")
def analyze_frame(payload: FrameRequest) -> dict[str, object]:
    try:
        image = decode_image(payload.image)
        detections = detect_crack_candidates(image, payload.confidence)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    summary = summarize_detections(
        [Detection(label=item["label"], confidence=item["confidence"]) for item in detections],
        defect_trained=True,
        language=payload.language,
    )
    return {
        "detections": detections,
        "summary": summary,
        "defectTrained": True,
        "model": "Constructor AI online crack scan",
    }


@app.post("/api/consult")
@app.post("/consult")
def consult(payload: ConsultRequest) -> dict[str, str]:
    detections = [
        Detection(label=item.label, confidence=item.confidence)
        for item in payload.detections
    ]
    return {
        "answer": answer_question(
            payload.question,
            detections,
            defect_trained=payload.defectTrained,
            language=payload.language,
        )
    }
