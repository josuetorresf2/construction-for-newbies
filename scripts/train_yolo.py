from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train YOLO on a construction/manufacturing defect dataset.")
    parser.add_argument("--data", default="datasets/crack-seg.yaml", help="Path to YOLO dataset YAML.")
    parser.add_argument("--model", default="yolo11n-seg.pt", help="Base model or checkpoint.")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default=None, help="Device string such as 0, cpu, or mps.")
    parser.add_argument("--project", default="runs/defect-detection")
    parser.add_argument("--name", default="yolo-crack-seg")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    data_path = Path(args.data)
    if not data_path.exists():
        raise SystemExit(f"Dataset YAML not found: {data_path}. Copy datasets/defects.yaml.example and update paths.")

    model = YOLO(args.model)
    model.train(
        data=str(data_path),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        project=args.project,
        name=args.name,
        patience=20,
        plots=True,
    )


if __name__ == "__main__":
    main()
