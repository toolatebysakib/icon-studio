let sessionPromise;
const base = import.meta.env.BASE_URL;
export async function removeSmartBackground(image) {
  const ort = await import("onnxruntime-web/wasm");
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = new URL(`${base}ai-runtime/`, location.href).href;
  sessionPromise ||= ort.InferenceSession.create(
    new URL(`${base}models/u2netp.onnx`, location.href).href,
    { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
  ).catch((error) => {
    sessionPromise = null;
    throw error;
  });
  const session = await sessionPromise;
  const small = document.createElement("canvas");
  small.width = small.height = 320;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, 320, 320);
  const pixels = ctx.getImageData(0, 0, 320, 320).data;
  const data = new Float32Array(3 * 320 * 320),
    means = [0.485, 0.456, 0.406],
    std = [0.229, 0.224, 0.225];
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < 320 * 320; i++)
      data[c * 320 * 320 + i] = (pixels[i * 4 + c] / 255 - means[c]) / std[c];
  const output = await session.run({
    [session.inputNames[0]]: new ort.Tensor("float32", data, [1, 3, 320, 320]),
  });
  const mask = output[session.outputNames[0]].data;
  let min = Infinity,
    max = -Infinity;
  for (const value of mask) {
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  if (max - min < 1e-6)
    throw new Error("No foreground detected. Try Edge detection.");
  const maskPixels = ctx.createImageData(320, 320);
  for (let i = 0; i < mask.length; i++) {
    const alpha = Math.max(
      0,
      Math.min(255, ((mask[i] - min) / (max - min)) * 255),
    );
    maskPixels.data.set([255, 255, 255, alpha], i * 4);
  }
  ctx.putImageData(maskPixels, 0, 0);
  const scale = Math.min(1, 2048 / Math.max(image.width, image.height));
  const full = document.createElement("canvas");
  full.width = Math.round(image.width * scale);
  full.height = Math.round(image.height * scale);
  const fullCtx = full.getContext("2d");
  fullCtx.drawImage(image, 0, 0, full.width, full.height);
  fullCtx.globalCompositeOperation = "destination-in";
  fullCtx.drawImage(small, 0, 0, full.width, full.height);
  for (const tensor of Object.values(output)) tensor.dispose?.();
  return full.toDataURL("image/png");
}
