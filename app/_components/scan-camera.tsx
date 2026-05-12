"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, X, Loader2 } from "lucide-react";
import { capturePhoto } from "@/lib/actions/capture-photo";
import { startCamera, stopCamera } from "@/lib/camera/camera";
import {
  imageDataToTensor,
  infer,
  isUsingWebGPU,
  loadModel,
  type LoadProgress,
} from "@/lib/camera/inference";
import {
  computeLetterbox,
  decode,
  unletterbox,
  type LetterboxParams,
  type SourceBox,
} from "@/lib/camera/decode";
import { combine, scoreROI, type QualityScores } from "@/lib/camera/quality";

type Phase = "idle" | "loading" | "running" | "error";
type TipLevel = "info" | "good" | "warn" | "bad";

interface Drawable extends SourceBox {
  quality: number;
  scores: QualityScores;
}

const SCORE_THRESHOLD = 0.08;
const GUIDE = { xFrac: 0.1, yFrac: 0.15, wFrac: 0.8, hFrac: 0.7 };
const BOX_EMA_ALPHA = 0.45;
const Q_EMA_ALPHA = 0.35;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function qualityColor(score: number): string {
  const hue = Math.round(Math.max(0, Math.min(1, score)) * 120);
  return `hsl(${hue}, 75%, 55%)`;
}

function drawCornerBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  lineWidth = 3,
) {
  const cl = Math.min(22, w / 3, h / 3);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x, y + cl);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cl, y);
  ctx.moveTo(x + w - cl, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cl);
  ctx.moveTo(x + w, y + h - cl);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - cl, y + h);
  ctx.moveTo(x + cl, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - cl);
  ctx.stroke();
}

function computeTip(
  items: Drawable[],
  videoW: number,
  videoH: number,
): { msg: string; level: TipLevel } {
  if (items.length === 0) {
    return { msg: "Point the camera at the meter", level: "info" };
  }
  const top = items[0];
  const frameArea = videoW * videoH;
  const areaFrac = (top.w * top.h) / Math.max(1, frameArea);
  if (areaFrac < 0.05) return { msg: "Move closer to the meter", level: "warn" };
  if (areaFrac > 0.75)
    return { msg: "Step back — meter fills the frame", level: "warn" };
  const s = top.scores;
  if (s.sharpness < 0.3)
    return { msg: "Hold steady — meter is blurry", level: "bad" };
  if (s.exposure < 0.4)
    return { msg: "Adjust lighting — exposure is off", level: "warn" };
  if (s.contrast < 0.25)
    return { msg: "Low contrast — improve lighting", level: "warn" };
  if (top.quality > 0.65) return { msg: "Good shot — capture now", level: "good" };
  return { msg: "Hold steady — adjusting…", level: "info" };
}

export interface ScanCameraProps {
  unitMeterId: string;
  unitId: string;
  unitLabel: string;
  meterType: "water" | "gas" | "electric";
  unitOfMeasure: string;
  /** How many meters of this type still need a capture this cycle, including current. */
  remaining: number;
  /** When set, after a successful capture we auto-advance to /scan?type=X. */
  progressionType: "water" | "gas" | "electric";
}

