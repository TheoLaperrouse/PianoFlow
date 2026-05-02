import type { RendererPort, RenderState } from '../../application/ports/RendererPort';
import { isBlackKey, midiToNoteName, octaveOf } from '../../domain/Keyboard';
import { isActiveAt, isVisibleInWindow, type PianoNote } from '../../domain/PianoNote';
import { computeKeyboardLayout, type KeyboardLayout, noteCenterX } from './canvasGeometry';

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
  middleC: '#e74c3c',
  octaveLabel: '#777',
} as const;

type ActiveMap = Map<number, 'left' | 'right'>;

/**
 * Adaptateur du port RendererPort. Encapsule l'API Canvas 2D et la gestion
 * de la résolution (devicePixelRatio).
 *
 * Optimisations performance :
 *
 *  1. Le clavier statique (touches blanches/noires, bordures, étiquettes
 *     d'octaves, repère du Do central) est précalculé une fois sur un
 *     canvas off-screen, puis recopié à chaque frame avec drawImage.
 *     Évite de redessiner ~88 rectangles, ~88 traits et ~7 textes par
 *     frame — gros gain CPU/batterie en mobile.
 *
 *  2. Dirty-check : si rien n'a changé depuis la frame précédente
 *     (currentTime identique, mêmes touches actives, mêmes paramètres),
 *     on ne refait aucun travail.
 */
export class CanvasRenderer implements RendererPort {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;

  private cssWidth = 0;
  private cssHeight = 0;
  private resizeListener: () => void;

  private cachedLayout: KeyboardLayout | null = null;
  private layoutKey = '';

  private keyboardCache: HTMLCanvasElement | null = null;
  private keyboardCacheKey = '';

  private lastFrameHash = '';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // alpha:false → optimisation Chromium quand le canvas est opaque
    // (on remplit toujours la totalité avec COLORS.bg).
    this.ctx = canvas.getContext('2d', { alpha: false });
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
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Tout invalider — la nouvelle taille change le layout et le cache.
    this.cachedLayout = null;
    this.keyboardCache = null;
    this.lastFrameHash = '';
  }

  render(state: RenderState): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const width = this.cssWidth;
    const height = this.cssHeight;
    if (width === 0 || height === 0) return;

    const keyboardHeight = Math.max(90, Math.min(180, height * 0.22));
    const fallZoneHeight = height - keyboardHeight;
    const notes = state.song?.notes ?? [];
    const layout = this.getLayout(width, state.keyRange?.firstMidi, state.keyRange?.lastMidi);
    const activeMidi = computeActiveMidi(notes, state.currentTime);

    // Dirty-check : si rien ne change visuellement, skip toute la frame.
    const frameHash = this.computeFrameHash(state, layout, activeMidi);
    if (frameHash === this.lastFrameHash) return;
    this.lastFrameHash = frameHash;

    // Ré-génère le cache du clavier si la géométrie ou la plage change.
    const cacheKey = `${width}|${keyboardHeight}|${layout.firstMidi}|${layout.lastMidi}`;
    if (cacheKey !== this.keyboardCacheKey) {
      this.keyboardCache = buildKeyboardCache(layout, width, keyboardHeight);
      this.keyboardCacheKey = cacheKey;
    }

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    drawFallingNotes(ctx, layout, fallZoneHeight, notes, state.currentTime, state.lookAhead);

    ctx.fillStyle = COLORS.hitLine;
    ctx.fillRect(0, fallZoneHeight - 2, width, 3);

    // Coup principal du gain : 1 drawImage au lieu de 88+ rectangles.
    if (this.keyboardCache) {
      ctx.drawImage(this.keyboardCache, 0, fallZoneHeight);
    }

    if (activeMidi.size > 0) {
      drawActiveKeysOverlay(ctx, layout, fallZoneHeight, keyboardHeight, activeMidi);
    }
  }

  captureStream(fps: number): MediaStream {
    return this.canvas.captureStream(fps);
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeListener);
    this.keyboardCache = null;
    this.cachedLayout = null;
  }

  private getLayout(width: number, firstMidi?: number, lastMidi?: number): KeyboardLayout {
    const key = `${width}|${firstMidi ?? '_'}|${lastMidi ?? '_'}`;
    if (this.cachedLayout && this.layoutKey === key) return this.cachedLayout;
    this.cachedLayout = computeKeyboardLayout(width, firstMidi, lastMidi);
    this.layoutKey = key;
    return this.cachedLayout;
  }

  private computeFrameHash(state: RenderState, layout: KeyboardLayout, active: ActiveMap): string {
    // Quantification du temps à 5 ms : si la souris/transport ne progresse
    // pas (mode pause), le hash reste stable et on skippe le render.
    const t = Math.round(state.currentTime * 200);
    const ahead = state.lookAhead;
    const range = `${layout.firstMidi}-${layout.lastMidi}`;
    let activeKey = '';
    if (active.size > 0) {
      const sorted = [...active.entries()].sort(([a], [b]) => a - b);
      for (const [midi, hand] of sorted) activeKey += `${midi}${hand[0]},`;
    }
    return `${t}|${ahead}|${range}|${activeKey}`;
  }
}

