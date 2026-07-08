import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Mic, MicOff, Play, ShieldAlert, Volume2 } from "lucide-react";

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [question, setQuestion] = useState("Do you see cracks or structural defects?");
  const [answer, setAnswer] = useState("Start the camera, then ask about cracks, defects, or next inspection steps.");
  const [cameraReady, setCameraReady] = useState(false);
  const [listening, setListening] = useState(false);
  const [autoScan, setAutoScan] = useState(false);
  const [busy, setBusy] = useState(false);

  const drawDetections = useCallback((detections: Detection[]) => {
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (!video || !overlay) return;

    const context = overlay.getContext("2d");
    if (!context) return;

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    context.clearRect(0, 0, overlay.width, overlay.height);
    context.lineWidth = 4;
    context.font = "18px Inter, system-ui";

    detections.forEach((detection) => {
      const [x1, y1, x2, y2] = detection.box;
      const color = detection.label.includes("crack") ? "#ff4d4d" : "#f8c537";
      context.strokeStyle = color;
      context.fillStyle = color;
      context.strokeRect(x1, y1, x2 - x1, y2 - y1);
      const label = `${detection.label} ${(detection.confidence * 100).toFixed(0)}%`;
      const textWidth = context.measureText(label).width + 14;
      context.fillRect(x1, Math.max(0, y1 - 28), textWidth, 28);
      context.fillStyle = "#101114";
      context.fillText(label, x1 + 7, Math.max(20, y1 - 8));
    });
  }, []);

  const startCamera = async () => {
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

  const analyzeFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || busy) return;

    setBusy(true);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.82);

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
  }, [busy, drawDetections]);

  const askConsultant = useCallback(
    async (text: string) => {
      const response = await fetch(`${API_BASE}/api/consult`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: text,
          detections: analysis?.detections ?? [],
          defectTrained: analysis?.defectTrained ?? false,
        }),
      });
      const payload = (await response.json()) as { answer: string };
      setAnswer(payload.answer);
      speak(payload.answer);
    },
    [analysis]
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

  useEffect(() => {
    if (!autoScan || !cameraReady) return;
    const id = window.setInterval(() => void analyzeFrame(), 1800);
    return () => window.clearInterval(id);
  }, [analyzeFrame, autoScan, cameraReady]);

  const risk = analysis?.summary.risk ?? "clear";

  return (
    <main>
      <section className="workspace">
        <div className="camera-panel">
          <div className="video-wrap">
            <video ref={videoRef} playsInline muted />
            <canvas ref={overlayRef} className="overlay" />
            {!cameraReady && (
              <button className="start-camera" onClick={startCamera}>
                <Camera size={22} /> Start camera
              </button>
            )}
          </div>
          <canvas ref={canvasRef} hidden />
          <div className="toolbar">
            <button onClick={() => void analyzeFrame()} disabled={!cameraReady || busy}>
              <Play size={18} /> Analyze frame
            </button>
            <label className="switch">
              <input type="checkbox" checked={autoScan} onChange={(event) => setAutoScan(event.target.checked)} />
              <span>Live scan</span>
            </label>
            <button onClick={startListening} disabled={listening}>
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
              {listening ? "Listening" : "Ask by voice"}
            </button>
          </div>
        </div>

        <aside className="consultant">
          <div className={`status ${risk}`}>
            <ShieldAlert size={22} />
            <div>
              <strong>{analysis?.summary.headline ?? "Camera inspection consultant"}</strong>
              <span>
                {analysis?.defectTrained
                  ? `Custom model active: ${analysis.model}`
                  : "Custom defect model missing. Running in smoke-test mode."}
              </span>
            </div>
          </div>

          <div className="ask-box">
            <input value={question} onChange={(event) => setQuestion(event.target.value)} />
            <button onClick={() => void askConsultant(question)}>Ask</button>
          </div>

          <div className="answer">
            <button className="icon-button" aria-label="Speak answer" onClick={() => speak(answer)}>
              <Volume2 size={18} />
            </button>
            <p>{answer}</p>
          </div>

          <div className="metrics">
            <div>
              <span>Defect flags</span>
              <strong>{analysis?.summary.defectCount ?? 0}</strong>
            </div>
            <div>
              <span>Detections</span>
              <strong>{analysis?.detections.length ?? 0}</strong>
            </div>
          </div>

          <div className="detections">
            {(analysis?.detections ?? []).slice(0, 6).map((detection, index) => (
              <div key={`${detection.label}-${index}`}>
                <span>{detection.label}</span>
                <meter min={0} max={1} value={detection.confidence} />
                <strong>{(detection.confidence * 100).toFixed(0)}%</strong>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}

export default App;

