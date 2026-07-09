from __future__ import annotations

import argparse
import urllib.request
from pathlib import Path


MODEL_URLS = {
    "yolov8n-crack-seg": "https://huggingface.co/OpenSistemas/YOLOv8-crack-seg/resolve/main/yolov8n/weights/best.pt",
    "yolov8s-crack-seg": "https://huggingface.co/OpenSistemas/YOLOv8-crack-seg/resolve/main/yolov8s/weights/best.pt",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download a pretrained crack-segmentation YOLO model.")
    parser.add_argument("--model", choices=MODEL_URLS, default="yolov8n-crack-seg")
    parser.add_argument("--output", default="models/best.pt")
    parser.add_argument("--force", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    if output.exists() and not args.force:
        print(f"Using existing model: {output}")
        return

    url = MODEL_URLS[args.model]
    print(f"Downloading {args.model} from {url}")
    urllib.request.urlretrieve(url, output)
    print(f"Model ready: {output} ({output.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()

