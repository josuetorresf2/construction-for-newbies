import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Download,
  Home,
  ImageUp,
  Lock,
  Mic,
  MicOff,
  Newspaper,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Video,
  Volume2,
} from "lucide-react";

type Detection = {
  label: string;
  confidence: number;
  box: [number, number, number, number];
};

type Analysis = {
  detections: Detection[];
  summary: {
    risk: "clear" | "context" | "watch" | "elevated";
    headline: string;
    defectCount: number;
    topLabels: string[];
  };
  defectTrained: boolean;
  model: string;
};

type ModelHealth = {
  ok: boolean;
  model: string;
  defectTrained: boolean;
};

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

const SpeechRecognitionCtor =
  window.SpeechRecognition ?? window.webkitSpeechRecognition;

function speak(text: string) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 0.95;
  window.speechSynthesis.speak(utterance);
}

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [modelHealth, setModelHealth] = useState<ModelHealth | null>(null);
  const [question, setQuestion] = useState("Do you see cracks or structural defects?");
  const [answer, setAnswer] = useState("Start the camera or upload a surface photo, then ask about cracks.");
  const [cameraReady, setCameraReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const drawDetections = useCallback((detections: Detection[]) => {
    const overlay = overlayRef.current;
    const source = previewImage ? imageRef.current : videoRef.current;
    if (!source || !overlay) return;

    const context = overlay.getContext("2d");
    if (!context) return;

    overlay.width = previewImage && imageRef.current ? imageRef.current.naturalWidth : videoRef.current?.videoWidth ?? 0;
    overlay.height = previewImage && imageRef.current ? imageRef.current.naturalHeight : videoRef.current?.videoHeight ?? 0;
    context.clearRect(0, 0, overlay.width, overlay.height);
    context.lineWidth = 4;
    context.font = "18px Inter, system-ui";

    detections.forEach((detection) => {
      const [x1, y1, x2, y2] = detection.box;
      const color = detection.label.includes("crack") ? "#ff595e" : "#ffb23f";
      context.strokeStyle = color;
      context.fillStyle = color;
      context.strokeRect(x1, y1, x2 - x1, y2 - y1);
      const label = `${detection.label} ${(detection.confidence * 100).toFixed(0)}%`;
      const textWidth = context.measureText(label).width + 14;
      context.fillRect(x1, Math.max(0, y1 - 28), textWidth, 28);
      context.fillStyle = "#050505";
      context.fillText(label, x1 + 7, Math.max(20, y1 - 8));
    });
  }, [previewImage]);

  const startCamera = async () => {
    setPreviewImage(null);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setCameraReady(true);
    }
  };

  const analyzeImageData = useCallback(async (image: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/analyze-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, confidence: 0.35 }),
      });
      if (!response.ok) throw new Error(await response.text());
      const nextAnalysis = (await response.json()) as Analysis;
      setAnalysis(nextAnalysis);
      setAnswer(nextAnalysis.summary.headline);
      drawDetections(nextAnalysis.detections);
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Frame analysis failed.");
    } finally {
      setBusy(false);
    }
  }, [drawDetections]);

  const analyzeFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || busy) return;

    setBusy(true);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setBusy(false);
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    await analyzeImageData(canvas.toDataURL("image/jpeg", 0.82));
  }, [analyzeImageData, busy]);

  const analyzeUploadedImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = String(reader.result);
      setPreviewImage(image);
      setBusy(true);
      window.setTimeout(() => void analyzeImageData(image), 50);
    };
    reader.readAsDataURL(file);
  };

  const askConsultant = useCallback(
    async (text: string) => {
      const response = await fetch(`${API_BASE}/api/consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          detections: analysis?.detections ?? [],
          defectTrained: analysis?.defectTrained ?? modelHealth?.defectTrained ?? false,
        }),
      });
      const payload = (await response.json()) as { answer: string };
      setAnswer(payload.answer);
      speak(payload.answer);
    },
    [analysis, modelHealth]
  );

  const startListening = () => {
    if (!SpeechRecognitionCtor) {
      const message = "Voice recognition is not available in this browser. Try Chrome or Edge.";
      setAnswer(message);
      speak(message);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setQuestion(text);
      void askConsultant(text);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setInstallPrompt(null);
    }
  };

  useEffect(() => {
    if (!autoScan || !cameraReady) return;
    const id = window.setInterval(() => void analyzeFrame(), 1800);
    return () => window.clearInterval(id);
  }, [analyzeFrame, autoScan, cameraReady]);

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((response) => response.json())
      .then((payload: ModelHealth) => setModelHealth(payload))
      .catch(() => setModelHealth(null));
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const risk = analysis?.summary.risk ?? "clear";
  const defectTrained = analysis?.defectTrained ?? modelHealth?.defectTrained ?? false;
  const modelName = analysis?.model ?? modelHealth?.model ?? "checking model";
  const detectionCount = analysis?.detections.length ?? 0;
  const defectCount = analysis?.summary.defectCount ?? 0;
  const confidenceLabel = analysis?.detections[0] ? `${(analysis.detections[0].confidence * 100).toFixed(0)}%` : "ready";

  return (
    <main className="stage">
      <div className="sim-dot" />
      <section className="sim-shell" aria-label="Constructor AI simulator">
        <div className="sim-window">
          <div className="window-lights" aria-hidden="true">
            <span className="red" />
            <span className="yellow" />
            <span className="green" />
          </div>
          <div className="window-title">
            <strong>ConstructorAI-iPhone-17-Pro</strong>
            <span>inspection OS 1.0</span>
          </div>
          <div className="window-actions">
            <button aria-label="Home"><Home size={18} /></button>
            <button aria-label="Camera" onClick={startCamera}><Camera size={18} /></button>
            <button aria-label="Install app" onClick={() => void installApp()} disabled={!installPrompt || installed}>
              <Download size={18} />
            </button>
          </div>
        </div>

        <div className="phone-frame">
          <div className="phone-side left-top" />
          <div className="phone-side left-mid" />
          <div className="phone-side right-mid" />
          <div className="phone-screen">
            <div className="statusbar">
              <strong>4:56</strong>
              <span>••••</span>
              <span className="wifi">⌁</span>
              <span className="battery" />
            </div>

            <button className="refresh-float" aria-label="Analyze current frame" onClick={() => void analyzeFrame()} disabled={!cameraReady || busy}>
              <RefreshCw size={22} />
            </button>

            <div className="glass-menu">
              <button className="menu-row active" onClick={() => void askConsultant("Do you see cracks?")}>
                <CheckCircle2 size={17} />
                <span>Mesh</span>
              </button>
              <label className="menu-row file-row">
                <Newspaper size={17} />
                <span>Feed</span>
                <input type="file" accept="image/*" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) analyzeUploadedImage(file);
                  event.currentTarget.value = "";
                }} />
              </label>
              <button className="menu-row" onClick={startCamera}>
                <Users size={18} />
                <span>Crowd</span>
              </button>
              <button className="menu-row" onClick={() => void analyzeFrame()} disabled={!cameraReady || busy}>
                <Video size={18} />
                <span>Live</span>
              </button>
              <label className="menu-row toggle-row">
                <SlidersHorizontal size={18} />
                <span>Control</span>
                <input type="checkbox" checked={autoScan} onChange={(event) => setAutoScan(event.target.checked)} />
              </label>
            </div>

            <div className={`lens-card ${cameraReady || previewImage ? "active" : "idle"}`}>
              <div className="video-wrap">
                {previewImage ? (
                  <img ref={imageRef} src={previewImage} alt="Uploaded inspection target" onLoad={() => drawDetections(analysis?.detections ?? [])} />
                ) : (
                  <video ref={videoRef} playsInline muted />
                )}
                <canvas ref={overlayRef} className="overlay" />
                {!cameraReady && !previewImage && (
                  <button className="start-camera" onClick={startCamera}>
                    <Camera size={18} /> Start camera
                  </button>
                )}
              </div>
              <canvas ref={canvasRef} hidden />
              <div className={`lens-chip ${risk}`}>
                <ShieldAlert size={14} />
                <span>{defectTrained ? "crack model online" : "smoke-test mode"}</span>
              </div>
            </div>

            <div className="chat-stream">
              <div className="chat-row ai">
                <div className="avatar blue">AI</div>
                <p>model loaded: {modelName}</p>
              </div>
              <div className="chat-row user">
                <p>{question}</p>
                <div className="avatar face">JT</div>
              </div>
              <div className="chat-row ai named">
                <div className="avatar gray">C</div>
                <div>
                  <span className="sender">Crackline</span>
                  <p>{answer}</p>
                </div>
              </div>
              <div className="chat-row ai named">
                <div className="avatar crimson">R</div>
                <div>
                  <span className="sender">Risk mesh</span>
                  <p>{defectCount ? `${defectCount} defect flag${defectCount === 1 ? "" : "s"} visible` : "no defect flag in the current frame"}</p>
                </div>
              </div>
              <div className="chat-row user compact">
                <p>{detectionCount ? `${detectionCount} detections / ${confidenceLabel}` : "ready"}</p>
                <div className="avatar face">JT</div>
              </div>
            </div>

            <div className="composer">
              <input value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Ask Constructor AI" />
              <div className="composer-actions">
                <button aria-label="Upload image" className="round-button add" type="button">
                  <label>
                    <Plus size={18} />
                    <input type="file" accept="image/*" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) analyzeUploadedImage(file);
                      event.currentTarget.value = "";
                    }} />
                  </label>
                </button>
                <button aria-label="Analyze frame" className="round-button" onClick={() => void analyzeFrame()} disabled={!cameraReady || busy}>
                  <Play size={17} />
                </button>
                <button aria-label="Lock" className="round-button" type="button">
                  <Lock size={16} />
                </button>
                <button aria-label="Voice" className="round-button mic" onClick={startListening} disabled={listening}>
                  {listening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
                <button aria-label="Ask" className="round-button send" onClick={() => void askConsultant(question)}>
                  <Send size={17} />
                </button>
                <button aria-label="Speak answer" className="round-button" onClick={() => speak(answer)}>
                  <Volume2 size={17} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
