// 건반·오선보용 간단한 피아노풍 음원 — 삼각파 + 2배음 사인, 빠른 어택·자연 감쇠.
// AudioCore 위에서 동작 (제로 에셋 원칙: 샘플 파일 없음).
import type { AudioCore } from './core';
import { midiToFreq } from '../lib/music';

export function playKey(core: AudioCore, midi: number, t0 = core.ctx.currentTime, dur = 1.2, vel = 0.3) {
  const f = midiToFreq(midi);
  const g = core.gain(0.0001);
  g.connect(core.input);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vel, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(vel * 0.35, t0 + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  const parts: [OscillatorType, number, number][] = [['triangle', 1, 1], ['sine', 2, 0.18]];
  for (const [type, mult, amp] of parts) {
    const o = core.ctx.createOscillator();
    o.type = type; o.frequency.value = f * mult;
    const a = core.gain(amp);
    o.connect(a); a.connect(g);
    o.start(t0); o.stop(t0 + dur + 0.05);
    o.onended = () => { try { o.disconnect(); a.disconnect(); } catch (e) {} };
  }
  setTimeout(() => { try { g.disconnect(); } catch (e) {} }, (t0 - core.ctx.currentTime + dur + 0.2) * 1000);
}

// 음 목록을 차례로 (beats: 박 단위 길이 배열, bpm)
export function playSequence(core: AudioCore, notes: { midi: number[]; beats: number }[], bpm = 90) {
  const spb = 60 / bpm;
  let t = core.ctx.currentTime + 0.06;
  for (const n of notes) {
    const d = n.beats * spb;
    for (const m of n.midi) playKey(core, m, t, Math.max(0.35, d * 0.95));
    t += d;
  }
  return t - core.ctx.currentTime; // 총 길이(초)
}
