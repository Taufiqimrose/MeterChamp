export async function startCamera(videoEl: HTMLVideoElement): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: "environment",
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();
}

export function stopCamera(videoEl: HTMLVideoElement): void {
  const stream = videoEl.srcObject as MediaStream | null;
  stream?.getTracks().forEach((t) => t.stop());
  videoEl.srcObject = null;
}
