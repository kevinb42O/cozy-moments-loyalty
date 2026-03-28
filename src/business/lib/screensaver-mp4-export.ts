import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import {
  normalizeScreensaverConfig,
  resolveLeftSlideImage,
  resolvePrimarySlideImage,
  resolveRightSlideImage,
  type ScreensaverSlideConfig,
} from '../../shared/lib/screensaver-config';

type ExportOptions = {
  slides: ScreensaverSlideConfig[];
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  onProgress?: (progress: number) => void;
};

type RuntimeSlide = {
  config: ScreensaverSlideConfig;
  startMs: number;
  endMs: number;
  durationMs: number;
};

type PanVector = {
  xStart: number;
  xEnd: number;
  yStart: number;
  yEnd: number;
};

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 960;
const DEFAULT_FPS = 30;
const DEFAULT_BITRATE = 8_000_000;
const SLIDE_FADE_MS = 1000;

const PAN_VECTORS: readonly PanVector[] = [
  { xStart: 0.03, xEnd: -0.03, yStart: 0.02, yEnd: -0.02 },
  { xStart: -0.03, xEnd: 0.03, yStart: -0.02, yEnd: 0.02 },
  { xStart: 0, xEnd: 0, yStart: 0.03, yEnd: -0.03 },
  { xStart: 0.03, xEnd: -0.03, yStart: -0.02, yEnd: 0.02 },
  { xStart: -0.03, xEnd: 0.03, yStart: 0.02, yEnd: -0.02 },
];

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function easeInOutCubic(value: number) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function coverRect(srcW: number, srcH: number, targetW: number, targetH: number) {
  const scale = Math.max(targetW / srcW, targetH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  return {
    drawW,
    drawH,
    offsetX: (targetW - drawW) / 2,
    offsetY: (targetH - drawH) / 2,
  };
}

function containRect(srcW: number, srcH: number, targetW: number, targetH: number) {
  const scale = Math.min(targetW / srcW, targetH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  return {
    drawW,
    drawH,
    offsetX: (targetW - drawW) / 2,
    offsetY: (targetH - drawH) / 2,
  };
}

function drawRoundedImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  mode: 'cover' | 'contain'
) {
  const sourceWidth = (image as ImageBitmap).width ?? (image as HTMLImageElement).naturalWidth;
  const sourceHeight = (image as ImageBitmap).height ?? (image as HTMLImageElement).naturalHeight;
  const layout = mode === 'cover'
    ? coverRect(sourceWidth, sourceHeight, width, height)
    : containRect(sourceWidth, sourceHeight, width, height);

  ctx.save();
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, r);
  ctx.clip();
  ctx.drawImage(image, x + layout.offsetX, y + layout.offsetY, layout.drawW, layout.drawH);
  ctx.restore();
}

async function loadImageBitmap(url: string): Promise<ImageBitmap> {
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) {
    throw new Error(`Kon afbeelding niet laden: ${url}`);
  }
  const blob = await response.blob();
  return createImageBitmap(blob);
}

function isWebCodecExportSupported() {
  const mediaGlobal = globalThis as typeof globalThis & {
    VideoEncoder?: typeof VideoEncoder;
    VideoFrame?: typeof VideoFrame;
    EncodedVideoChunk?: typeof EncodedVideoChunk;
  };

  return (
    typeof window !== 'undefined'
    && typeof mediaGlobal.VideoEncoder !== 'undefined'
    && typeof mediaGlobal.VideoFrame !== 'undefined'
    && typeof mediaGlobal.EncodedVideoChunk !== 'undefined'
  );
}

function buildRuntimeSlides(slides: ScreensaverSlideConfig[]): RuntimeSlide[] {
  let timeCursor = 0;
  return slides.map((slide) => {
    const runtimeSlide: RuntimeSlide = {
      config: slide,
      startMs: timeCursor,
      endMs: timeCursor + slide.durationMs,
      durationMs: slide.durationMs,
    };
    timeCursor += slide.durationMs;
    return runtimeSlide;
  });
}

