import { Accidental, Formatter, Renderer, Stave, StaveConnector, StaveNote, Voice } from 'vexflow';
import type {
  IntroOverlay,
  RendererPort,
  RenderState,
} from '../../../application/ports/RendererPort';
import type { Song } from '../../../domain/Song';
import { midiToVexKey, type ScoreEvent, songToScore, type VexDuration } from './songToScore';

/**
 * Adapter du RendererPort qui rend la partition (portée 5 lignes, grand staff
 * clé de sol + clé de fa) via VexFlow.
 *
 * Stratégie de performance : la partition complète est dessinée une seule
 * fois sur un canvas off-screen quand la chanson change. À chaque frame on
 * recopie ce cache avec un décalage horizontal pour faire défiler la portée
 * sous une ligne de tête de lecture fixe (~30 % de la largeur, à gauche).
 *
 * Limitations V1 :
 *  - Tempo fixé à 120 BPM (q = 0.5 s) pour la quantification des durées.
 *  - Pas de signature de mesure ni de barres : un seul flux horizontal continu.
 *  - Pas de surbrillance des notes courantes (juste la ligne de tête de lecture).
 *  - L'export vidéo n'est pas optimisé en mode partition (le défilement
 *    horizontal est lent à enregistrer sans lookAhead pertinent).
 */
const PX_PER_QUARTER = 60;
const QUARTER_SEC = 0.5;
const PX_PER_SEC = PX_PER_QUARTER / QUARTER_SEC;
const STAFF_HEIGHT = 280; // hauteur totale du grand staff (treble + bass)
const STAFF_TOP = 30;
const STAFF_BASS_TOP = 130;
const INITIAL_OFFSET = 80; // espace pour la clé + signature avant la 1re note
const PLAYHEAD_X_RATIO = 0.3;

interface TimeMarker {
  readonly time: number;
  readonly x: number;
}

export class SheetMusicRenderer implements RendererPort {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;

  private cssWidth = 0;
  private cssHeight = 0;
  private dpr = 1;
  private resizeListener: () => void;

  private cachedSong: Song | null = null;
  private cachedScore: HTMLCanvasElement | null = null;
  /** Tableau trié par time, sert au mapping time → x (interpolation linéaire). */
  private timeMarkers: TimeMarker[] = [];
  private cachedScoreWidth = 0;

