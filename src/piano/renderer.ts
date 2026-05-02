import {
  computeKeyGeometry,
  isBlackKey,
  midiToNoteName,
  noteCenterX,
  TOTAL_WHITE_KEYS,
} from './keyboard';
import type { PianoNote } from './midiLoader';

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  notes: PianoNote[];
  currentTime: number;
  /** Secondes de musique visibles à l'écran (vitesse de chute). */
  lookAhead: number;
}

const COLORS = {
  bg: '#0d0d10',
  whiteKey: '#fafafa',
  blackKey: '#222',
  keyBorder: '#000',
  hitLine: '#e74c3c',
  noteRight: { fill: '#3fa34d', stroke: '#2d7a39' },
  noteLeft: { fill: '#3a7bd5', stroke: '#2a5ba0' },
  noteRightBlack: { fill: '#2f7a3a', stroke: '#1f5527' },
  noteLeftBlack: { fill: '#2c5fa3', stroke: '#1d447a' },
  activeLeftWhite: '#a9c8ee',
  activeRightWhite: '#b3e6bb',
  activeLeftBlack: '#3a6ea8',
  activeRightBlack: '#2d7a39',
};

export function render(opts: RenderOptions): void {
  const { ctx, width, height, notes, currentTime, lookAhead } = opts;
  const keyboardHeight = Math.max(120, Math.min(180, height * 0.22));
  const fallZoneHeight = height - keyboardHeight;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  drawFallingNotes(ctx, width, fallZoneHeight, notes, currentTime, lookAhead);

  ctx.fillStyle = COLORS.hitLine;
  ctx.fillRect(0, fallZoneHeight - 2, width, 3);

  drawKeyboard(ctx, width, keyboardHeight, fallZoneHeight, notes, currentTime);
}

function drawFallingNotes(
  ctx: CanvasRenderingContext2D,
  width: number,
  fallZoneHeight: number,
  notes: PianoNote[],
  currentTime: number,
  lookAhead: number,
): void {
  const pxPerSecond = fallZoneHeight / lookAhead;
  const whiteWidth = width / TOTAL_WHITE_KEYS;
  const blackWidth = whiteWidth * 0.6;

  for (const note of notes) {
    const noteEnd = note.time + note.duration;
    if (noteEnd < currentTime) continue;
    if (note.time > currentTime + lookAhead) continue;

    const isBlack = isBlackKey(note.midi);
    const w = isBlack ? blackWidth : whiteWidth * 0.95;
    const cx = noteCenterX(note.midi, width);
    const x = cx - w / 2;

    const yBottom = fallZoneHeight - (note.time - currentTime) * pxPerSecond;
    const h = note.duration * pxPerSecond;
    const yTop = yBottom - h;

    const palette =
      note.hand === 'right'
        ? isBlack
          ? COLORS.noteRightBlack
          : COLORS.noteRight
        : isBlack
          ? COLORS.noteLeftBlack
          : COLORS.noteLeft;

    roundedRect(ctx, x, yTop, w, h, 6);
    ctx.fillStyle = palette.fill;
    ctx.fill();
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (h > 24 && !isBlack) {
      ctx.fillStyle = '#fff';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(midiToNoteName(note.midi), x + w / 2, yBottom - 12);
    }
  }
}

function drawKeyboard(
  ctx: CanvasRenderingContext2D,
  width: number,
  keyboardHeight: number,
  yOffset: number,
  notes: PianoNote[],
  currentTime: number,
): void {
  const keys = computeKeyGeometry(width);
  const blackHeight = keyboardHeight * 0.6;

  const activeMidi = new Map<number, 'left' | 'right'>();
  for (const n of notes) {
    if (n.time <= currentTime && n.time + n.duration >= currentTime) {
      activeMidi.set(n.midi, n.hand);
    }
  }

  for (const key of keys) {
    if (key.isBlack) continue;
    const active = activeMidi.get(key.midi);
    ctx.fillStyle = active
      ? active === 'left'
        ? COLORS.activeLeftWhite
        : COLORS.activeRightWhite
      : COLORS.whiteKey;
    ctx.fillRect(key.x, yOffset, key.width, keyboardHeight);
    ctx.strokeStyle = COLORS.keyBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(key.x, yOffset, key.width, keyboardHeight);

    if (key.midi % 12 === 0) {
      const octave = Math.floor(key.midi / 12) - 1;
      ctx.fillStyle = '#777';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`C${octave}`, key.x + key.width / 2, yOffset + keyboardHeight - 4);
    }
  }

  for (const key of keys) {
    if (!key.isBlack) continue;
    const active = activeMidi.get(key.midi);
    ctx.fillStyle = active
      ? active === 'left'
        ? COLORS.activeLeftBlack
        : COLORS.activeRightBlack
      : COLORS.blackKey;
    ctx.fillRect(key.x, yOffset, key.width, blackHeight);
  }

  // marqueur du Do central (C4 = 60)
  const c4 = keys.find((k) => k.midi === 60);
  if (c4) {
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(c4.x + c4.width / 2, yOffset + keyboardHeight - 14, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, Math.abs(h) / 2, w / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
