export async function generateTimelapse(photos, { fps = 2, width = 1280, height = 960 } = {}) {
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(width, height)
    : Object.assign(document.createElement("canvas"), { width, height });

  const ctx = canvas.getContext("2d");

  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find(t => MediaRecorder.isTypeSupported(t)) || "video/webm";

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  recorder.start();

  for (const photo of photos) {
    const url = URL.createObjectURL(photo.blob);
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // letterbox to fill canvas while keeping aspect ratio
        const scale = Math.min(width / img.width, height / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (width - w) / 2;
        const y = (height - h) / 2;
        ctx.fillStyle = "#0c0f14";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, x, y, w, h);

        // label overlay
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, height - 48, width, 48);
        ctx.fillStyle = "#5ce0d8";
        ctx.font = "bold 24px 'DM Sans', sans-serif";
        ctx.textBaseline = "middle";
        ctx.fillText(`Tray #${photo.trayNum}  ·  ${photo.capturedAt.slice(0, 10)}`, 24, height - 24);

        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });

    // hold each frame for 1/fps seconds
    await new Promise(r => setTimeout(r, 1000 / fps));
  }

  recorder.stop();

  return new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });
}

export function isTimelapseSupported() {
  return typeof MediaRecorder !== "undefined";
}
