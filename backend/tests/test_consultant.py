from backend.app.consultant import Detection, answer_question, summarize_detections


def test_summarize_elevated_crack_risk() -> None:
    summary = summarize_detections([Detection("crack", 0.88)], defect_trained=True)

    assert summary["risk"] == "elevated"
    assert summary["defectCount"] == 1
    assert summary["topLabels"] == ["crack"]


def test_consultant_refuses_to_overclaim_without_custom_model() -> None:
    answer = answer_question("Do you see cracks?", [Detection("person", 0.92)], defect_trained=False)

    assert "custom crack and structural-defect model has not been installed" in answer


def test_consultant_answers_crack_question() -> None:
    answer = answer_question("Do you see cracks?", [Detection("crack", 0.74)], defect_trained=True)

    assert "possible crack" in answer
    assert "74%" in answer


def test_consultant_answers_spanish_crack_question() -> None:
    answer = answer_question("Ves grietas?", [Detection("crack", 0.81)], defect_trained=True, language="es")

    assert "posible grieta" in answer
    assert "81%" in answer