  private intro: { overlay: IntroOverlay; startedAt: number } | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.resizeListener = () => this.resize();
    window.addEventListener('resize', this.resizeListener);
    this.resize();
  }

  resize(): void {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    this.dpr = window.devicePixelRatio || 1;
    this.cssWidth = parent.clientWidth;
    this.cssHeight = parent.clientHeight;
    this.canvas.style.width = `${this.cssWidth}px`;
    this.canvas.style.height = `${this.cssHeight}px`;
    this.canvas.width = Math.round(this.cssWidth * this.dpr);
    this.canvas.height = Math.round(this.cssHeight * this.dpr);
    this.ctx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(state: RenderState): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const w = this.cssWidth;
    const h = this.cssHeight;
    if (w === 0 || h === 0) return;

    if (this.intro) {
      paintIntro(ctx, w, h, this.intro);
      return;
    }

    paintBackground(ctx, w, h);
    if (!state.song) return;

    if (state.song !== this.cachedSong) {
      this.buildScoreCache(state.song);
      this.cachedSong = state.song;
    }
    if (!this.cachedScore) return;

    const playheadX = w * PLAYHEAD_X_RATIO;
    const targetX = this.timeToScoreX(state.currentTime);
    const offset = targetX - playheadX;

    // La partition est centrée verticalement dans la zone de canvas.
    const top = Math.max(0, (h - STAFF_HEIGHT) / 2);
    ctx.drawImage(
      this.cachedScore,
      0,
      0,
      this.cachedScoreWidth,
      STAFF_HEIGHT,
      -offset,
      top,
      this.cachedScoreWidth,
      STAFF_HEIGHT,
    );

    // Ligne de tête de lecture (rouge, fine, halo discret)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 61, 87, 0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255, 61, 87, 0.5)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(playheadX, top - 10);
    ctx.lineTo(playheadX, top + STAFF_HEIGHT + 10);
    ctx.stroke();
    ctx.restore();
  }

  captureStream(fps: number): MediaStream {
    return this.canvas.captureStream(fps);
  }

  beginIntro(overlay: IntroOverlay): void {
    this.intro = { overlay, startedAt: performance.now() };
  }

  endIntro(): void {
    this.intro = null;
  }

  dispose(): void {
    window.removeEventListener('resize', this.resizeListener);
    this.cachedScore = null;
    this.timeMarkers = [];
  }

  private timeToScoreX(time: number): number {
    if (this.timeMarkers.length === 0) return INITIAL_OFFSET;
    if (time <= this.timeMarkers[0].time) return this.timeMarkers[0].x;
    const last = this.timeMarkers[this.timeMarkers.length - 1];
    if (time >= last.time) {
      // Extrapolation linéaire pour les notes après le dernier marker.
      return last.x + (time - last.time) * PX_PER_SEC;
    }
    // Recherche dichotomique du segment encadrant.
    let lo = 0;
    let hi = this.timeMarkers.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.timeMarkers[mid].time <= time) lo = mid;
      else hi = mid;
    }
    const a = this.timeMarkers[lo];
    const b = this.timeMarkers[hi];
    const t = (time - a.time) / Math.max(1e-6, b.time - a.time);
    return a.x + t * (b.x - a.x);
  }

  private buildScoreCache(song: Song): void {
    const score = songToScore(song);
    const totalWidth = Math.max(800, INITIAL_OFFSET + Math.ceil(song.duration * PX_PER_SEC) + 200);
    // Limite raisonnable pour ne pas exploser la mémoire canvas (Chrome ~32k).
    const cappedWidth = Math.min(totalWidth, 16000);
    this.cachedScoreWidth = cappedWidth;

    const cache = document.createElement('canvas');
    cache.width = cappedWidth;
    cache.height = STAFF_HEIGHT;
    this.cachedScore = cache;

    const renderer = new Renderer(cache, Renderer.Backends.CANVAS);
    renderer.resize(cappedWidth, STAFF_HEIGHT);
    const ctx = renderer.getContext();
    ctx.setFillStyle('#0d0a18');
    ctx.fillRect(0, 0, cappedWidth, STAFF_HEIGHT);
    ctx.setFillStyle('#e8e6f0');
    ctx.setStrokeStyle('#e8e6f0');

    // Grand staff : portée du haut (clé de sol) + portée du bas (clé de fa) +
    // accolade qui les relie.
    const trebleStave = new Stave(0, STAFF_TOP, cappedWidth);
    trebleStave.addClef('treble');
    trebleStave.setContext(ctx).draw();

    const bassStave = new Stave(0, STAFF_BASS_TOP, cappedWidth);
    bassStave.addClef('bass');
    bassStave.setContext(ctx).draw();

    new StaveConnector(trebleStave, bassStave)
      .setType(StaveConnector.type.BRACE)
      .setContext(ctx)
      .draw();
    new StaveConnector(trebleStave, bassStave)
      .setType(StaveConnector.type.SINGLE_LEFT)
      .setContext(ctx)
      .draw();

    const trebleNotes = buildVexNotes(score.treble, 'treble');
    const bassNotes = buildVexNotes(score.bass, 'bass');

    if (trebleNotes.length > 0) {
      const voice = new Voice({ numBeats: trebleNotes.length, beatValue: 4 });
      voice.setMode(Voice.Mode.SOFT);
      voice.addTickables(trebleNotes.map((n) => n.note));
      new Formatter().joinVoices([voice]).format([voice], cappedWidth - INITIAL_OFFSET - 40);
      voice.draw(ctx, trebleStave);
    }

    if (bassNotes.length > 0) {
      const voice = new Voice({ numBeats: bassNotes.length, beatValue: 4 });
      voice.setMode(Voice.Mode.SOFT);
      voice.addTickables(bassNotes.map((n) => n.note));
      new Formatter().joinVoices([voice]).format([voice], cappedWidth - INITIAL_OFFSET - 40);
      voice.draw(ctx, bassStave);
    }

    // Construction de la table time → x. On combine les deux mains, on dédoublonne
    // par temps, et on utilise getAbsoluteX() après formatage pour avoir les
    // positions réelles.
    const markers: TimeMarker[] = [];
    for (const item of [...trebleNotes, ...bassNotes]) {
      markers.push({ time: item.event.time, x: item.note.getAbsoluteX() });
    }
    markers.sort((a, b) => a.time - b.time);
    // Dédoublonnage (garder la 1re x rencontrée pour chaque time, choix arbitraire
    // mais cohérent entre les mains).
    const dedup: TimeMarker[] = [];
    for (const m of markers) {
      const prev = dedup[dedup.length - 1];
      if (!prev || Math.abs(prev.time - m.time) > 0.005) {
        dedup.push(m);
      }
    }
    this.timeMarkers = dedup;
  }
}

interface VexNoteWithEvent {
  readonly note: StaveNote;
  readonly event: ScoreEvent;
}

function buildVexNotes(events: readonly ScoreEvent[], clef: 'treble' | 'bass'): VexNoteWithEvent[] {
  const out: VexNoteWithEvent[] = [];
  for (const ev of events) {
    const keys = ev.midis.map(midiToVexKey);
    const note = new StaveNote({ keys, duration: ev.duration as VexDuration, clef });
    // Ajout des altérations (#) pour les notes diésées (parcours sur l'index
    // pour conserver la correspondance avec les `keys` de StaveNote).
    for (let idx = 0; idx < keys.length; idx++) {
      const name = keys[idx].split('/')[0];
      if (name.includes('#')) {
        note.addModifier(new Accidental('#'), idx);
      }
    }
    out.push({ note, event: ev });
  }
  return out;
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#08060f');
  grad.addColorStop(1, '#0e0a18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function paintIntro(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  intro: { overlay: IntroOverlay; startedAt: number },
): void {
  const elapsed = performance.now() - intro.startedAt;
  const total = intro.overlay.durationMs;
  const fade = Math.min(1, elapsed / 400, (total - elapsed) / 400);
  const alpha = Math.max(0, fade);
  ctx.fillStyle = '#0a0814';
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = '600 56px Outfit Variable, system-ui, sans-serif';
  ctx.fillText(intro.overlay.title, w / 2, h / 2);
  if (intro.overlay.subtitle) {
    ctx.font = '400 22px Inter Variable, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(intro.overlay.subtitle, w / 2, h / 2 + 50);
  }
  ctx.restore();
}
