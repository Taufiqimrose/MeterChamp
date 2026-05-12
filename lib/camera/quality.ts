export function toLuma(image: ImageData): Float32Array {
  const { data } = image;
  const luma = new Float32Array(image.width * image.height);
  for (let i = 0; i < luma.length; i++) {
    luma[i] =
      (0.299 * data[i * 4 + 0] +
        0.587 * data[i * 4 + 1] +
        0.114 * data[i * 4 + 2]) /
      255;
  }
  return luma;
}

export interface LapStats {
  variance: number;
  median: number;
}

function laplacianStats(
  luma: Float32Array,
  w: number,
  h: number,
): LapStats {
  if (w < 3 || h < 3) return { variance: 0, median: 0 };
  const n = (h - 2) * (w - 2);
  const absLaps = new Float32Array(n);
  let sum = 0,
    sumSq = 0,
    k = 0;
  for (let y = 1; y < h - 1; y++) {
    const yw = y * w;
    for (let x = 1; x < w - 1; x++) {
      const i = yw + x;
      const lap =
        -4 * luma[i] +
        luma[i - 1] +
        luma[i + 1] +
        luma[i - w] +
        luma[i + w];
      sum += lap;
      sumSq += lap * lap;
      absLaps[k++] = lap < 0 ? -lap : lap;
    }
  }
  const mean = sum / n;
  const variance = Math.max(0, sumSq / n - mean * mean);
  const median = quickSelect(absLaps, n >> 1);
  return { variance, median };
}

function quickSelect(arr: Float32Array, k: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    let t: number;
    if (arr[mid] < arr[lo]) {
      t = arr[mid];
      arr[mid] = arr[lo];
      arr[lo] = t;
    }
    if (arr[hi] < arr[lo]) {
      t = arr[hi];
      arr[hi] = arr[lo];
      arr[lo] = t;
    }
    if (arr[hi] < arr[mid]) {
      t = arr[hi];
      arr[hi] = arr[mid];
      arr[mid] = t;
    }
    const pivot = arr[mid];
    let i = lo,
      j = hi;
    while (i <= j) {
      while (arr[i] < pivot) i++;
      while (arr[j] > pivot) j--;
      if (i <= j) {
        t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
        i++;
        j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else return arr[k];
  }
  return arr[lo];
}

const REF_ROI_PIXELS = 200 * 200;

export function sharpnessScore(
  stats: LapStats,
  w: number,
  h: number,
): number {
  const innerPixels = Math.max(1, (w - 2) * (h - 2));
  const sizeAdjust = Math.pow(innerPixels / REF_ROI_PIXELS, 0.25);
  const normalized = stats.variance * sizeAdjust;
  return Math.min(1, Math.sqrt(normalized / 0.005));
}

export function exposureScore(luma: Float32Array): number {
  let sum = 0,
    low = 0,
    high = 0;
  for (let i = 0; i < luma.length; i++) {
    const v = luma[i];
    sum += v;
    if (v < 0.02) low++;
    else if (v > 0.98) high++;
  }
  const mean = sum / luma.length;
  const clipFraction = (low + high) / luma.length;
  const meanPenalty = Math.abs(mean - 0.5) / 0.5;
  const clipRatio = clipFraction / 0.15;
  const clipPenalty = Math.min(1, clipRatio * clipRatio);
  return Math.max(0, 1 - 0.5 * meanPenalty - 0.5 * clipPenalty);
}

export function noiseScore(stats: LapStats): number {
  return Math.max(0, 1 - Math.min(1, stats.median / 0.05));
}

export function contrastScore(luma: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < luma.length; i++) sum += luma[i];
  const mean = sum / luma.length;
  let sumSq = 0;
  for (let i = 0; i < luma.length; i++) {
    const d = luma[i] - mean;
    sumSq += d * d;
  }
  const rms = Math.sqrt(sumSq / luma.length);
  return Math.min(1, rms / 0.25);
}

export interface QualityScores {
  sharpness: number;
  exposure: number;
  noise: number;
  contrast: number;
}

export function scoreROI(image: ImageData): QualityScores {
  const luma = toLuma(image);
  const stats = laplacianStats(luma, image.width, image.height);
  return {
    sharpness: sharpnessScore(stats, image.width, image.height),
    exposure: exposureScore(luma),
    noise: noiseScore(stats),
    contrast: contrastScore(luma),
  };
}

export function combine(s: QualityScores): number {
  return (
    0.4 * s.sharpness +
    0.3 * s.exposure +
    0.2 * s.contrast +
    0.1 * s.noise
  );
}
