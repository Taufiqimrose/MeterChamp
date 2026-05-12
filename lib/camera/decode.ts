export interface Detection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score: number;
}

export interface SourceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export interface LetterboxParams {
  scale: number;
  padX: number;
  padY: number;
  modelSize: number;
}

export function computeLetterbox(
  srcW: number,
  srcH: number,
  modelSize = 640,
): LetterboxParams {
  const scale = Math.min(modelSize / srcW, modelSize / srcH);
  const newW = srcW * scale;
  const newH = srcH * scale;
  return {
    scale,
    padX: (modelSize - newW) / 2,
    padY: (modelSize - newH) / 2,
    modelSize,
  };
}

export function decode(
  output: Float32Array,
  scoreThreshold = 0.25,
): Detection[] {
  const dets: Detection[] = [];
  const numDet = output.length / 6;
  for (let i = 0; i < numDet; i++) {
    const off = i * 6;
    const score = output[off + 4];
    if (score < scoreThreshold) continue;
    dets.push({
      x1: output[off + 0],
      y1: output[off + 1],
      x2: output[off + 2],
      y2: output[off + 3],
      score,
    });
  }
  return dets;
}

export function unletterbox(d: Detection, lb: LetterboxParams): SourceBox {
  const x1 = (d.x1 - lb.padX) / lb.scale;
  const y1 = (d.y1 - lb.padY) / lb.scale;
  const x2 = (d.x2 - lb.padX) / lb.scale;
  const y2 = (d.y2 - lb.padY) / lb.scale;
  return {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    score: d.score,
  };
}
