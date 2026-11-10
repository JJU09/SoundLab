// 곡 스케치 오디오 — 파트별 음색·버스·마스터(컴프레서+리미터), 실시간 스케줄러, WAV 오프라인 렌더.
// 같은 이벤트(lib/sketch stepEvents)를 실시간 AudioContext와 OfflineAudioContext 양쪽에 그린다.
import { hit, type DrumTrack } from './drums';
import { midiToFreq } from '../lib/music';
import { stepEvents, SONG_STEPS, SEC_STEPS, SECTIONS, PARTS, type Song, type Ev, type PartId, type SectionId } from '../lib/sketch';

// drums.hit()이 기대하는 최소 코어 모양 (ctx · input · gain)
interface MiniCore { ctx: BaseAudioContext; input: AudioNode; gain(v?: number): GainNode; }
const mini = (ctx: BaseAudioContext, input: AudioNode): MiniCore => ({
  ctx, input, gain(v?: number) { const g = ctx.createGain(); if (v != null) g.gain.value = v; return g; },
});

function impulse(ctx: BaseAudioContext, sec = 1.6, decay = 3) {
  const len = Math.floor(sec * ctx.sampleRate), buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return buf;
}

// 믹스 그래프: 파트 버스 → (리버브 센드) → 마스터 컴프 → 리미터 → 출력
export class SketchGraph {
  bus = {} as Record<PartId, GainNode>;
  master: GainNode; out: AudioNode; analyser?: AnalyserNode;
  constructor(public ctx: BaseAudioContext, dest: AudioNode) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 2.5; comp.attack.value = 0.02; comp.release.value = 0.2; comp.knee.value = 6;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -3; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.08; lim.knee.value = 0;
    this.master = ctx.createGain(); this.master.gain.value = 0.85;
    const rev = ctx.createConvolver(); rev.buffer = impulse(ctx); const revOut = ctx.createGain(); revOut.gain.value = 0.22;
    rev.connect(revOut); revOut.connect(comp);
    comp.connect(lim); lim.connect(this.master); this.master.connect(dest); this.out = this.master;
    const send: Record<PartId, number> = { drums: 0.04, bass: 0, chords: 0.35, melody: 0.3 };
    for (const p of PARTS) {
      const g = ctx.createGain(); g.connect(comp);
      if (send[p]) { const s = ctx.createGain(); s.gain.value = send[p]; g.connect(s); s.connect(rev); }
      this.bus[p] = g;
    }
  }
  setVolumes(song: Song) { for (const p of PARTS) this.bus[p].gain.value = Math.pow(song.vol[p] / 100, 1.6) * 1.1; }
}

// ── 음색 ──
function osc(ctx: BaseAudioContext, type: OscillatorType, f: number, t: number, end: number, dest: AudioNode, amp = 1, detune = 0) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = detune;
  const a = ctx.createGain(); a.gain.value = amp; o.connect(a); a.connect(dest); o.start(t); o.stop(end);
  o.onended = () => { try { o.disconnect(); a.disconnect(); } catch (e) {} };
}
function envGain(ctx: BaseAudioContext, dest: AudioNode, t: number, peak: number, attack: number, hold: number, release: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + Math.max(attack, hold));
  g.gain.setTargetAtTime(0.0001, t + Math.max(attack, hold), release / 4);
  g.connect(dest);
  return g;
}
function lowpass(ctx: BaseAudioContext, dest: AudioNode, f: number, q = 0.7) {
  const l = ctx.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = f; l.Q.value = q; l.connect(dest); return l;
}

