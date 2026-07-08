# Construction for Newbies

AI construction and manufacturing defect consultant for webcam or uploaded video frames. The app combines Ultralytics YOLO detection with browser voice recognition and speech synthesis so a user can ask what the camera sees and get a spoken inspection summary.

## What this repo contains

- `backend/`: FastAPI service for YOLO frame analysis and defect-consultant responses.
- `frontend/`: React/Vite app with webcam capture, live frame analysis, detection overlays, voice input, and spoken answers.
- `scripts/train_yolo.py`: custom YOLO training entrypoint for crack and structural-defect datasets.
- `scripts/export_model.py`: export a trained model to ONNX, OpenVINO, TensorRT, CoreML, and other Ultralytics-supported formats.
- `datasets/defects.yaml.example`: YOLO dataset config template.

## Dataset requirement

The actual manufacturing/construction defect dataset is not included. Place a YOLO-format detection dataset on disk and copy `datasets/defects.yaml.example` to `datasets/defects.yaml`.

Expected layout:

```text
datasets/defects/
  images/train/*.jpg
  images/val/*.jpg
  labels/train/*.txt
  labels/val/*.txt
```

Each label row uses YOLO format:

```text
class_id x_center y_center width height
```

All coordinates are normalized from 0 to 1.

## Train the defect model

```bash
cd construction-for-newbies
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
python scripts/train_yolo.py --data datasets/defects.yaml --model yolo11n.pt --epochs 80 --imgsz 960 --batch 8
```

After training, copy the best weights into the default model path:

```bash
mkdir -p models
cp runs/defect-detection/*/weights/best.pt models/best.pt
```

The backend uses `models/best.pt` when present. If it is missing, it can run a pretrained YOLO model only for smoke testing and will label the session as not defect-trained.

## Run the app

Terminal 1:

```bash
cd construction-for-newbies
source .venv/bin/activate
uvicorn backend.app.main:app --reload --port 8000
```

Terminal 2:

```bash
cd construction-for-newbies/frontend
npm install
npm run dev
```

Open the Vite URL, allow camera and microphone permissions, then ask questions like:

- "Do you see cracks?"
- "Is there a structural defect?"
- "What should I inspect next?"

## Export for edge deployment

```bash
python scripts/export_model.py --weights models/best.pt --format onnx --imgsz 960
```

## Important safety note

This app is an inspection aid, not a structural engineering certification tool. Field decisions still require qualified inspection, calibrated image capture, and validation on the exact site and defect types.

