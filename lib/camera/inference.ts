import * as ort from "onnxruntime-web";

let session: ort.InferenceSession | null = null;
let backendName: "WebGPU" | "WASM" = "WASM";

interface MinimalGpuAdapter {
  requestDevice(): Promise<unknown>;
}

interface MinimalGpu {
  requestAdapter(): Promise<MinimalGpuAdapter | null>;
}

function getGpu(): MinimalGpu | undefined {
  return (navigator as Navigator & { gpu?: MinimalGpu }).gpu;
}

export function isUsingWebGPU(): boolean {
  return backendName === "WebGPU";
}

export function getBackendName(): string {
  return backendName;
}

function shouldTryWebGPU(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("gpu") === "0") return false;
  return Boolean(getGpu());
}

async function probeWebGPU(): Promise<boolean> {
  const gpu = getGpu();
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    if (!device) return false;
    return true;
  } catch {
    return false;
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              `${label} timed out after ${ms}ms — try reloading with ?gpu=0`,
            ),
          ),
        ms,
      ),
    ),
  ]);
}

export type LoadProgress =
  | { phase: "fetch"; loaded: number; total: number }
  | { phase: "session" }
  | { phase: "warmup" }
  | { phase: "ready" };

async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`fetch ${url}: ${response.status} ${response.statusText}`);
  }
  const total = Number(response.headers.get("content-length") || 0);
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  onProgress(0, total);

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total);
  }

  const buf = new Uint8Array(loaded);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return buf;
}

const ORT_VERSION = "1.21.0";

export async function loadModel(
  modelUrl: string,
  onProgress: (p: LoadProgress) => void = () => {},
): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const threadsParam = parseInt(params.get("threads") || "1", 10);
  ort.env.wasm.numThreads = Math.max(
    1,
    Math.min(threadsParam, navigator.hardwareConcurrency ?? 4),
  );
  ort.env.wasm.simd = true;

  ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

  const tryGPU = shouldTryWebGPU() && (await probeWebGPU());
  backendName = tryGPU ? "WebGPU" : "WASM";

  const modelBytes = await fetchWithProgress(modelUrl, (loaded, total) => {
    onProgress({ phase: "fetch", loaded, total });
  });

  onProgress({ phase: "session" });
  const createPromise = ort.InferenceSession.create(modelBytes, {
    executionProviders: tryGPU ? ["webgpu"] : ["wasm"],
    graphOptimizationLevel: "all",
  });
  session = tryGPU
    ? await withTimeout(createPromise, 30000, "WebGPU session compile")
    : await createPromise;

  onProgress({ phase: "warmup" });
  const dummy = new ort.Tensor(
    "float32",
    new Float32Array(3 * 640 * 640),
    [1, 3, 640, 640],
  );
  await session.run({ [session.inputNames[0]]: dummy });

  onProgress({ phase: "ready" });
}

export function imageDataToTensor(imageData: ImageData): Float32Array {
  const { data, width, height } = imageData;
  const size = width * height;
  const tensor = new Float32Array(3 * size);
  for (let i = 0; i < size; i++) {
    tensor[0 * size + i] = data[i * 4 + 0] / 255;
    tensor[1 * size + i] = data[i * 4 + 1] / 255;
    tensor[2 * size + i] = data[i * 4 + 2] / 255;
  }
  return tensor;
}

function fp16BitsToFloat32(h: number): number {
  const sign = (h & 0x8000) >> 15;
  const exp = (h & 0x7c00) >> 10;
  const frac = h & 0x03ff;
  if (exp === 0) {
    if (frac === 0) return sign ? -0 : 0;
    return (sign ? -1 : 1) * Math.pow(2, -14) * (frac / 1024);
  }
  if (exp === 31) {
    if (frac === 0) return sign ? -Infinity : Infinity;
    return NaN;
  }
  return (sign ? -1 : 1) * Math.pow(2, exp - 15) * (1 + frac / 1024);
}

function fp16ArrayToFloat32(input: Uint16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = fp16BitsToFloat32(input[i]);
  return out;
}

export async function infer(tensorData: Float32Array): Promise<Float32Array> {
  if (!session) {
    throw new Error("inference: session not loaded; call loadModel first");
  }
  const input = new ort.Tensor("float32", tensorData, [1, 3, 640, 640]);
  const results = await session.run({ [session.inputNames[0]]: input });
  const outTensor = results[session.outputNames[0]];
  const data = outTensor.data;
  if (outTensor.type === "float16") {
    return fp16ArrayToFloat32(data as Uint16Array);
  }
  return data as Float32Array;
}