function playNote(ctx: BaseAudioContext, song: Song, ev: Extract<Ev, { kind: 'note' }>, t: number, dur: number, dest: AudioNode) {
  const f = midiToFreq(ev.midi), v = ev.vel, end = t + dur + 1.2;
  if (ev.part === 'chords') {
    const inst = song.inst.chords;
    if (inst === 'keys') {           // 피아노풍: 삼각파 + 2배음, 감쇠
      const g = ctx.createGain(); g.connect(dest);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v * 0.32, t + 0.01);
      g.gain.exponentialRampToValueAtTime(v * 0.12, t + 0.35); g.gain.setTargetAtTime(0.0001, t + dur, 0.12);
      osc(ctx, 'triangle', f, t, end, g, 1); osc(ctx, 'sine', f * 2, t, end, g, 0.2);
    } else if (inst === 'pad') {     // 패드: 디튠 톱니 2개 + 로우패스, 느린 어택
      const g = envGain(ctx, lowpass(ctx, dest, 1400), t, v * 0.16, 0.35, dur, 0.6);
      osc(ctx, 'sawtooth', f, t, end, g, 1, -8); osc(ctx, 'sawtooth', f, t, end, g, 1, 8);
    } else {                         // 플럭: 사각파 짧게
      const g = envGain(ctx, lowpass(ctx, dest, 2200), t, v * 0.2, 0.005, 0.02, Math.min(0.5, dur));
      osc(ctx, 'square', f, t, t + 0.9, g, 1);
    }
  } else if (ev.part === 'bass') {
    const inst = song.inst.bass;
    if (inst === 'sub') { const g = envGain(ctx, dest, t, v * 0.55, 0.01, dur, 0.12); osc(ctx, 'sine', f, t, end, g, 1); osc(ctx, 'triangle', f * 2, t, end, g, 0.15); }
    else if (inst === 'synth') { const g = envGain(ctx, lowpass(ctx, dest, 650, 3), t, v * 0.3, 0.008, dur, 0.1); osc(ctx, 'sawtooth', f, t, end, g, 1); osc(ctx, 'sine', f / 2, t, end, g, 0.6); }
    else { const g = envGain(ctx, lowpass(ctx, dest, 900), t, v * 0.5, 0.004, 0.05, Math.min(0.6, dur)); osc(ctx, 'triangle', f, t, t + 1.2, g, 1); }
  } else {
    const inst = song.inst.melody;
    if (inst === 'soft') { const g = envGain(ctx, dest, t, v * 0.3, 0.03, dur, 0.15); osc(ctx, 'triangle', f, t, end, g, 1); osc(ctx, 'sine', f * 2, t, end, g, 0.12); }
    else if (inst === 'bright') { const g = envGain(ctx, lowpass(ctx, dest, 3200), t, v * 0.16, 0.01, dur, 0.12); osc(ctx, 'square', f, t, end, g, 1, -4); osc(ctx, 'sawtooth', f, t, end, g, 0.5, 4); }
    else { const g = envGain(ctx, dest, t, v * 0.32, 0.003, 0.03, Math.min(1.4, dur + 0.6)); osc(ctx, 'sine', f, t, end, g, 1); osc(ctx, 'sine', f * 3, t, t + 0.4, g, 0.25); osc(ctx, 'sine', f * 4.2, t, t + 0.2, g, 0.1); }
  }
}

export function scheduleStep(graph: SketchGraph, song: Song, g: number, songStart: number) {
  const spStep = 60 / song.bpm / 4;
  for (const ev of stepEvents(song, g)) {
    const t = songStart + ev.at * spStep;
    if (ev.kind === 'drum') hit(mini(graph.ctx, graph.bus.drums) as any, ev.track as DrumTrack, t, ev.vel);
    else playNote(graph.ctx, song, ev, t, ev.dur * spStep, graph.bus[ev.part]);
  }
}

