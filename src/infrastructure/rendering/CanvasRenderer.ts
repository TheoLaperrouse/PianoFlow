import type { RendererPort, RenderState } from '../../application/ports/RendererPort';
import { isBlackKey, midiToNoteName, octaveOf, TOTAL_WHITE_KEYS } from '../../domain/Keyboard';
import { isActiveAt, isVisibleInWindow, type PianoNote } from '../../domain/PianoNote';
import { computeKeyGeometry, type KeyGeometry, noteCenterX } from './canvasGeometry';

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
} as const;

/**
 * Adaptateur du port RendererPort. Encapsule l'API Canvas 2D et la gestion
 * de la résolution (devicePixelRatio). Ne connaît rien du moteur audio ni
 * du parsing : uniquement le RenderState fourni par l'application.
 */
export class CanvasRenderer implements RendererPort {
  private readonly canvas: HTMLCanvasElement;
  private cssWidth = 0;
  private cssHeight = 0;
  private resizeListener: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.resizeListener = () => this.resize();
    window.addEventListener('resize', this.resizeListener);
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    this.cssWidth = parent.clientWidth;
    this.cssHeight = parent.clientHeight;
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.canvas.width = Math.round(this.cssWidth * dpr);
    this.canvas.height = Math.round(this.cssHeight * dpr);
    const ctx = this.canvas.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  render(state: RenderState): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const width = this.cssWidth;
    const height = this.cssHeight;
    const keyboardHeight = Math.max(120, Math.min(180, height * 0.22));
    const fallZoneHeight = height - keyboardHeight;
    const notes = state.song?.notes ?? [];

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    drawFallingNotes(ctx, width, fallZoneHeight, notes, state.currentTime, state.lookAhead);

    ctx.fillStyle = COLORS.hitLine;
    ctx.fillRect(0, fallZoneHeight - 2, width, 3);

    drawKeyboard(ctx, width, keyboardHeight, fallZoneHeight, notes, state.currentTime);
  }

  captureStream(fps: number): MediaStream {
    return this.canvas.captureStream(fps);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeListener);
  }
}

function drawFallingNotes(
  ctx: CanvasRenderingContext2D,
  width: number,
  fallZoneHeight: number,
  notes: readonly PianoNote[],
  currentTime: number,
  lookAhead: number,
): void {
  const pxPerSecond = fallZoneHeight / lookAhead;
  const whiteWidth = width / TOTAL_WHITE_KEYS;
  const blackWidth = whiteWidth * 0.6;
  const windowEnd = currentTime + lookAhead;

  for (const note of notes) {
    if (!isVisibleInWindow(note, currentTime, windowEnd)) continue;

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
  notes: readonly PianoNote[],
  currentTime: number,
): void {
  const keys = computeKeyGeometry(width);
  const blackHeight = keyboardHeight * 0.6;

  const activeMidi = new Map<number, 'left' | 'right'>();
  for (const n of notes) {
    if (isActiveAt(n, currentTime)) activeMidi.set(n.midi, n.hand);
  }

  drawWhiteKeys(ctx, keys, yOffset, keyboardHeight, activeMidi);
  drawBlackKeys(ctx, keys, yOffset, blackHeight, activeMidi);
  drawMiddleCMarker(ctx, keys, yOffset, keyboardHeight);
}

function drawWhiteKeys(
  ctx: CanvasRenderingContext2D,
  keys: KeyGeometry[],
  yOffset: number,
  keyboardHeight: number,
  activeMidi: Map<number, 'left' | 'right'>,
): void {
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
      ctx.fillStyle = '#777';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`C${octaveOf(key.midi)}`, key.x + key.width / 2, yOffset + keyboardHeight - 4);
    }
  }
}

function drawBlackKeys(
  ctx: CanvasRenderingContext2D,
  keys: KeyGeometry[],
  yOffset: number,
  blackHeight: number,
  activeMidi: Map<number, 'left' | 'right'>,
): void {
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
}

function drawMiddleCMarker(
  ctx: CanvasRenderingContext2D,
  keys: KeyGeometry[],
  yOffset: number,
  keyboardHeight: number,
): void {
  const c4 = keys.find((k) => k.midi === 60);
  if (!c4) return;
  ctx.fillStyle = '#e74c3c';
  ctx.beginPath();
  ctx.arc(c4.x + c4.width / 2, yOffset + keyboardHeight - 14, 3, 0, Math.PI * 2);
  ctx.fill();
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