function resolveSlideAtTime(runtimeSlides: RuntimeSlide[], timeMs: number) {
  const lastSlide = runtimeSlides[runtimeSlides.length - 1];
  if (!lastSlide) {
    return {
      current: null,
      next: null,
      localMs: 0,
      crossFade: 0,
    };
  }

  const boundedTime = Math.min(Math.max(0, timeMs), Math.max(0, lastSlide.endMs - 1));
  const currentIndex = runtimeSlides.findIndex((slide) => boundedTime >= slide.startMs && boundedTime < slide.endMs);
  const safeIndex = currentIndex >= 0 ? currentIndex : runtimeSlides.length - 1;
  const current = runtimeSlides[safeIndex];
  const next = runtimeSlides[(safeIndex + 1) % runtimeSlides.length];
  const localMs = boundedTime - current.startMs;

  const fadeDurationMs = Math.min(SLIDE_FADE_MS, Math.max(0, current.durationMs - 200));
  const fadeStartMs = current.durationMs - fadeDurationMs;
  const crossFade = localMs >= fadeStartMs
    ? clamp01((localMs - fadeStartMs) / Math.max(1, fadeDurationMs))
    : 0;

  return {
    current,
    next,
    localMs,
    crossFade,
    fadeDurationMs,
  };
}

function drawSingleSlide(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  timelineSeed: number,
  localProgress: number,
  width: number,
  height: number
) {
  const pan = PAN_VECTORS[timelineSeed % PAN_VECTORS.length];
  const panX = lerp(pan.xStart, pan.xEnd, localProgress) * width;
  const panY = lerp(pan.yStart, pan.yEnd, localProgress) * height;

  ctx.save();
  ctx.filter = 'blur(28px) brightness(0.38) saturate(1.5)';
  const bgScale = 1.12;
  const bgW = width * bgScale;
  const bgH = height * bgScale;
  const bgX = (width - bgW) / 2;
  const bgY = (height - bgH) / 2;
  drawRoundedImage(ctx, image, bgX, bgY, bgW, bgH, 0, 'cover');
  ctx.restore();

  const radial = ctx.createRadialGradient(width / 2, height / 2, width * 0.18, width / 2, height / 2, width * 0.8);
  radial.addColorStop(0, 'rgba(0,0,0,0)');
  radial.addColorStop(1, 'rgba(10,6,4,0.55)');
  ctx.save();
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const padX = width * 0.04;
  const padY = height * 0.04;
  const heroTargetW = width - padX * 2;
  const heroTargetH = height - padY * 2;
  const heroLayout = containRect(image.width, image.height, heroTargetW, heroTargetH);
  const zoom = lerp(1, 1.07, localProgress);
  const drawW = heroLayout.drawW * zoom;
  const drawH = heroLayout.drawH * zoom;
  const drawX = padX + heroLayout.offsetX + (heroLayout.drawW - drawW) / 2 + panX;
  const drawY = padY + heroLayout.offsetY + (heroLayout.drawH - drawH) / 2 + panY;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.52)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  drawRoundedImage(ctx, image, drawX, drawY, drawW, drawH, 24, 'contain');
  ctx.restore();
}

function drawDualCard(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap,
  box: { x: number; y: number; w: number; h: number; rotationDeg: number; scale: number },
  kenBurnsScale: number
) {
  ctx.save();
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate((box.rotationDeg * Math.PI) / 180);
  ctx.scale(box.scale, box.scale);
  ctx.translate(-box.w / 2, -box.h / 2);

  ctx.shadowColor = 'rgba(0,0,0,0.42)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 8;

  const extraW = box.w * (kenBurnsScale - 1);
  const extraH = box.h * (kenBurnsScale - 1);
  const kbX = -extraW / 2;
  const kbY = -extraH / 2;
  drawRoundedImage(ctx, image, kbX, kbY, box.w + extraW, box.h + extraH, 32, 'cover');
  ctx.restore();
}