/* ---------------------------------------------------------------------------
 * Helpers de rendu
 * ------------------------------------------------------------------------ */

function computeActiveMidi(notes: readonly PianoNote[], currentTime: number): ActiveMap {
  const map: ActiveMap = new Map();
  for (const n of notes) {
    if (isActiveAt(n, currentTime)) map.set(n.midi, n.hand);
  }
  return map;
}

function buildKeyboardCache(
  layout: KeyboardLayout,
  width: number,
  keyboardHeight: number,
): HTMLCanvasElement {
  const dpr = window.devicePixelRatio || 1;
  const cache = document.createElement('canvas');
  cache.width = Math.round(width * dpr);
  cache.height = Math.round(keyboardHeight * dpr);
  const ctx = cache.getContext('2d', { alpha: false });
  if (!ctx) return cache;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const blackHeight = keyboardHeight * 0.6;

  // Touches blanches + bordures + étiquettes d'octave
  for (const key of layout.keys) {
    if (key.isBlack) continue;
    ctx.fillStyle = COLORS.whiteKey;
    ctx.fillRect(key.x, 0, key.width, keyboardHeight);
    ctx.strokeStyle = COLORS.keyBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(key.x, 0, key.width, keyboardHeight);

    if (key.midi % 12 === 0) {
      ctx.fillStyle = COLORS.octaveLabel;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`C${octaveOf(key.midi)}`, key.x + key.width / 2, keyboardHeight - 4);
    }
  }

  // Touches noires
  for (const key of layout.keys) {
    if (!key.isBlack) continue;
    ctx.fillStyle = COLORS.blackKey;
    ctx.fillRect(key.x, 0, key.width, blackHeight);
  }

  // Repère Do central (C4 = 60)
  const c4 = layout.keys.find((k) => k.midi === 60);
  if (c4) {
    ctx.fillStyle = COLORS.middleC;
    ctx.beginPath();
    ctx.arc(c4.x + c4.width / 2, keyboardHeight - 14, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  return cache;
}

function drawActiveKeysOverlay(
  ctx: CanvasRenderingContext2D,
  layout: KeyboardLayout,
  yOffset: number,
  keyboardHeight: number,
  active: ActiveMap,
): void {
  const blackHeight = keyboardHeight * 0.6;

  for (const key of layout.keys) {
    const hand = active.get(key.midi);
    if (!hand) continue;

    if (key.isBlack) {
      ctx.fillStyle = hand === 'left' ? COLORS.activeLeftBlack : COLORS.activeRightBlack;
      ctx.fillRect(key.x, yOffset, key.width, blackHeight);
    } else {
      // On garde la bordure existante du cache : on remplit l'intérieur uniquement.
      ctx.fillStyle = hand === 'left' ? COLORS.activeLeftWhite : COLORS.activeRightWhite;
      ctx.fillRect(key.x + 1, yOffset + 1, key.width - 2, keyboardHeight - 2);

      // Restaure l'étiquette d'octave si présente sur cette touche
      if (key.midi % 12 === 0) {
        ctx.fillStyle = COLORS.octaveLabel;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`C${octaveOf(key.midi)}`, key.x + key.width / 2, yOffset + keyboardHeight - 4);
      }
    }
  }
}

function drawFallingNotes(
  ctx: CanvasRenderingContext2D,
  layout: KeyboardLayout,
  fallZoneHeight: number,
  notes: readonly PianoNote[],
  currentTime: number,
  lookAhead: number,
): void {
  const pxPerSecond = fallZoneHeight / lookAhead;
  const windowEnd = currentTime + lookAhead;

  for (const note of notes) {
    if (!isVisibleInWindow(note, currentTime, windowEnd)) continue;
    if (note.midi < layout.firstMidi || note.midi > layout.lastMidi) continue;

    const isBlack = isBlackKey(note.midi);
    const w = isBlack ? layout.blackWidth : layout.whiteWidth * 0.95;
    const cx = noteCenterX(note.midi, layout);
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
