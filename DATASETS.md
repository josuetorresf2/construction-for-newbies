# Datasets

## Default Real Dataset: Ultralytics Crack Segmentation

The default training source is the Ultralytics Crack Segmentation dataset:

- Source: https://docs.ultralytics.com/datasets/segment/crack-seg/
- Direct archive: https://github.com/ultralytics/assets/releases/download/v0.0.0/crack-seg.zip
- Size noted by Ultralytics: 91.6 MB
- Images: 4,029 total
- Verified archive splits: 3,717 train, 200 validation, 112 test
- Class: `crack`
- Task: instance segmentation; Ultralytics also exposes bounding boxes through prediction results, so the current app overlay can still draw crack boxes.

Download it with:

```bash
python scripts/download_crack_data.py
```

Note: the Ultralytics documentation text lists validation/test counts as 112/200, but the current archive downloaded on July 8, 2026 contains 200 validation images and 112 test images. The downloader validates against the archive contents.

Train with:

```bash
python scripts/train_yolo.py --data datasets/crack-seg.yaml --model yolo11n-seg.pt --epochs 100 --imgsz 640
```

After training, copy the best checkpoint:

```bash
mkdir -p models
cp runs/defect-detection/yolo-crack-seg/weights/best.pt models/best.pt
```

## Default Pretrained Model

For a fully functional local app without waiting for training, this repo can download the pretrained `yolov8n` crack segmentation model from OpenSistemas:

- Source: https://huggingface.co/OpenSistemas/YOLOv8-crack-seg
- License shown on Hugging Face: AGPL-3.0
- Model path used by the app: `models/best.pt`

Download it with:

```bash
python scripts/download_pretrained_model.py
```

The model file is intentionally ignored by Git because it is a downloaded binary. The script makes the install reproducible.

## Citation

Ultralytics lists this citation for the dataset:

```bibtex
@misc{ crack-bphdr_dataset,
    title = { crack Dataset },
    type = { Open Source Dataset },
    author = { University },
    url = { https://universe.roboflow.com/university-bswxt/crack-bphdr },
    year = { 2022 },
    month = { dec },
    note = { visited on 2024-01-23 },
}
```
