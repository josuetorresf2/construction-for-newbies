from __future__ import annotations

import argparse
import shutil
import urllib.request
import zipfile
from pathlib import Path


DATASET_URL = "https://github.com/ultralytics/assets/releases/download/v0.0.0/crack-seg.zip"
EXPECTED_COUNTS = {
    "images/train": 3717,
    "images/val": 200,
    "images/test": 112,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Download the real Ultralytics crack segmentation dataset.")
    parser.add_argument("--url", default=DATASET_URL)
    parser.add_argument("--output", default="datasets/crack-seg")
    parser.add_argument("--zip-path", default="datasets/crack-seg.zip")
    parser.add_argument("--force", action="store_true", help="Replace an existing extracted dataset.")
    return parser.parse_args()


def download(url: str, zip_path: Path) -> None:
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    if zip_path.exists():
        print(f"Using existing archive: {zip_path}")
        return
    print(f"Downloading {url}")
    urllib.request.urlretrieve(url, zip_path)


def extract(zip_path: Path, output_dir: Path, force: bool) -> None:
    if output_dir.exists() and force:
        shutil.rmtree(output_dir)
    if output_dir.exists():
        print(f"Using existing extracted dataset: {output_dir}")
        return

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    temp_dir = output_dir.parent / "_crack_seg_extract"
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(temp_dir)

    nested = temp_dir / "crack-seg"
    if nested.exists():
        nested.rename(output_dir)
    elif (temp_dir / "images").exists() and (temp_dir / "labels").exists():
        output_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(temp_dir / "images"), output_dir / "images")
        shutil.move(str(temp_dir / "labels"), output_dir / "labels")
    else:
        raise SystemExit("Could not find images/ and labels/ in extracted crack dataset archive.")

    shutil.rmtree(temp_dir)


def count_images(dataset_dir: Path) -> dict[str, int]:
    counts: dict[str, int] = {}
    for split in EXPECTED_COUNTS:
        split_dir = dataset_dir / split
        counts[split] = len([path for path in split_dir.glob("*") if path.suffix.lower() in {".jpg", ".jpeg", ".png"}])
    return counts


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output)
    zip_path = Path(args.zip_path)

    download(args.url, zip_path)
    extract(zip_path, output_dir, args.force)
    counts = count_images(output_dir)

    print("Dataset ready:")
    for split, count in counts.items():
        expected = EXPECTED_COUNTS[split]
        status = "ok" if count == expected else f"expected {expected}"
        print(f"  {split}: {count} ({status})")

    if any(counts[split] != expected for split, expected in EXPECTED_COUNTS.items()):
        raise SystemExit("Dataset count check failed.")


if __name__ == "__main__":
    main()
