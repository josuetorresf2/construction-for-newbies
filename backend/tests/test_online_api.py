import base64
import io

from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from api.index import app


def make_crack_image() -> str:
    image = Image.new("RGB", (180, 120), "white")
    draw = ImageDraw.Draw(image)
    draw.line([(20, 24), (70, 52), (118, 50), (164, 90)], fill="black", width=4)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def test_online_health_reports_ready() -> None:
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_online_analyze_frame_returns_detection_shape() -> None:
    response = TestClient(app).post(
        "/api/analyze-frame",
        json={"image": make_crack_image(), "confidence": 0.25, "language": "en"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["detections"]
    assert payload["detections"][0]["label"] == "crack"
    assert payload["summary"]["risk"] in {"watch", "elevated"}
