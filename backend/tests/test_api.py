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