function drawDualSlide(
  ctx: CanvasRenderingContext2D,
  leftImage: ImageBitmap,
  rightImage: ImageBitmap,
  localMs: number,
  durationMs: number,
  width: number,
  height: number
) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  const durationSec = durationMs / 1000;
  const tSec = localMs / 1000;
  const slideInProgressLeft = clamp01(tSec / 1.4);
  const slideInProgressRight = clamp01(Math.max(0, tSec - 0.15) / 1.4);

  const swapDelay = Math.min(5, Math.max(3.2, durationSec * 0.35));
  const swapDur = 1.2;
  const swapProgress = clamp01((tSec - swapDelay) / swapDur);
  const easedSwap = easeInOutCubic(swapProgress);

  const leftBox = {
    w: width * 0.58,
    h: height * 0.9,
    x: lerp(-width * 1.1, width * 0.08, easeInOutCubic(slideInProgressLeft)),
    y: height * 0.05,
    rotationDeg: lerp(-4, -1.5, easeInOutCubic(slideInProgressLeft)),
    scale: lerp(1, 0.97, easedSwap),
  };

  const rightBox = {
    w: width * 0.55,
    h: height * 0.85,
    x: lerp(width * 1.1 - width * 0.55, width * 0.37, easeInOutCubic(slideInProgressRight)),
    y: height * 0.08,
    rotationDeg: lerp(4, 1.5, easeInOutCubic(slideInProgressRight)),
    scale: lerp(1, 1.04, easedSwap),
  };

  const leftZ = tSec < swapDelay ? 20 : 5;
  const rightZ = tSec < swapDelay ? 10 : 30;

  const drawStack = [
    { z: leftZ, fn: () => drawDualCard(ctx, leftImage, leftBox, lerp(1, 1.15, clamp01(localMs / durationMs))) },
    { z: rightZ, fn: () => drawDualCard(ctx, rightImage, rightBox, lerp(1, 1.15, clamp01(localMs / durationMs))) },
  ].sort((a, b) => a.z - b.z);

  drawStack.forEach((entry) => entry.fn());

  const radial = ctx.createRadialGradient(width / 2, height / 2, width * 0.14, width / 2, height / 2, width * 0.55);
  radial.addColorStop(0, 'rgba(255,255,255,0.4)');
  radial.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.fillStyle = radial;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawSlideFrame(
  ctx: CanvasRenderingContext2D,
  slide: ScreensaverSlideConfig,
  slideIndex: number,
  localMs: number,
  imageMap: Map<string, ImageBitmap>,
  width: number,
  height: number
) {
  const localProgress = clamp01(localMs / Math.max(1, slide.durationMs));
  const primaryUrl = resolvePrimarySlideImage(slide);
  const leftUrl = resolveLeftSlideImage(slide);
  const rightUrl = resolveRightSlideImage(slide);

  if (slide.mode === 'dual' && rightUrl) {
    const leftImage = imageMap.get(leftUrl);
    const rightImage = imageMap.get(rightUrl);

    if (!leftImage || !rightImage) {
      throw new Error('Niet alle slides konden worden geladen voor MP4-export.');
    }

    drawDualSlide(ctx, leftImage, rightImage, localMs, slide.durationMs, width, height);
    return;
  }

  const image = imageMap.get(primaryUrl);
  if (!image) {
    throw new Error('Niet alle slides konden worden geladen voor MP4-export.');
  }

  drawSingleSlide(ctx, image, slideIndex, localProgress, width, height);
}

async function getEncoderConfig(width: number, height: number, bitrate: number, fps: number) {
  const mediaGlobal = globalThis as typeof globalThis & { VideoEncoder: typeof VideoEncoder };
  const candidates: VideoEncoderConfig[] = [
    {
      codec: 'avc1.640028',
      width,
      height,
      bitrate,
      framerate: fps,
      avc: { format: 'avc' },
    },
    {
      codec: 'avc1.42001f',
      width,
      height,
      bitrate,
      framerate: fps,
      avc: { format: 'avc' },
    },
  ];

  for (const candidate of candidates) {
    const support = await mediaGlobal.VideoEncoder.isConfigSupported(candidate);
    if (support.supported) {
      return candidate;
    }
  }

  throw new Error('Deze browser ondersteunt geen H264 MP4-export voor screensaver-video. Gebruik Chrome of Edge op desktop.');
}

