import type { IntroOverlay, RendererPort, RenderState } from '../../application/ports/RendererPort';
import { isBlackKey, midiToNoteName, octaveOf } from '../../domain/Keyboard';
import { endTime, isActiveAt, isVisibleInWindow, type PianoNote } from '../../domain/PianoNote';
import { computeKeyboardLayout, type KeyboardLayout, noteCenterX } from './canvasGeometry';

/** Durée de persistance d'une note "fantôme" après son passage (secondes). */
const GHOST_DURATION = 0.5;

const COLORS = {
  bgTop: '#08060f',
  bgBottom: '#0e0a18',
  whiteKeyTop: '#ffffff',
  whiteKeyBottom: '#dcd9e4',
  blackKeyTop: '#3a3650',
  blackKeyBottom: '#15121e',
  keyBorder: '#000',
  hitLine: 'rgba(255, 61, 87, 0.85)',
  hitLineGlow: 'rgba(255, 61, 87, 0.18)',
  // Notes : dégradé du sommet (clair, lumineux) vers le bas (saturé) +
  // halo discret pour donner du volume.
  noteRightTop: '#7be58a',
  noteRightBottom: '#27a83a',
  noteRightStroke: '#1d7d2c',
  noteLeftTop: '#83b9ff',
  noteLeftBottom: '#2c6fd9',
  noteLeftStroke: '#1f4c9c',
  noteRightBlackTop: '#5fc771',
  noteRightBlackBottom: '#1a7c2a',
  noteLeftBlackTop: '#6699e8',
  noteLeftBlackBottom: '#1f4f9a',
  activeLeftWhite: '#bfd8ff',
  activeRightWhite: '#c3eecc',
  activeLeftBlack: '#4a87d6',
  activeRightBlack: '#3aa14b',
  middleC: '#ff3d57',
  octaveLabel: '#a8a4b6',
  noteLabel: 'rgba(255, 255, 255, 0.95)',
  // Trace fantôme : violet doux, dégradé du clair vers le saturé.
  ghostTop: '#c4b5fd',
  ghostBottom: '#7c3aed',
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

  private intro: { overlay: IntroOverlay; startedAt: number } | null = null;

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

    // Mode « cartouche d'intro » (export vidéo) : on ignore l'état piano et on
    // dessine titre + artiste avec un fondu in/hold/out. Cela écrase le canvas
    // à chaque frame pour ne pas être recouvert par les rendus normaux.
    if (this.intro) {
      paintIntro(ctx, width, height, this.intro);
      this.lastFrameHash = '';
      return;
    }

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

    paintBackground(ctx, width, height);

    drawFallingNotes(
      ctx,
      layout,
      fallZoneHeight,
      notes,
      state.currentTime,
      state.lookAhead,
      state.ghostNotes ?? false,
    );

    paintHitLine(ctx, width, fallZoneHeight);

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

  beginIntro(overlay: IntroOverlay): void {
    this.intro = { overlay, startedAt: performance.now() };
    this.lastFrameHash = '';
  }

  endIntro(): void {
    this.intro = null;
    this.lastFrameHash = '';
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
    const ghost = state.ghostNotes ? 'g' : '';
    return `${t}|${ahead}|${range}|${activeKey}|${ghost}`;
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

function paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, COLORS.bgTop);
  grad.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function paintHitLine(ctx: CanvasRenderingContext2D, width: number, y: number): void {
  // Halo diffus, plus court et plus pâle que la version d'origine pour ne pas
  // fatiguer les yeux pendant la lecture.
  const halo = ctx.createLinearGradient(0, y - 8, 0, y);
  halo.addColorStop(0, 'rgba(255, 61, 87, 0)');
  halo.addColorStop(1, COLORS.hitLineGlow);
  ctx.fillStyle = halo;
  ctx.fillRect(0, y - 8, width, 8);

  // Ligne fine par-dessus
  ctx.fillStyle = COLORS.hitLine;
  ctx.fillRect(0, y - 1, width, 1.5);
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

  const blackHeight = keyboardHeight * 0.62;

  // Dégradés réutilisés pour toutes les touches : on les crée une seule fois.
  const whiteGrad = ctx.createLinearGradient(0, 0, 0, keyboardHeight);
  whiteGrad.addColorStop(0, COLORS.whiteKeyTop);
  whiteGrad.addColorStop(1, COLORS.whiteKeyBottom);

  const blackGrad = ctx.createLinearGradient(0, 0, 0, blackHeight);
  blackGrad.addColorStop(0, COLORS.blackKeyTop);
  blackGrad.addColorStop(1, COLORS.blackKeyBottom);

  // Touches blanches : remplissage en dégradé + ombre subtile en bas
  for (const key of layout.keys) {
    if (key.isBlack) continue;
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(key.x, 0, key.width, keyboardHeight);

    ctx.strokeStyle = COLORS.keyBorder;
    ctx.lineWidth = 1;
    ctx.strokeRect(key.x + 0.5, 0.5, key.width - 1, keyboardHeight - 1);

    // Liseré coloré en bas de la touche, accent musical
    ctx.fillStyle = 'rgba(124, 58, 237, 0.18)';
    ctx.fillRect(key.x, keyboardHeight - 3, key.width, 3);

    if (key.midi % 12 === 0) {
      ctx.fillStyle = COLORS.octaveLabel;
      ctx.font = "600 10px 'Inter Variable', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`C${octaveOf(key.midi)}`, key.x + key.width / 2, keyboardHeight - 6);
    }
  }

  // Ombre portée des touches noires (avant les touches noires elles-mêmes)
  for (const key of layout.keys) {
    if (!key.isBlack) continue;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(key.x - 1, 0, key.width + 2, blackHeight + 4);
  }

  // Touches noires en dégradé + reflet
  for (const key of layout.keys) {
    if (!key.isBlack) continue;
    ctx.fillStyle = blackGrad;
    ctx.fillRect(key.x, 0, key.width, blackHeight);

    // Reflet horizontal très subtil au sommet
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(key.x + 1, 1, key.width - 2, 2);
  }

  // Repère Do central (C4 = 60) : pastille avec léger halo
  const c4 = layout.keys.find((k) => k.midi === 60);
  if (c4) {
    const cx = c4.x + c4.width / 2;
    const cy = keyboardHeight - 16;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 7);
    halo.addColorStop(0, 'rgba(255, 61, 87, 0.55)');
    halo.addColorStop(1, 'rgba(255, 61, 87, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.middleC;
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
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
  const blackHeight = keyboardHeight * 0.62;

  for (const key of layout.keys) {
    const hand = active.get(key.midi);
    if (!hand) continue;

    if (key.isBlack) {
      // Halo doux autour de la touche pour donner l'impression qu'elle s'allume
      ctx.fillStyle = hand === 'left' ? 'rgba(74, 135, 214, 0.35)' : 'rgba(58, 161, 75, 0.35)';
      ctx.fillRect(key.x - 3, yOffset - 4, key.width + 6, blackHeight + 4);

      ctx.fillStyle = hand === 'left' ? COLORS.activeLeftBlack : COLORS.activeRightBlack;
      ctx.fillRect(key.x, yOffset, key.width, blackHeight);

      // Reflet brillant
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.fillRect(key.x + 1, yOffset + 1, key.width - 2, 2);
    } else {
      // Sur la portion supérieure d'une blanche, des touches noires peuvent
      // empiéter latéralement : on clippe le glow pour ne pas peindre sous une
      // noire (sinon la blanche allumée déborde sur la noire voisine).
      const half = layout.blackWidth / 2;
      const padLeft = isBlackKey(key.midi - 1) ? half : 1;
      const padRight = isBlackKey(key.midi + 1) ? half : 1;
      const topX = key.x + padLeft;
      const topW = Math.max(2, key.width - padLeft - padRight);

      const grad = ctx.createLinearGradient(0, yOffset, 0, yOffset + keyboardHeight);
      grad.addColorStop(0, hand === 'left' ? COLORS.activeLeftWhite : COLORS.activeRightWhite);
      grad.addColorStop(1, hand === 'left' ? '#dceaff' : '#daf3df');
      ctx.fillStyle = grad;
      // Zone haute (sous les noires éventuelles) — clipée horizontalement.
      ctx.fillRect(topX, yOffset + 1, topW, blackHeight);
      // Zone basse (toujours visible) — pleine largeur.
      ctx.fillRect(
        key.x + 1,
        yOffset + blackHeight,
        key.width - 2,
        keyboardHeight - blackHeight - 1,
      );

      // Liseré coloré renforcé en bas
      ctx.fillStyle = hand === 'left' ? 'rgba(58, 123, 213, 0.65)' : 'rgba(63, 163, 77, 0.65)';
      ctx.fillRect(key.x, yOffset + keyboardHeight - 3, key.width, 3);

      // Restaure l'étiquette d'octave si présente sur cette touche
      if (key.midi % 12 === 0) {
        ctx.fillStyle = COLORS.octaveLabel;
        ctx.font = "600 10px 'Inter Variable', system-ui, sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`C${octaveOf(key.midi)}`, key.x + key.width / 2, yOffset + keyboardHeight - 6);
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
  ghostsEnabled: boolean,
): void {
  const pxPerSecond = fallZoneHeight / lookAhead;
  const windowEnd = currentTime + lookAhead;
  // En mode fantôme, on étire la fenêtre de visibilité dans le passé pour
  // continuer à dessiner les notes qui viennent juste de franchir la ligne.
  const windowStart = ghostsEnabled ? currentTime - GHOST_DURATION : currentTime;

  for (const note of notes) {
    if (!isVisibleInWindow(note, windowStart, windowEnd)) continue;
    if (note.midi < layout.firstMidi || note.midi > layout.lastMidi) continue;

    const isBlack = isBlackKey(note.midi);
    const cx = noteCenterX(note.midi, layout);
    let x: number;
    let w: number;
    if (isBlack) {
      w = layout.blackWidth;
      x = cx - w / 2;
    } else {
      // Une touche blanche est partiellement recouverte par les touches noires
      // adjacentes : on rétrécit la note de la moitié de la largeur d'une noire
      // de chaque côté lorsqu'il y en a une. La surbrillance reste cantonnée à
      // la zone strictement « blanche » de la touche.
      const left = cx - layout.whiteWidth / 2;
      const right = cx + layout.whiteWidth / 2;
      const half = layout.blackWidth / 2;
      const padLeft = isBlackKey(note.midi - 1) ? half : layout.whiteWidth * 0.04;
      const padRight = isBlackKey(note.midi + 1) ? half : layout.whiteWidth * 0.04;
      x = left + padLeft;
      w = Math.max(2, right - padRight - x);
    }

    const noteEnd = endTime(note);
    const isGhost = ghostsEnabled && noteEnd < currentTime;

    if (isGhost) {
      // Note "passée" : on la fige juste au-dessus de la ligne de hit, on la
      // fait rétrécir et fondre en violet pour évoquer un sillage.
      const age = currentTime - noteEnd;
      const fade = Math.max(0, 1 - age / GHOST_DURATION);
      if (fade <= 0) continue;
      const fullH = note.duration * pxPerSecond;
      const h = Math.max(4, fullH * fade);
      const yBottom = fallZoneHeight;
      const yTop = yBottom - h;

      ctx.save();
      ctx.globalAlpha = fade * 0.55;
      roundedRect(ctx, x, yTop, w, h, 7);
      const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
      grad.addColorStop(0, COLORS.ghostTop);
      grad.addColorStop(1, COLORS.ghostBottom);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
      continue;
    }

    const yBottom = fallZoneHeight - (note.time - currentTime) * pxPerSecond;
    const h = note.duration * pxPerSecond;
    const yTop = yBottom - h;

    const isRight = note.hand === 'right';
    const topColor = isRight
      ? isBlack
        ? COLORS.noteRightBlackTop
        : COLORS.noteRightTop
      : isBlack
        ? COLORS.noteLeftBlackTop
        : COLORS.noteLeftTop;
    const bottomColor = isRight
      ? isBlack
        ? COLORS.noteRightBlackBottom
        : COLORS.noteRightBottom
      : isBlack
        ? COLORS.noteLeftBlackBottom
        : COLORS.noteLeftBottom;
    const strokeColor = isRight ? COLORS.noteRightStroke : COLORS.noteLeftStroke;

    // Forme arrondie + dégradé vertical : plus clair en haut (la note arrive
    // de la fenêtre lumineuse), plus saturé près du clavier.
    roundedRect(ctx, x, yTop, w, h, 7);
    const grad = ctx.createLinearGradient(0, yTop, 0, yBottom);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fill();

    // Reflet brillant le long du bord supérieur
    if (h > 14) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillRect(x + 2, yTop + 2, w - 4, 1.5);
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    if (h > 28 && !isBlack) {
      ctx.fillStyle = COLORS.noteLabel;
      ctx.font = "600 12px 'Inter Variable', system-ui, sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(midiToNoteName(note.midi), x + w / 2, yBottom - 12);
    }
  }
}

function paintIntro(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intro: { overlay: IntroOverlay; startedAt: number },
): void {
  const elapsed = performance.now() - intro.startedAt;
  const total = intro.overlay.durationMs;
  // Fondu in (15 %), maintien (70 %), fondu out (15 %).
  const fadeIn = total * 0.15;
  const fadeOut = total * 0.15;
  let alpha = 1;
  if (elapsed < fadeIn) alpha = elapsed / fadeIn;
  else if (elapsed > total - fadeOut) alpha = Math.max(0, (total - elapsed) / fadeOut);

  // Fond très sombre, identique au reste du rendu.
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#08060f');
  bg.addColorStop(1, '#0e0a18');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Halo central diffus, dégradé violet → vert (cohérent avec la home).
  const cx = width / 2;
  const cy = height / 2;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.6);
  halo.addColorStop(0, `rgba(167, 139, 250, ${0.35 * alpha})`);
  halo.addColorStop(0.5, `rgba(34, 197, 94, ${0.18 * alpha})`);
  halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const titleSize = Math.min(96, Math.max(36, width * 0.07));
  ctx.font = `700 ${titleSize}px 'Outfit Variable', 'Inter Variable', system-ui, sans-serif`;
  ctx.fillStyle = '#ece9ff';
  ctx.fillText(intro.overlay.title, cx, cy - titleSize * 0.3);

  if (intro.overlay.subtitle) {
    const subtitleSize = Math.max(18, titleSize * 0.45);
    ctx.font = `500 ${subtitleSize}px 'Inter Variable', system-ui, sans-serif`;
    ctx.fillStyle = '#b6afd2';
    ctx.fillText(intro.overlay.subtitle, cx, cy + titleSize * 0.6);
  }

  ctx.globalAlpha = 1;
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
