// 가상 페달보드 — 코어/소스/이펙트를 조합해 동적 인스턴스 그래프를 관리한다.
// 코어의 input ~ master 사이에 이펙트 인스턴스를 순서대로 끼워 넣는다.
import { AudioCore } from './core';
import { SignalSource } from './source';
import { EFFECT_FACTORIES, defaultParams, setParam, applyMix } from './effects';
import type { FxModule, EngineState, InstanceState, SrcMode } from './types';

export class Pedalboard {
  core = new AudioCore();
  source = new SignalSource(this.core);

  modules: Record<string, FxModule> = {};
  chainOrder: string[] = []; // 동적 인스턴스 ID 순서
  bypassed = false;
  playing = false;

  private _chainTimer: ReturnType<typeof setTimeout> | null = null;

  // ── 코어/소스 위임 (기존 Engine 공개 API 호환) ──
  get ctx() { return this.core.ctx; }
  get analyser() { return this.core.analyser; }
  get masterVol() { return this.core.masterVol; }
  get srcMode() { return this.source.mode; }
  set srcMode(v: SrcMode) { this.source.mode = v; }
  get wave() { return this.source.wave; }
  set wave(v: OscillatorType) { this.source.wave = v; }
  get freq() { return this.source.freq; }
  set freq(v: number) { this.source.freq = v; }
  get tempo() { return this.source.tempo; }
  set tempo(v: number) { this.source.tempo = v; }

  // ── 동적 인스턴스 관리 ──
  // 인스턴스 생성 (연결은 updateChain이 담당). instanceId는 고유, type은 이펙트 종류.
  addInstance(id: string, type: string) {
    const factory = EFFECT_FACTORIES[type];
    if (!factory) return;
    const m = factory(this.core);
    m.type = type;
    m.params = defaultParams(type);
    m.enabled = false;
    this.modules[id] = m;
  }

  // 인스턴스 제거 (호출 후 updateChain으로 체인 재연결 필요).
  removeInstance(id: string) {
    const m = this.modules[id];
    if (!m) return;
    try { m.input.disconnect(); } catch (e) {}
    try { m.output.disconnect(); } catch (e) {}
    if (m.lfo) { try { m.lfo.stop(); } catch (e) {} } // tremolo/chorus LFO 정지 (누수 방지)
    delete this.modules[id];
    this.chainOrder = this.chainOrder.filter(x => x !== id);
  }

  setEnabled(id: string, on: boolean) {
    const m = this.modules[id];
    if (!m) return;
    m.enabled = on;
    if (this.bypassed) return; // 글로벌 바이패스 중엔 상태만 기억, 소리엔 미반영
    applyMix(this.core, m, on);
  }

  // 모든 이펙터를 한 번에 통과(Bypass)시켜 원음과 A/B 비교. enabled 상태는 보존.
  setBypassAll(on: boolean) {
    this.bypassed = on;
    for (const id of Object.keys(this.modules)) {
      const m = this.modules[id];
      applyMix(this.core, m, on ? false : m.enabled);
    }
  }

  // 모듈 간 연결만 끊고 주어진 순서로 재연결 (내부 dry/wet 노드는 보존). 동기 실행.
  private _rewire(order: string[]) {
    this.core.input.disconnect();
    for (const id of Object.keys(this.modules)) {
      try { this.modules[id].output.disconnect(); } catch (e) {}
    }
    const valid = order.filter(id => this.modules[id]);
    let prev: AudioNode = this.core.input;
    for (const id of valid) {
      const m = this.modules[id];
      prev.connect(m.input);
      prev = m.output;
    }
    prev.connect(this.core.master); // 빈 체인이면 input → master 직결
  }

  // 신호 체인 순서 갱신 + 무클릭 페이드. 재생 중에만 페이드(아니면 즉시 재연결).
  updateChain(order: string[]) {
    const valid = order.filter(id => this.modules[id]);
    this.chainOrder = [...valid];

    if (this.ctx.state !== 'running') { this._rewire(valid); return; }

    const master = this.core.master;
    const mv = this.core.masterVol / 100; // 의도된 볼륨 캡처 (연속 드래그 중 라이브 gain 오염 방지)
    const t = this.ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.0001, t + 0.01); // 10ms 페이드아웃

    if (this._chainTimer) clearTimeout(this._chainTimer);
    this._chainTimer = setTimeout(() => {
      this._rewire(valid); // 페이드아웃 완료 후 재연결
      const t2 = this.ctx.currentTime;
      master.gain.cancelScheduledValues(t2);
      master.gain.setValueAtTime(0.0001, t2);
      master.gain.linearRampToValueAtTime(mv, t2 + 0.01); // 10ms 페이드인
      this._chainTimer = null;
    }, 14);
  }

  // 인스턴스 ID로 파라미터 조작 — 타입은 m.type으로 추적.
  set(id: string, param: string, v: number | string) {
    const m = this.modules[id];
    if (!m) return;
    m.params![param] = v;
    const active = this.bypassed ? false : m.enabled;
    setParam(this.core, m, param, v, active);
  }

  setMaster(pct: number) { this.core.setMaster(pct); }

  // ── 상태 직렬화 (프리셋 · URL 공유 공통 토대) ──
  getState(): EngineState {
    const instances: InstanceState[] = this.chainOrder
      .filter(id => this.modules[id])
      .map(id => {
        const m = this.modules[id];
        return { id, type: m.type!, enabled: !!m.enabled, params: { ...m.params } };
      });
    return {
      src: { mode: this.srcMode, wave: this.wave, freq: this.freq, tempo: this.tempo },
      master: this.masterVol,
      instances,
    };
  }

  applyState(s: Partial<EngineState>) {
    if (s.src) {
      if (s.src.wave) this.wave = s.src.wave;
      if (s.src.freq != null) this.freq = s.src.freq;
      if (s.src.tempo != null) this.tempo = s.src.tempo;
      if (s.src.mode) this.setSource(s.src.mode); // wave/freq 갱신 후 호출 → 재생 중이면 새 소스로 반영
    }
    if (s.master != null) this.setMaster(s.master);
    if (s.instances) {
      for (const id of Object.keys(this.modules)) this.removeInstance(id); // 기존 전부 제거
      for (const inst of s.instances) {
        this.addInstance(inst.id, inst.type);
        if (inst.params) for (const p of Object.keys(inst.params)) this.set(inst.id, p, inst.params[p]);
      }
      this.updateChain(s.instances.map(i => i.id));
      for (const inst of s.instances) if (inst.enabled != null) this.setEnabled(inst.id, inst.enabled);
    }
  }

  // ── 트랜스포트 ──
  async start() {
    await this.core.resume();
    this.source.start();
    this.playing = true;
  }

  stop() { this.source.stop(); this.playing = false; }

  setSource(mode: SrcMode) { this.source.setMode(mode); }
  setWave(w: OscillatorType) { this.source.setWave(w); }
  setFreq(f: number) { this.source.setFreq(f); }
  setTempo(t: number) { this.source.setTempo(t); }

  getScope() { return this.core.getScope(); }
  getSpectrum() { return this.core.getSpectrum(); }
}