export async function exportScreensaverToMp4(options: ExportOptions): Promise<Blob> {
  if (!isWebCodecExportSupported()) {
    throw new Error('MP4-export is niet ondersteund in deze browser. Gebruik Chrome of Edge op desktop.');
  }

  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const fps = options.fps ?? DEFAULT_FPS;
  const bitrate = options.bitrate ?? DEFAULT_BITRATE;
  const slides = normalizeScreensaverConfig(options.slides);

  if (slides.length === 0) {
    throw new Error('Er zijn geen slides om te exporteren.');
  }

  const runtimeSlides = buildRuntimeSlides(slides);
  const totalDurationMs = runtimeSlides.reduce((sum, slide) => sum + slide.durationMs, 0);
  const totalFrames = Math.max(1, Math.round((totalDurationMs / 1000) * fps));
  const slideIndexById = new Map(slides.map((slide, index) => [slide.id, index]));

  const imageUrls = [...new Set(slides.flatMap((slide) => {
    const urls = [resolvePrimarySlideImage(slide), resolveLeftSlideImage(slide)];
    const right = resolveRightSlideImage(slide);
    if (right) urls.push(right);
    return urls;
  }))];

  options.onProgress?.(0.02);

  const imageBitmaps = await Promise.all(imageUrls.map(async (url) => [url, await loadImageBitmap(url)] as const));
  const imageMap = new Map<string, ImageBitmap>(imageBitmaps);

  options.onProgress?.(0.1);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Canvas rendering is niet beschikbaar in deze browser.');
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width,
      height,
      frameRate: fps,
    },
    fastStart: 'in-memory',
  });

  const encoderConfig = await getEncoderConfig(width, height, bitrate, fps);

  const mediaGlobal = globalThis as typeof globalThis & {
    VideoEncoder: typeof VideoEncoder;
    VideoFrame: typeof VideoFrame;
  };
  let encoderError: Error | null = null;

  const encoder = new mediaGlobal.VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error(String(error));
    },
  });

  try {
    encoder.configure(encoderConfig);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
      if (encoderError) {
        throw encoderError;
      }

      const timeSec = frameIndex / fps;
      const timeMs = timeSec * 1000;
      const frameTimestampUs = Math.round(timeSec * 1_000_000);

      const scene = resolveSlideAtTime(runtimeSlides, timeMs);
      if (!scene.current) {
        continue;
      }

      ctx.clearRect(0, 0, width, height);
      drawSlideFrame(
        ctx,
        scene.current.config,
        slideIndexById.get(scene.current.config.id) ?? 0,
        scene.localMs,
        imageMap,
        width,
        height
      );

      if (scene.crossFade > 0 && scene.next) {
        ctx.save();
        ctx.globalAlpha = scene.crossFade;
        const nextLocalMs = scene.crossFade * scene.fadeDurationMs;
        drawSlideFrame(
          ctx,
          scene.next.config,
          slideIndexById.get(scene.next.config.id) ?? 0,
          nextLocalMs,
          imageMap,
          width,
          height
        );
        ctx.restore();
      }

      const frame = new mediaGlobal.VideoFrame(canvas, { timestamp: frameTimestampUs });
      encoder.encode(frame, { keyFrame: frameIndex % fps === 0 });
      frame.close();

      if (frameIndex % Math.max(1, Math.round(fps / 2)) === 0 || frameIndex === totalFrames - 1) {
        const frameProgress = frameIndex / Math.max(1, totalFrames - 1);
        options.onProgress?.(0.1 + frameProgress * 0.86);
        await Promise.resolve();
      }
    }

    if (encoderError) {
      throw encoderError;
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();

    const target = muxer.target as ArrayBufferTarget;
    const bytes = new Uint8Array(target.buffer);
    options.onProgress?.(1);
    return new Blob([bytes], { type: 'video/mp4' });
  } finally {
    if (encoder.state !== 'closed') {
      try {
        encoder.close();
      } catch {
        // Ignore cleanup errors.
      }
    }
    imageMap.forEach((bitmap) => bitmap.close());
  }
}
