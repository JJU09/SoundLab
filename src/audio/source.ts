// 신호 소스 — 지속음(tone)/플럭(pluck)/노이즈(noise)를 생성해 core.input으로 흘려보낸다.
// 코어의 첫 번째 소비자. (신디시스 위젯은 이걸 안 쓰고 자체 보이스를 core.input에 연결.)
import type { AudioCore } from './core';
import type { SrcMode } from './types';

export class SignalSource {
  mode: SrcMode = 'tone';
  wave: OscillatorType = 'sine';
  freq = 220;
  tempo = 110;
  active = false; // 현재 소스가 울리는 중인지 (재생 상태)
  outNode: AudioNode | null = null; // 출력 대상 (기본 core.input). 로파이 샌드박스 등에서 처리 노드로 우회.

  private _osc: OscillatorNode | null = null;
  private _noise: AudioBufferSourceNode | null = null;
  private _plkTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private core: AudioCore) {}

  start() { this._start(); this.active = true; }
  stop() { this._stop(); this.active = false; }

  setMode(mode: SrcMode) { this.mode = mode; if (this.active) this._start(); }
  setWave(w: OscillatorType) { this.wave = w; if (this._osc) this._osc.type = w; }
  setFreq(f: number) { this.freq = f; if (this._osc) this.core.smooth(this._osc.frequency, f); }
  setTempo(t: number) { this.tempo = t; if (this.active && this.mode === 'pluck') this._start(); }

  private _stop() {
    if (this._plkTimer) { clearInterval(this._plkTimer); this._plkTimer = null; }
    if (this._osc) { try { this._osc.stop(); } catch (e) {} this._osc.disconnect(); this._osc = null; }
    if (this._noise) { try { this._noise.stop(); } catch (e) {} this._noise.disconnect(); this._noise = null; }
  }

  private _start() {
    this._stop();
    const ctx = this.core.ctx, dest = this.outNode ?? this.core.input;
    if (this.mode === 'tone') {
      const o = ctx.createOscillator(); o.type = this.wave; o.frequency.value = this.freq;
      const g = this.core.gain(0.35); o.connect(g); g.connect(dest); o.start();
      this._osc = o;
    } else if (this.mode === 'noise') {
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
      const g = this.core.gain(0.18); n.connect(g); g.connect(dest); n.start();
      this._noise = n;
    } else {
      const scale = [220, 261.63, 329.63, 440, 329.63, 261.63]; let step = 0;
      const fire = () => {
        const f = scale[step++ % scale.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = this.core.gain(0); o.connect(g); g.connect(dest);
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.4, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.5);
        o.start(t); o.stop(t + 0.6);
      };
      fire();
      this._plkTimer = setInterval(fire, 60000 / this.tempo / 2);
    }
  }
}
