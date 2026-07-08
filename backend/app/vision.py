from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from functools import lru_cache

import cv2
import numpy as np


DEFAULT_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "models/best.pt")
FALLBACK_MODEL = os.getenv("YOLO_FALLBACK_MODEL", "yolo11n.pt")


@dataclass(frozen=True)
class Box:
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    label: str


def decode_data_url(data_url: str) -> np.ndarray:
    if "," in data_url:
        _, encoded = data_url.split(",", 1)
    else:
        encoded = data_url
    raw = base64.b64decode(encoded)
    image_array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image frame")
    return image


class YoloAnalyzer:
    def __init__(self, model_path: str = DEFAULT_MODEL_PATH, fallback_model: str = FALLBACK_MODEL) -> None:
        self.model_path = model_path
        self.fallback_model = fallback_model
        self.defect_trained = os.path.exists(model_path)
        self._model = None

    @property
    def model_name(self) -> str:
        return self.model_path if self.defect_trained else self.fallback_model

    def _load_model(self):
        if self._model is None:
            from ultralytics import YOLO

            self._model = YOLO(self.model_name)
        return self._model

    def predict(self, image: np.ndarray, confidence: float = 0.35) -> list[Box]:
        model = self._load_model()
        results = model.predict(source=image, conf=confidence, verbose=False)
        if not results:
            return []

        result = results[0]
        names = result.names or {}
        boxes: list[Box] = []
        for item in result.boxes:
            x1, y1, x2, y2 = item.xyxy[0].tolist()
            cls_id = int(item.cls[0].item())
            boxes.append(
                Box(
                    x1=float(x1),
                    y1=float(y1),
                    x2=float(x2),
                    y2=float(y2),
                    confidence=float(item.conf[0].item()),
                    label=str(names.get(cls_id, cls_id)),
                )
            )
        return boxes


@lru_cache(maxsize=1)
def get_analyzer() -> YoloAnalyzer:
    return YoloAnalyzer()

