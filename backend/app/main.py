from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .consultant import Detection, answer_question, summarize_detections
from .vision import decode_data_url, get_analyzer


app = FastAPI(title="Construction for Newbies AI Consultant")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FrameRequest(BaseModel):
    image: str = Field(min_length=32)
    confidence: float = Field(default=0.35, ge=0.05, le=0.95)


class DetectionPayload(BaseModel):
    label: str
    confidence: float
    box: list[float]


class ConsultRequest(BaseModel):
    question: str = Field(default="")
    detections: list[DetectionPayload] = Field(default_factory=list)
    defectTrained: bool = False


@app.get("/api/health")
def health() -> dict[str, object]:
    analyzer = get_analyzer()
    return {
        "ok": True,
        "model": analyzer.model_name,
        "defectTrained": analyzer.defect_trained,
    }


@app.post("/api/analyze-frame")
def analyze_frame(payload: FrameRequest) -> dict[str, object]:
    try:
        image = decode_data_url(payload.image)
        analyzer = get_analyzer()
        boxes = analyzer.predict(image, confidence=payload.confidence)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    detections = [
        {
            "label": box.label,
            "confidence": box.confidence,
            "box": [box.x1, box.y1, box.x2, box.y2],
        }
        for box in boxes
    ]
    summary = summarize_detections(
        [Detection(label=item["label"], confidence=item["confidence"]) for item in detections],
        defect_trained=analyzer.defect_trained,
    )
    return {
        "detections": detections,
        "summary": summary,
        "defectTrained": analyzer.defect_trained,
        "model": analyzer.model_name,
    }


@app.post("/api/consult")
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
        )
    }