export function ScanCamera({
  unitMeterId,
  unitId: _unitId,
  unitLabel,
  meterType,
  unitOfMeasure,
  remaining,
  progressionType,
}: ScanCameraProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const lastQualityRef = useRef(0);
  const lastGpsRef = useRef<{
    lat: number;
    lng: number;
    accuracy: number;
  } | null>(null);

  const modelCanvasRef = useRef<OffscreenCanvas | null>(null);
  const modelCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null);
  const roiCanvasRef = useRef<OffscreenCanvas | null>(null);
  const roiCtxRef = useRef<OffscreenCanvasRenderingContext2D | null>(null);

  const smoothBoxRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const smoothQualityRef = useRef(0);
  const detectedHoldRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<string>("");
  const [fpsLabel, setFpsLabel] = useState<string>("");
  const [tip, setTip] = useState<{ msg: string; level: TipLevel }>({
    msg: "Point the camera at the meter",
    level: "info",
  });
  const [scores, setScores] = useState<QualityScores | null>(null);
  const [overall, setOverall] = useState<number>(0);
  const [detected, setDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [captureDone, setCaptureDone] = useState(false);

  const syncOverlaySize = useCallback(() => {
    const videoEl = videoRef.current;
    const overlayEl = overlayRef.current;
    if (!videoEl || !overlayEl) return;
    const rect = videoEl.getBoundingClientRect();
    overlayEl.style.width = `${rect.width}px`;
    overlayEl.style.height = `${rect.height}px`;
    const dpr = window.devicePixelRatio || 1;
    overlayEl.width = Math.round(rect.width * dpr);
    overlayEl.height = Math.round(rect.height * dpr);
  }, []);

  const drawOverlay = useCallback((items: Drawable[]) => {
    const overlayEl = overlayRef.current;
    const videoEl = videoRef.current;
    if (!overlayEl || !videoEl) return;
    const ctx = overlayEl.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const cssW = overlayEl.width / dpr;
    const cssH = overlayEl.height / dpr;
    const sx = cssW / videoEl.videoWidth;
    const sy = cssH / videoEl.videoHeight;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.font = "600 13px var(--font-sans), system-ui, sans-serif";
    ctx.textBaseline = "top";

    for (const item of items) {
      const x = item.x * sx;
      const y = item.y * sy;
      const w = item.w * sx;
      const h = item.h * sy;
      const color = qualityColor(item.quality);

      ctx.fillStyle = color
        .replace("hsl(", "hsla(")
        .replace(")", ", 0.08)");
      ctx.fillRect(x, y, w, h);

      drawCornerBrackets(ctx, x, y, w, h, color, 3);

      const label = `${(item.quality * 100).toFixed(0)}%`;
      const padX = 8;
      const padY = 4;
      const labelW = ctx.measureText(label).width + padX * 2;
      const labelH = 22;
      const labelY = Math.max(0, y - labelH - 4);
      ctx.fillStyle = color;
      const r = 4;
      ctx.beginPath();
      ctx.moveTo(x + r, labelY);
      ctx.lineTo(x + labelW - r, labelY);
      ctx.quadraticCurveTo(x + labelW, labelY, x + labelW, labelY + r);
      ctx.lineTo(x + labelW, labelY + labelH - r);
      ctx.quadraticCurveTo(
        x + labelW,
        labelY + labelH,
        x + labelW - r,
        labelY + labelH,
      );
      ctx.lineTo(x + r, labelY + labelH);
      ctx.quadraticCurveTo(x, labelY + labelH, x, labelY + labelH - r);
      ctx.lineTo(x, labelY + r);
      ctx.quadraticCurveTo(x, labelY, x + r, labelY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "white";
      ctx.fillText(label, x + padX, labelY + padY + 1);
    }
  }, []);

  const extractFrameTo640 = useCallback((lb: LetterboxParams): ImageData => {
    const videoEl = videoRef.current!;
    const ctx = modelCtxRef.current!;
    ctx.fillStyle = "rgb(114,114,114)";
    ctx.fillRect(0, 0, 640, 640);
    ctx.drawImage(
      videoEl,
      lb.padX,
      lb.padY,
      videoEl.videoWidth * lb.scale,
      videoEl.videoHeight * lb.scale,
    );
    return ctx.getImageData(0, 0, 640, 640);
  }, []);

  const cropROI = useCallback((box: SourceBox): ImageData | null => {
    const videoEl = videoRef.current!;
    const canvas = roiCanvasRef.current!;
    const ctx = roiCtxRef.current!;
    const x = Math.max(0, Math.round(box.x));
    const y = Math.max(0, Math.round(box.y));
    const w = Math.min(videoEl.videoWidth - x, Math.round(box.w));
    const h = Math.min(videoEl.videoHeight - y, Math.round(box.h));
    if (w < 8 || h < 8) return null;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(videoEl, x, y, w, h, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }, []);

  const boxCenterInGuide = useCallback((box: SourceBox): boolean => {
    const videoEl = videoRef.current!;
    const vw = videoEl.videoWidth;
    const vh = videoEl.videoHeight;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    return (
      cx >= GUIDE.xFrac * vw &&
      cx <= (GUIDE.xFrac + GUIDE.wFrac) * vw &&
      cy >= GUIDE.yFrac * vh &&
      cy <= (GUIDE.yFrac + GUIDE.hFrac) * vh
    );
  }, []);

  const loop = useCallback(async () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const fpsState = { frames: 0, lastT: performance.now(), fps: 0 };

    while (runningRef.current) {
      if (videoEl.readyState >= 2) {
        const lb = computeLetterbox(videoEl.videoWidth, videoEl.videoHeight, 640);
        const frameImage = extractFrameTo640(lb);
        const tensor = imageDataToTensor(frameImage);
        const output = await infer(tensor);
        const dets = decode(output, SCORE_THRESHOLD);

        let best: SourceBox | null = null;
        let bestArea = 0;
        for (const d of dets) {
          const box = unletterbox(d, lb);
          if (box.w < 8 || box.h < 8) continue;
          if (!boxCenterInGuide(box)) continue;
          const area = box.w * box.h;
          if (area > bestArea) {
            best = box;
            bestArea = area;
          }
        }

        const items: Drawable[] = [];
        if (best) {
          const roi = cropROI(best);
          if (roi) {
            const s = scoreROI(roi);
            const rawQuality = combine(s);
            const sb = smoothBoxRef.current;
            if (!sb) {
              smoothBoxRef.current = {
                x: best.x,
                y: best.y,
                w: best.w,
                h: best.h,
              };
              smoothQualityRef.current = rawQuality;
            } else {
              sb.x = lerp(sb.x, best.x, BOX_EMA_ALPHA);
              sb.y = lerp(sb.y, best.y, BOX_EMA_ALPHA);
              sb.w = lerp(sb.w, best.w, BOX_EMA_ALPHA);
              sb.h = lerp(sb.h, best.h, BOX_EMA_ALPHA);
              smoothQualityRef.current = lerp(
                smoothQualityRef.current,
                rawQuality,
                Q_EMA_ALPHA,
              );
            }
            items.push({
              ...best,
              x: smoothBoxRef.current!.x,
              y: smoothBoxRef.current!.y,
              w: smoothBoxRef.current!.w,
              h: smoothBoxRef.current!.h,
              quality: smoothQualityRef.current,
              scores: s,
            });
          }
        } else {
          smoothBoxRef.current = null;
          smoothQualityRef.current = 0;
        }

        // Debounced detection status
        if (items.length > 0) {
          detectedHoldRef.current = 8;
        } else if (detectedHoldRef.current > 0) {
          detectedHoldRef.current--;
        }

        drawOverlay(items);
        setDetected(detectedHoldRef.current > 0);
        if (items.length > 0) {
          setScores(items[0].scores);
          setOverall(items[0].quality);
          lastQualityRef.current = items[0].quality;
        } else {
          setScores(null);
          setOverall(0);
          lastQualityRef.current = 0;
        }
        const t = computeTip(items, videoEl.videoWidth, videoEl.videoHeight);
        setTip(t);

        fpsState.frames++;
        const now = performance.now();
        if (now - fpsState.lastT > 1000) {
          fpsState.fps = (fpsState.frames * 1000) / (now - fpsState.lastT);
          fpsState.frames = 0;
          fpsState.lastT = now;
          const ep = isUsingWebGPU() ? "WebGPU" : "WASM";
          setFpsLabel(`${fpsState.fps.toFixed(1)} FPS · ${ep}`);
        }
      }
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
    }
  }, [boxCenterInGuide, cropROI, drawOverlay, extractFrameTo640]);

  const handleStart = useCallback(async () => {
    setError(null);
    setPhase("loading");
    setLoadStatus("Requesting camera permission…");

    try {
      const videoEl = videoRef.current!;
      await startCamera(videoEl);
      if (!videoEl.videoWidth) {
        await new Promise<void>((resolve) => {
          videoEl.addEventListener("loadedmetadata", () => resolve(), {
            once: true,
          });
        });
      }
      syncOverlaySize();

      // Init offscreen canvases (must be done client-side)
      if (!modelCanvasRef.current) {
        modelCanvasRef.current = new OffscreenCanvas(640, 640);
        modelCtxRef.current = modelCanvasRef.current.getContext("2d", {
          willReadFrequently: true,
        });
      }
      if (!roiCanvasRef.current) {
        roiCanvasRef.current = new OffscreenCanvas(1, 1);
        roiCtxRef.current = roiCanvasRef.current.getContext("2d", {
          willReadFrequently: true,
        });
      }

      await loadModel("/model.onnx", (p: LoadProgress) => {
        if (p.phase === "fetch") {
          const mb = (p.loaded / 1e6).toFixed(1);
          const pct = p.total > 0 ? Math.floor((p.loaded / p.total) * 100) : 0;
          setLoadStatus(
            p.total > 0
              ? `Downloading model… ${pct}% (${mb} MB)`
              : `Downloading model… ${mb} MB`,
          );
        } else if (p.phase === "session") {
          setLoadStatus(
            `Compiling model on ${isUsingWebGPU() ? "WebGPU" : "WASM"}…`,
          );
        } else if (p.phase === "warmup") {
          setLoadStatus("Warming up…");
        }
      });

      setPhase("running");
      runningRef.current = true;
      loop();

      // Best-effort GPS lookup once camera is live. Silently ignore denial —
      // GPS is forensic-only; capture still works without it.
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lastGpsRef.current = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            };
          },
          () => {
            /* user denied or unavailable — fine */
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
        );
      }
    } catch (err) {
      console.error(err);
      setError((err as Error).message);
      setPhase("error");
    }
  }, [loop, syncOverlaySize]);

  const handleCapture = useCallback(async () => {
    const videoEl = videoRef.current;
    if (!videoEl || videoEl.readyState < 2) return;
    if (capturing) return;

    setCaptureError(null);
    setCapturing(true);

    try {
      // Snapshot the current frame to a JPEG blob at source resolution.
      const snapCanvas = new OffscreenCanvas(
        videoEl.videoWidth,
        videoEl.videoHeight,
      );
      const ctx = snapCanvas.getContext("2d");
      if (!ctx) throw new Error("Snapshot context unavailable");
      ctx.drawImage(videoEl, 0, 0);
      const blob = await snapCanvas.convertToBlob({
        type: "image/jpeg",
        quality: 0.85,
      });

      const fd = new FormData();
      fd.append("unit_meter_id", unitMeterId);
      fd.append("photo", blob, "capture.jpg");
      fd.append("quality_score", lastQualityRef.current.toFixed(4));
      fd.append("user_agent", navigator.userAgent);
      const gps = lastGpsRef.current;
      if (gps) {
        fd.append("gps_lat", gps.lat.toString());
        fd.append("gps_lng", gps.lng.toString());
        fd.append("gps_accuracy_m", gps.accuracy.toString());
      }

      const result = await capturePhoto(fd);
      if (!result.ok) {
        setCaptureError(result.error);
        setCapturing(false);
        return;
      }

      setCaptureDone(true);
      // Stop the loop and camera, then advance to the next pending meter.
      runningRef.current = false;
      stopCamera(videoEl);
      // Quick "captured" affordance, then auto-advance.
      setTimeout(() => {
        router.replace(`/scan?type=${progressionType}`);
        router.refresh();
      }, 700);
    } catch (err) {
      console.error(err);
      setCaptureError((err as Error).message ?? "Capture failed");
      setCapturing(false);
    }
  }, [capturing, progressionType, router, unitMeterId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (videoRef.current) {
        stopCamera(videoRef.current);
      }
    };
  }, []);

  // Pause when tab hidden
  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) {
        runningRef.current = false;
      } else if (videoRef.current?.srcObject && phase === "running") {
        runningRef.current = true;
        loop();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [loop, phase]);

  // Resync overlay on resize
  useEffect(() => {
    window.addEventListener("resize", syncOverlaySize);
    return () => window.removeEventListener("resize", syncOverlaySize);
  }, [syncOverlaySize]);

  return (
    <div className="relative flex flex-1 flex-col bg-black text-white">
      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-4">
        <Link
          href="/read"
          aria-label="Close scanner"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition-colors hover:bg-black/70"
        >
          <X className="size-5" aria-hidden />
        </Link>
        <div className="flex-1 rounded-2xl bg-black/55 px-3 py-2 text-center text-xs leading-tight text-white backdrop-blur">
          <p className="font-semibold capitalize">
            {meterType} meter · {unitLabel}
          </p>
          <p className="text-white/70">
            {unitOfMeasure} · {remaining} left
          </p>
        </div>
        {phase === "running" && fpsLabel ? (
          <span className="hidden rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur sm:inline">
            {fpsLabel}
          </span>
        ) : null}
      </div>

      {/* Video + overlay always mounted (refs available before start) */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover ${phase === "running" ? "" : "hidden"}`}
        />
        <canvas
          ref={overlayRef}
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${phase === "running" ? "" : "hidden"}`}
        />

        {/* Guide rect when running */}
        {phase === "running" ? (
          <div
            aria-hidden
            className={`pointer-events-none absolute rounded-2xl border-2 border-dashed transition-colors ${
              detected ? "border-primary" : "border-white/60"
            }`}
            style={{
              top: `${GUIDE.yFrac * 100}%`,
              left: `${GUIDE.xFrac * 100}%`,
              width: `${GUIDE.wFrac * 100}%`,
              height: `${GUIDE.hFrac * 100}%`,
            }}
          />
        ) : null}

        {/* Idle state */}
        {phase === "idle" ? (
          <div className="flex flex-col items-center gap-6 px-8 text-center">
            <div className="flex size-24 items-center justify-center rounded-3xl bg-white/10 text-white">
              <Camera className="size-12" strokeWidth={2} aria-hidden />
            </div>
            <div className="flex max-w-xs flex-col gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Scan a meter
              </h1>
              <p className="text-base leading-relaxed text-white/70">
                Point the camera at a meter to read its quality in real time.
              </p>
            </div>
            <button
              type="button"
              onClick={handleStart}
              className="flex items-center gap-3 rounded-2xl bg-primary px-6 py-4 text-base font-semibold text-ink shadow-sm transition-colors hover:bg-primary-hover"
            >
              <Camera className="size-5" aria-hidden />
              Start camera
            </button>
          </div>
        ) : null}

        {/* Loading state */}
        {phase === "loading" ? (
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
            <p className="max-w-xs text-base text-white/80">{loadStatus}</p>
          </div>
        ) : null}

        {/* Error state */}
        {phase === "error" ? (
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <div className="rounded-2xl bg-red-500/15 px-5 py-4 text-sm font-medium text-red-200">
              {error ?? "Failed to start scanner."}
            </div>
            <button
              type="button"
              onClick={handleStart}
              className="rounded-2xl bg-primary px-6 py-3 text-base font-semibold text-ink transition-colors hover:bg-primary-hover"
            >
              Try again
            </button>
          </div>
        ) : null}
      </div>

      {/* Bottom HUD overlays — only when running */}
      {phase === "running" ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 px-4 pb-6">
          {/* Detection status badge */}
          <div
            className={`flex items-center gap-3 rounded-2xl bg-black/55 px-4 py-3 text-sm backdrop-blur transition-colors ${
              detected ? "ring-2 ring-primary/60" : ""
            }`}
          >
            <span
              className={`inline-flex size-2.5 rounded-full ${
                detected ? "bg-primary" : "bg-white/40"
              }`}
              aria-hidden
            />
            <div className="flex-1">
              <p className="font-semibold">
                {detected ? "Meter detected" : "No meter detected"}
              </p>
              <p className="text-xs text-white/70">
                {detected
                  ? "Hold steady — analyzing quality"
                  : "Center the meter inside the frame"}
              </p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: qualityColor(overall),
                color: overall > 0.5 ? "#111" : "white",
                opacity: detected ? 1 : 0.4,
              }}
            >
              {Math.round(overall * 100)}%
            </span>
          </div>

          {/* Tip card */}
          <div
            className={`rounded-2xl px-4 py-3 text-sm font-medium backdrop-blur transition-colors ${
              tip.level === "good"
                ? "bg-emerald-500/85 text-white"
                : tip.level === "warn"
                  ? "bg-amber-500/85 text-zinc-900"
                  : tip.level === "bad"
                    ? "bg-red-500/85 text-white"
                    : "bg-black/55 text-white"
            }`}
          >
            {tip.msg}
          </div>

          {/* Quality breakdown */}
          {scores ? (
            <div className="grid grid-cols-4 gap-2 rounded-2xl bg-black/55 p-3 backdrop-blur">
              <MetricBar label="Sharp" value={scores.sharpness} />
              <MetricBar label="Expo" value={scores.exposure} />
              <MetricBar label="Noise" value={scores.noise} />
              <MetricBar label="Contr" value={scores.contrast} />
            </div>
          ) : null}

          {/* Capture error banner */}
          {captureError ? (
            <div className="rounded-2xl bg-red-500/85 px-4 py-3 text-sm font-medium text-white backdrop-blur">
              {captureError}
            </div>
          ) : null}

          {/* Capture button */}
          <button
            type="button"
            onClick={handleCapture}
            disabled={capturing || captureDone}
            className={`flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold tracking-wide shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-80 ${
              captureDone
                ? "bg-emerald-500 text-white"
                : "bg-primary text-ink hover:bg-primary-hover"
            }`}
          >
            {captureDone ? (
              <>
                <CheckCircle2 className="size-6" aria-hidden />
                Captured
              </>
            ) : capturing ? (
              <>
                <Loader2 className="size-6 animate-spin" aria-hidden />
                Uploading…
              </>
            ) : (
              <>
                <Camera className="size-6" aria-hidden />
                Capture
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-[10px] uppercase tracking-wider text-white/70">
        <span>{label}</span>
        <span className="font-semibold text-white">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: qualityColor(value) }}
        />
      </div>
    </div>
  );
}
