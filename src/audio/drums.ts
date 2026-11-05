// 합성 드럼 키트 — 샘플 없이 오실레이터·노이즈로 만든 킥·스네어·하이햇·클랩·오픈햇.
// 리듬 허브의 시퀀서 위젯이 사용한다.
import type { AudioCore } from './core';

export type DrumTrack = 'kick' | 'snare' | 'hat' | 'open' | 'clap';
export const TRACK_LABEL: Record<DrumTrack, string> = { kick: '킥', snare: '스네어', hat: '하이햇', open: '오픈햇', clap: '박수' };

let noiseBuf: AudioBuffer | null = null;
function noise(core: AudioCore) {
  if (noiseBuf && noiseBuf.sampleRate === core.ctx.sampleRate) return noiseBuf;
  const len = core.ctx.sampleRate;
  noiseBuf = core.ctx.createBuffer(1, len, core.ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function env(core: AudioCore, t: number, peak: number, decay: number) {
  const g = core.gain(0.0001);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  g.connect(core.input);
  setTimeout(() => { try { g.disconnect(); } catch (e) {} }, (t - core.ctx.currentTime + decay + 0.3) * 1000);
  return g;
}

function noiseHit(core: AudioCore, t: number, type: BiquadFilterType, freq: number, peak: number, decay: number, q = 0.8) {
  const src = core.ctx.createBufferSource(); src.buffer = noise(core);
  const f = core.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = env(core, t, peak, decay);
  src.connect(f); f.connect(g); src.start(t); src.stop(t + decay + 0.05);
  src.onended = () => { try { src.disconnect(); f.disconnect(); } catch (e) {} };
}

export function hit(core: AudioCore, track: DrumTrack, t: number, vel = 1) {
  if (track === 'kick') {
    const o = core.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = env(core, t, 0.9 * vel, 0.35);
    o.connect(g); o.start(t); o.stop(t + 0.4);
    o.onended = () => { try { o.disconnect(); } catch (e) {} };
  } else if (track === 'snare') {
    noiseHit(core, t, 'bandpass', 1800, 0.5 * vel, 0.18, 0.7);
    const o = core.ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const g = env(core, t, 0.25 * vel, 0.1); o.connect(g); o.start(t); o.stop(t + 0.15);
  } else if (track === 'hat') {
    noiseHit(core, t, 'highpass', 7000, 0.22 * vel, 0.05);
  } else if (track === 'open') {
    noiseHit(core, t, 'highpass', 6500, 0.2 * vel, 0.28);
  } else if (track === 'clap') {
    for (const dt of [0, 0.011, 0.022]) noiseHit(core, t + dt, 'bandpass', 1200, 0.38 * vel, dt === 0.022 ? 0.16 : 0.03, 1.2);
  }
}

// 16스텝 패턴 프리셋 ('x' = 침, 'o' = 약하게, '.' = 쉼)
export interface DrumPreset { id: string; name: string; bpm: number; swing?: number; tracks: Partial<Record<DrumTrack, string>>; desc: string; }
export const PRESETS: Record<string, DrumPreset> = {
  'on-beat':   { id: 'on-beat', name: '정박', bpm: 96, desc: '박마다 정확히 — 1·2·3·4', tracks: { kick: 'x...x...x...x...', clap: 'x...x...x...x...' } },
  'off-beat':  { id: 'off-beat', name: '엇박', bpm: 96, desc: '박과 박 사이(&)만', tracks: { kick: 'x...x...x...x...', clap: '..x...x...x...x.' } },
  'tresillo':  { id: 'tresillo', name: '3-3-2', bpm: 96, desc: '16분음표 3·3·2로 묶은 당김 — 팝·레게톤에서 흔한 리듬', tracks: { kick: 'x...x...x...x...', clap: 'x..x..x.x..x..x.' } },
  'push':      { id: 'push', name: '당겨치기', bpm: 96, desc: '다음 박을 반 박 먼저 — 넷째 박 &에서 미리', tracks: { kick: 'x...x...x...x...', clap: 'x...x...x.....x.' } },
  'rock8':     { id: 'rock8', name: '8비트 록', bpm: 110, desc: '하이햇 8분, 스네어 2·4 — 가장 기본이 되는 드럼', tracks: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' } },
  'pop16':     { id: 'pop16', name: '16비트 팝', bpm: 100, desc: '하이햇 16분으로 촘촘하게 — 댄스 팝·R&B', tracks: { kick: 'x......x..x.....', snare: '....x.......x...', hat: 'xoxoxoxoxoxoxoxo' } },
  'ballad':    { id: 'ballad', name: '발라드', bpm: 70, desc: '느린 8비트, 킥은 적게 — 노래가 앞에 서게', tracks: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' } },
  'house':     { id: 'house', name: '포 온 더 플로어', bpm: 124, desc: '킥 4분 연타 + 뒷박 오픈햇 — 하우스·EDM', tracks: { kick: 'x...x...x...x...', clap: '....x.......x...', open: '..x...x...x...x.' } },
  'boombap':   { id: 'boombap', name: '붐뱁 힙합', bpm: 90, swing: 0.6, desc: '살짝 스윙한 하이햇, 묵직한 킥·스네어', tracks: { kick: 'x......x.x......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' } },
  'shuffle':   { id: 'shuffle', name: '셔플', bpm: 100, swing: 0.67, desc: '8분음표를 셋잇단 2:1로 — 블루스·재즈의 출렁임', tracks: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' } },
};
