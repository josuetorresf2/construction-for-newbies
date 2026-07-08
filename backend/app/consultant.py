from __future__ import annotations

from collections import Counter
from dataclasses import dataclass


DEFECT_CLASSES = {
    "crack",
    "spalling",
    "corrosion",
    "deformation",
    "exposed_rebar",
    "delamination",
    "structural_defect",
}


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float


def summarize_detections(detections: list[Detection], defect_trained: bool) -> dict[str, object]:
    if not detections:
        return {
            "risk": "clear",
            "headline": "No visible target defects were detected in this frame.",
            "defectCount": 0,
            "topLabels": [],
        }

    counts = Counter(d.label for d in detections)
    top_labels = [label for label, _ in counts.most_common(4)]
    defect_hits = [d for d in detections if d.label in DEFECT_CLASSES or defect_trained]
    high_confidence = any(d.confidence >= 0.65 for d in defect_hits)

    if defect_hits and high_confidence:
        risk = "elevated"
    elif defect_hits:
        risk = "watch"
    else:
        risk = "context"

    if risk == "elevated":
        headline = f"Possible defect detected: {', '.join(top_labels)}."
    elif risk == "watch":
        headline = f"Potential issue visible, but confidence is modest: {', '.join(top_labels)}."
    elif defect_trained:
        headline = f"Objects detected, but none are high-confidence defects: {', '.join(top_labels)}."
    else:
        headline = "The fallback model is seeing general objects, not trained defect classes."

    return {
        "risk": risk,
        "headline": headline,
        "defectCount": len(defect_hits),
        "topLabels": top_labels,
    }


def answer_question(question: str, detections: list[Detection], defect_trained: bool) -> str:
    question_text = question.lower().strip()
    summary = summarize_detections(detections, defect_trained)
    labels = ", ".join(summary["topLabels"]) if summary["topLabels"] else "no target defects"

    if not defect_trained:
        return (
            "I can run the camera pipeline, but the custom crack and structural-defect model "
            "has not been installed yet. Train the YOLO model and place it at models/best.pt "
            f"before trusting defect calls. Right now I see {labels}."
        )

    if "crack" in question_text:
        crack_hits = [d for d in detections if d.label == "crack"]
        if crack_hits:
            confidence = max(d.confidence for d in crack_hits)
            return f"Yes, I see a possible crack. Highest confidence is {confidence:.0%}. Mark the area and inspect it closer."
        return "I do not see a crack in the current frame. Move the camera slowly across joints, edges, and shadowed surfaces."

    if "structural" in question_text or "defect" in question_text:
        if summary["defectCount"]:
            return f"Yes, I see possible structural defect evidence: {labels}. Treat this as a field-inspection flag, not a final diagnosis."
        return "I do not see a structural defect in this frame. Keep scanning at a steady angle with good lighting."

    if "next" in question_text or "inspect" in question_text:
        return (
            "Inspect the highest-confidence boxes first, then rescan from another angle. "
            "Look for continuous cracks, exposed reinforcement, corrosion stains, deformation, and surface delamination."
        )

    return f"{summary['headline']} Current visible labels: {labels}."

