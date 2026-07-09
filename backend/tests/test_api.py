from fastapi.testclient import TestClient

from backend.app.main import app


def test_health_reports_model_status() -> None:
    response = TestClient(app).get("/api/health")

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert "defectTrained" in response.json()


def test_cors_allows_local_vite_ports() -> None:
    response = TestClient(app).options(
        "/api/consult",
        headers={
            "Origin": "http://127.0.0.1:5174",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"


def test_consult_supports_spanish() -> None:
    response = TestClient(app).post(
        "/api/consult",
        json={
            "question": "Ves grietas?",
            "detections": [{"label": "crack", "confidence": 0.9, "box": [0, 0, 10, 10]}],
            "defectTrained": True,
            "language": "es",
        },
    )

    assert response.status_code == 200
    assert "posible grieta" in response.json()["answer"]
