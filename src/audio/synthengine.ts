// 연주 가능한 폴리 신스 엔진 — 신디시스 샌드박스의 토대.
// AudioCore의 네 번째 소비자. 모든 음원 합성(샘플 없음).
//
//   키별 보이스: [OSC A]→gA ┐
//                [OSC B]→gB ┴→ amp(ADSR) ─┐
//                                          ├→ filter(lowpass + 엔벨로프) → out → core.input
//   글로벌 LFO → (pitch=각 보이스 detune / filter=cutoff / amp=out.gain) 로 라우팅.
//
// 필터는 공유 1개(폴리에서 단순·교육적). 필터 엔벨로프는 noteOn마다 재트리거(last-note).
import type { AudioCore } from './core';

export type LfoTarget = 'off' | 'pitch' | 'filter' | 'amp';

interface Voice {
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  amp: GainNode;
  gA: GainNode;
  gB: GainNode;
}

export class SynthEngine {
  // ── 파라미터 ──
  waveA: OscillatorType = 'sawtooth';
  waveB: OscillatorType = 'sawtooth';
  detune = 0;        // OSC B 디튠 (cents)
  oscMix = 0.35;     // 0 = A만, 1 = B만
  octave = 0;        // -2..+2
  cutoff = 3000;     // Hz
  resonance = 3;     // Q
  filterEnv = 0;     // 0..1 (어택 시 cutoff 위로 띄울 양)
  attack = 0.01;     // s
  decay = 0.25;      // s
  sustain = 0.7;     // 0..1
  release = 0.35;    // s
  lfoRate = 5;       // Hz
  lfoDepth = 0;      // 0..1 정규화
  lfoTarget: LfoTarget = 'off';
  peak = 0.22;       // 보이스당 피크(폴리 헤드룸)

  private voices = new Map<number, Voice>();
  private filter: BiquadFilterNode;
  private out: GainNode;
  private lfo: OscillatorNode;
  private lfoGain: GainNode;

  constructor(private core: AudioCore) {
    const ctx = core.ctx;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.cutoff;
    this.filter.Q.value = this.resonance;
    this.out = core.gain(1);
    this.filter.connect(this.out);
    this.out.connect(core.input);

    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = this.lfoRate;
    this.lfoGain = core.gain(0);
    this.lfo.connect(this.lfoGain);
    this.lfo.start();
    this._routeLfo();
  }

  private _midiToFreq(midi: number) {
    return 440 * Math.pow(2, (midi - 69) / 12) * Math.pow(2, this.octave);
  }

  // ── 발음 ──
  noteOn(midi: number) {
    if (this.voices.has(midi)) return; // 이미 눌림(키 리피트 방지)
    this.core.resume();
    const ctx = this.core.ctx, t = ctx.currentTime;
    const freq = this._midiToFreq(midi);

    const oscA = ctx.createOscillator(); oscA.type = this.waveA; oscA.frequency.value = freq;
    const oscB = ctx.createOscillator(); oscB.type = this.waveB; oscB.frequency.value = freq; oscB.detune.value = this.detune;
    const gA = this.core.gain(1 - this.oscMix);
    const gB = this.core.gain(this.oscMix);
    const amp = this.core.gain(0.0001);
    oscA.connect(gA); gA.connect(amp);
    oscB.connect(gB); gB.connect(amp);
    amp.connect(this.filter);

    // amp ADSR (sustain 유지까지)
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(this.peak, t + this.attack);
    amp.gain.linearRampToValueAtTime(Math.max(0.0001, this.peak * this.sustain), t + this.attack + this.decay);

    // 필터 엔벨로프 (공유 필터, 재트리거) — filterEnv=0이면 움직임 없음
    if (this.filterEnv > 0) {
      const f = this.filter.frequency;
      const top = Math.min(18000, this.cutoff + this.filterEnv * 6000);
      f.cancelScheduledValues(t);
      f.setValueAtTime(top, t);
      f.exponentialRampToValueAtTime(Math.max(40, this.cutoff), t + this.attack + this.decay + 0.01);
    }

    // LFO가 pitch 타겟이면 새 보이스 osc에 연결
    if (this.lfoTarget === 'pitch') { this.lfoGain.connect(oscA.detune); this.lfoGain.connect(oscB.detune); }

    oscA.start(t); oscB.start(t);
    this.voices.set(midi, { oscA, oscB, amp, gA, gB });
  }

  noteOff(midi: number) {
    const v = this.voices.get(midi);
    if (!v) return;
    this.voices.delete(midi);
    const ctx = this.core.ctx, t = ctx.currentTime;
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setValueAtTime(v.amp.gain.value, t);
    v.amp.gain.linearRampToValueAtTime(0.0001, t + this.release);
    const stopAt = t + this.release + 0.05;
    try { v.oscA.stop(stopAt); v.oscB.stop(stopAt); } catch (e) {}
    v.oscA.onended = () => {
      try {
        if (this.lfoTarget === 'pitch') { this.lfoGain.disconnect(v.oscA.detune); this.lfoGain.disconnect(v.oscB.detune); }
      } catch (e) {}
      try { v.oscA.disconnect(); v.oscB.disconnect(); v.gA.disconnect(); v.gB.disconnect(); v.amp.disconnect(); } catch (e) {}
    };
  }

  allOff() { for (const m of [...this.voices.keys()]) this.noteOff(m); }

  // ── 세터 ──
  setCutoff(hz: number) { this.cutoff = hz; this.core.smooth(this.filter.frequency, hz); }
  setResonance(q: number) { this.resonance = q; this.core.smooth(this.filter.Q, q); }
  setDetune(cents: number) { this.detune = cents; for (const v of this.voices.values()) this.core.smooth(v.oscB.detune, cents); }
  setOscMix(m: number) { this.oscMix = m; for (const v of this.voices.values()) { this.core.smooth(v.gA.gain, 1 - m); this.core.smooth(v.gB.gain, m); } }
  setWaveA(w: OscillatorType) { this.waveA = w; for (const v of this.voices.values()) v.oscA.type = w; }
  setWaveB(w: OscillatorType) { this.waveB = w; for (const v of this.voices.values()) v.oscB.type = w; }

  setLfoRate(hz: number) { this.lfoRate = hz; this.core.smooth(this.lfo.frequency, hz); }
  setLfoDepth(d: number) { this.lfoDepth = d; this._routeLfo(); }
  setLfoTarget(t: LfoTarget) { this.lfoTarget = t; this._routeLfo(); }

  // LFO 라우팅 — 타겟에 맞춰 연결 대상·깊이 스케일을 바꾼다.
  private _routeLfo() {
    try { this.lfoGain.disconnect(); } catch (e) {}
    if (this.lfoTarget === 'off' || this.lfoDepth <= 0) { this.core.smooth(this.lfoGain.gain, 0); return; }
    if (this.lfoTarget === 'filter') {
      this.lfoGain.connect(this.filter.frequency);
      this.core.smooth(this.lfoGain.gain, this.lfoDepth * 2000); // ±Hz
    } else if (this.lfoTarget === 'amp') {
      this.lfoGain.connect(this.out.gain);
      this.core.smooth(this.lfoGain.gain, this.lfoDepth * 0.5); // ±게인
    } else if (this.lfoTarget === 'pitch') {
      for (const v of this.voices.values()) { this.lfoGain.connect(v.oscA.detune); this.lfoGain.connect(v.oscB.detune); }
      this.core.smooth(this.lfoGain.gain, this.lfoDepth * 50); // ±cents
    }
  }
}
