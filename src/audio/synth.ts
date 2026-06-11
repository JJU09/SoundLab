// 신스 보이스 — AudioCore 위에 osc + ADSR 엔벨로프 게인을 올려 한 음을 울린다.
// 코어의 두 번째 소비자(SignalSource와 별개). core.input에 연결 → master/analyser 경유.
// = 공유 코어 추상화 검증 지점.
import type { AudioCore } from './core';

export class SynthVoice {
  wave: OscillatorType = 'sawtooth';
  freq = 220;
  attack = 0.01;   // s
  decay = 0.2;     // s
  sustain = 0.6;   // 0..1
  release = 0.4;   // s
  peak = 0.6;

  constructor(private core: AudioCore) {}

  set(param: string, v: number | string) {
    switch (param) {
      case 'attack': this.attack = v as number; break;
      case 'decay': this.decay = v as number; break;
      case 'sustain': this.sustain = v as number; break;
      case 'release': this.release = v as number; break;
      case 'freq': this.freq = v as number; break;
      case 'wave': this.wave = v as OscillatorType; break;
    }
  }

  // 한 음 전체(A→D→sustain 유지(gate초)→R)를 스케줄. 게이트 시간만큼 sustain 레벨 유지 후 릴리즈.
  async trigger(gate = 0.4) {
    await this.core.resume();
    const ctx = this.core.ctx;
    const o = ctx.createOscillator(); o.type = this.wave; o.frequency.value = this.freq;
    const g = this.core.gain(0); o.connect(g); g.connect(this.core.input);

    const t = ctx.currentTime;
    const sus = this.peak * this.sustain;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(this.peak, t + this.attack);                 // Attack
    g.gain.linearRampToValueAtTime(sus, t + this.attack + this.decay);          // Decay → Sustain
    const relStart = t + this.attack + this.decay + gate;
    g.gain.setValueAtTime(Math.max(sus, 0.0001), relStart);                     // Sustain 유지
    g.gain.linearRampToValueAtTime(0.0001, relStart + this.release);            // Release

    o.start(t);
    o.stop(relStart + this.release + 0.05);
    o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (e) {} };
  }
}