// ── 실시간 재생 ──
export type LoopRange = 'song' | SectionId;
export class SketchPlayer {
  ctx: AudioContext | null = null; graph: SketchGraph | null = null;
  playing = false; private timer = 0; private next = 0; private nextTime = 0;
  range: LoopRange = 'song';
  constructor(public getSong: () => Song, public onStep?: (g: number) => void) {}
  private bounds() {
    if (this.range === 'song') return [0, SONG_STEPS];
    const i = SECTIONS.indexOf(this.range); return [i * SEC_STEPS, (i + 1) * SEC_STEPS];
  }
  async start(range: LoopRange = this.range) {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.graph = new SketchGraph(this.ctx, this.ctx.destination);
      try { (window as any).gtag?.('event', 'audio_play', { page_path: location.pathname }); } catch (e) {}
    }
    await this.ctx.resume();
    this.graph!.master.gain.cancelScheduledValues(this.ctx.currentTime); this.graph!.master.gain.setValueAtTime(0.85, this.ctx.currentTime);
    this.range = range; this.playing = true;
    const [a] = this.bounds();
    this.next = a; this.nextTime = this.ctx.currentTime + 0.08;
    clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
  }
  private tick() {
    if (!this.playing || !this.ctx || !this.graph) return;
    const song = this.getSong(); this.graph.setVolumes(song);
    const spStep = 60 / song.bpm / 4; const [a, b] = this.bounds();
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const g = this.next;
      // 이 스텝의 시작 시간에서 "곡 처음" 기준 시간을 역산해 stepEvents의 at(곡 기준)을 맞춘다
      scheduleStep(this.graph, song, g, this.nextTime - g * spStep);
      const at = this.nextTime, gg = g;
      setTimeout(() => this.onStep?.(gg), Math.max(0, (at - this.ctx!.currentTime) * 1000));
      this.next = g + 1 >= b ? a : g + 1;
      this.nextTime += spStep;
    }
  }
  stop() {
    this.playing = false; clearInterval(this.timer);
    if (this.graph && this.ctx) { const m = this.graph.master.gain; m.setTargetAtTime(0, this.ctx.currentTime, 0.03); setTimeout(() => { if (!this.playing) m.setTargetAtTime(0.85, this.ctx!.currentTime, 0.01); }, 250); }
    this.onStep?.(-1);
  }
  // 한 음 미리듣기 (편집할 때)
  async preview(part: Exclude<PartId, 'drums'>, midi: number) {
    if (!this.ctx) { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); this.graph = new SketchGraph(this.ctx, this.ctx.destination); }
    await this.ctx.resume(); const song = this.getSong(); this.graph!.setVolumes(song);
    playNote(this.ctx, song, { kind: 'note', part, midi, at: 0, dur: 2, vel: 0.55 }, this.ctx.currentTime + 0.01, 0.35, this.graph!.bus[part]);
  }
  async previewDrum(track: DrumTrack) {
    if (!this.ctx) { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); this.graph = new SketchGraph(this.ctx, this.ctx.destination); }
    await this.ctx.resume(); this.graph!.setVolumes(this.getSong());
    hit(mini(this.ctx, this.graph!.bus.drums) as any, track, this.ctx.currentTime + 0.01, 0.85);
  }
}

// ── WAV 내보내기 ──
export async function renderWav(song: Song, sampleRate = 44100): Promise<Blob> {
  const spStep = 60 / song.bpm / 4;
  const seconds = SONG_STEPS * spStep + 2.2; // 마지막 음 여운
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  const graph = new SketchGraph(ctx, ctx.destination); graph.setVolumes(song);
  for (let g = 0; g < SONG_STEPS; g++) scheduleStep(graph, song, g, 0.05);
  const buf = await ctx.startRendering();
  return encodeWav(buf);
}

// 16bit PCM 스테레오 WAV (TPDF 디더 — 32bit float → 16bit 마지막 한 번)
export function encodeWav(buf: AudioBuffer): Blob {
  const ch = Math.min(2, buf.numberOfChannels), n = buf.length, sr = buf.sampleRate;
  const data = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); data.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); data.setUint32(16, 16, true); data.setUint16(20, 1, true); data.setUint16(22, ch, true);
  data.setUint32(24, sr, true); data.setUint32(28, sr * ch * 2, true); data.setUint16(32, ch * 2, true); data.setUint16(34, 16, true);
  str(36, 'data'); data.setUint32(40, n * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const dither = (Math.random() - Math.random()) / 32768;
    const x = Math.max(-1, Math.min(1, chans[c][i] + dither));
    data.setInt16(o, x < 0 ? x * 0x8000 : x * 0x7fff, true); o += 2;
  }
  return new Blob([data], { type: 'audio/wav' });
}
