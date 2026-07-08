from __future__ import annotations

import argparse
from pathlib import Path

from ultralytics import YOLO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export trained YOLO weights for deployment.")
    parser.add_argument("--weights", default="models/best.pt")
    parser.add_argument("--format", default="onnx", help="Export format supported by Ultralytics, e.g. onnx, openvino, engine.")
    parser.add_argument("--imgsz", type=int, default=960)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    weights = Path(args.weights)
    if not weights.exists():
        raise SystemExit(f"Weights not found: {weights}. Train first or set --weights.")

    model = YOLO(str(weights))
    output = model.export(format=args.format, imgsz=args.imgsz)
    print(output)


if __name__ == "__main__":
    main()

