"use client";

import type { Direction, ExtractedSignal } from "@/lib/types";

type OcrFallbacks = {
  fallbackPair: string;
  fallbackDirection: Direction;
};

type TesseractWorker = {
  recognize: (image: HTMLCanvasElement | HTMLImageElement) => Promise<{ data: { text?: string } }>;
};

type TesseractModule = {
  createWorker: (lang: string) => Promise<TesseractWorker>;
};

declare global {
  interface Window {
    Tesseract?: TesseractModule;
  }
}

let scriptPromise: Promise<TesseractModule> | null = null;
let workerPromise: Promise<TesseractWorker> | null = null;

async function loadTesseract() {
  if (typeof window === "undefined") {
    throw new Error("Tesseract can only run in the browser.");
  }

  if (window.Tesseract) {
    return window.Tesseract;
  }

  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/tesseract.js@5.0.5/dist/tesseract.min.js";
      script.async = true;
      script.onload = () => {
        if (window.Tesseract) {
          resolve(window.Tesseract);
        } else {
          reject(new Error("Tesseract failed to initialize."));
        }
      };
      script.onerror = () => reject(new Error("Failed to load Tesseract.js."));
      document.head.appendChild(script);
    });
  }

  return scriptPromise;
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const tesseract = await loadTesseract();
      return tesseract.createWorker("eng");
    })();
  }

  return workerPromise;
}

function normalizeText(text: string) {
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
}

function parseDirection(text: string, fallback: Direction) {
  const match = text.match(/\b(long|short)\b/i);
  if (!match) return fallback;
  return match[1].toLowerCase() === "short" ? "Short" : "Long";
}

function splitIntoBlocks(text: string) {
  const timeMatches = Array.from(text.matchAll(/\b([0-2]?\d:[0-5]\d)\b/g));
  if (timeMatches.length > 1) {
    const blocks: string[] = [];
    let lastIndex = 0;
    for (const match of timeMatches) {
      const end = (match.index ?? 0) + match[0].length;
      const chunk = text.slice(lastIndex, end).trim();
      if (chunk) blocks.push(chunk);
      lastIndex = end;
    }
    const tail = text.slice(lastIndex).trim();
    if (tail) blocks.push(tail);
    return blocks;
  }

  const newlineBlocks = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (newlineBlocks.length > 1) {
    return newlineBlocks;
  }

  const matches = Array.from(text.matchAll(/\b(long|short)\b/gi));
  if (!matches.length) return [text];

  const blocks: string[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    blocks.push(text.slice(start, end).trim());
  }
  return blocks.filter(Boolean);
}

function parsePair(text: string, fallback: string) {
  const directMatch = text.match(/\b([A-Z0-9]{2,10})\s*\/?\s*USDT\b/i);
  if (directMatch?.[1]) {
    return `${directMatch[1].toUpperCase()}USDT`;
  }

  const ignore = new Set([
    "LONG",
    "SHORT",
    "TARGET",
    "TAKE",
    "PROFIT",
    "STOP",
    "LOSS",
    "LEVERAGE",
    "WALLET",
    "SIZE",
    "MAX",
    "BOOK",
    "NEED",
    "WAIT",
    "ENTRY",
    "DONT",
    "PICK",
    "OLD",
    "SIGNALS",
    "EDITED",
  ]);

  const matches = text.matchAll(/\b([A-Z0-9]{2,10})\b/g);
  for (const match of matches) {
    const candidate = match[1].toUpperCase();
    if (!ignore.has(candidate) && /[A-Z]/.test(candidate)) {
      return candidate;
    }
  }

  return fallback;
}

function parseTime(text: string) {
  const matches = Array.from(text.matchAll(/\b([0-2]?\d:[0-5]\d)\b/g));
  const last = matches.at(-1);
  return last?.[1] ?? null;
}

function dedupeSignals<T extends { pair: string; direction: Direction; startTime: string }>(
  signals: T[],
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const signal of signals) {
    const target = "target" in signal ? String((signal as { target?: string }).target ?? "") : "";
    const key = `${signal.pair}|${signal.direction}|${signal.startTime}|${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(signal);
  }

  return deduped;
}

function ensureSignals(
  blocks: string[],
  { fallbackPair, fallbackDirection }: OcrFallbacks,
  text: string,
) {
  const now = new Date();
  const fallbackTime = parseTime(text) ?? now.toTimeString().slice(0, 5);

  return blocks.map((block) => {
    const direction = parseDirection(block, fallbackDirection);
    const pair = parsePair(block, fallbackPair);
    const time = parseTime(block) ?? fallbackTime;

    return {
      pair,
      direction,
      startTime: time,
    };
  });
}

export function extractSignalsFromText(
  rawText: string,
  { fallbackPair, fallbackDirection }: OcrFallbacks,
) {
  const text = normalizeText(rawText ?? "");
  const blocks = splitIntoBlocks(text);
  const signals = ensureSignals(blocks, { fallbackPair, fallbackDirection }, text);
  const resolved = signals.length
    ? signals
    : ensureSignals([text], { fallbackPair, fallbackDirection }, text);

  return dedupeSignals(resolved);
}

async function loadImage(file: File) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}

async function imageToCanvas(file: File) {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas not supported");
  }

  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function extractSignalFromImage(
  file: File,
  { fallbackPair, fallbackDirection }: OcrFallbacks,
): Promise<Omit<ExtractedSignal, "id">[]> {
  const canvas = await imageToCanvas(file);
  const worker = await getWorker();
  const { data } = await worker.recognize(canvas);
  return extractSignalsFromText(data.text ?? "", { fallbackPair, fallbackDirection });
}
