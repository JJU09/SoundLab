import { MODULE_MAP, type ModuleId } from './modules';

export type SrcMode = 'tone' | 'pluck' | 'noise';

export interface InstanceState {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, number | string>;
}

export interface EngineState {
  src: { mode: SrcMode; wave: OscillatorType; freq: number; tempo: number };
  master: number;
  instances: InstanceState[]; // 순서 = 신호 체인 순서
}

export const DEFAULT_CHAIN = ['filter', 'drive', 'tremolo', 'chorus', 'delay', 'reverb'];

// 인스턴스 초기 파라미터를 modules.ts(단일 소스)에서 파생
function defaultParams(type: string): Record<string, number | string> {
  const def = MODULE_MAP[type as ModuleId];
  const p: Record<string, number | string> = {};
  if (!def) return p;
  for (const k of def.knobs) p[k.param] = k.value;
  if (def.type) p.type = def.type.value; // filter의 'lowpass' 등 노브 아닌 타입 셀렉터
  return p;
}

export class Engine {
  ctx: AudioContext;
  modules: Record<string, any> = {};
  playing = false;
  srcMode: SrcMode = 'tone';
  wave: OscillatorType = 'sine';
  freq = 220;
  tempo = 110;
  masterVol = 70;
  chainOrder: string[] = []; // 동적 인스턴스 ID 순서

  private chainIn!: GainNode;
  private master!: GainNode;
  analyser!: AnalyserNode;
  tdData!: Uint8Array;
  fdData!: Uint8Array;

  private _defaultImpulse!: AudioBuffer; // 리버브 기본 임펄스 캐싱 (드롭아웃 방어)
  private _chainTimer: ReturnType<typeof setTimeout> | null = null;

  private _osc: OscillatorNode | null = null;
  private _noise: AudioBufferSourceNode | null = null;
  private _plkTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.ctx.suspend();
    this._buildGraph();
  }

  private _gain(v?: number): GainNode {
    const g = this.ctx.createGain();
    if (v != null) g.gain.value = v;
    return g;
  }

  // 빈 그래프로 시작: chainIn → master → analyser → destination (이펙터는 동적 추가)
  private _buildGraph() {
    this.chainIn = this._gain(1);
    this.master = this._gain(this.masterVol / 100);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.tdData = new Uint8Array(this.analyser.fftSize);
    this.fdData = new Uint8Array(this.analyser.frequencyBinCount);
    this._defaultImpulse = this._impulse(1.8, 3);

    this.chainIn.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  private _shell(kind: 'series' | 'parallel') {
    const input = this._gain(1), output = this._gain(1);
    const dry = this._gain(1), wet = this._gain(0);
    input.connect(dry); dry.connect(output); wet.connect(output);
    return { input, output, dry, wet, kind, enabled: false, mix: 1 };
  }

  private _smooth(param: AudioParam, val: number, t = 0.02) {
    param.setTargetAtTime(val, this.ctx.currentTime, t);
  }

  // ── 동적 인스턴스 관리 ──
  // 인스턴스 생성 (연결은 updateChain이 담당). instanceId는 고유, type은 이펙트 종류.
  addInstance(id: string, type: string) {
    const factory = (this as any)[`_mk_${type}`];
    if (!factory) return;
    const m = factory.call(this);
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

  bypassed = false;

  setEnabled(id: string, on: boolean) {
    const m = this.modules[id];
    if (!m) return;
    m.enabled = on;
    if (this.bypassed) return; // 글로벌 바이패스 중엔 상태만 기억, 소리엔 미반영
    this._applyMix(m);
  }

  private _applyMix(m: any) {
    const active = this.bypassed ? false : m.enabled;
    if (m.kind === 'series') { this._smooth(m.dry.gain, active ? 0 : 1); this._smooth(m.wet.gain, active ? 1 : 0); }
    else { this._smooth(m.wet.gain, active ? m.mix : 0); }
  }

  // 모든 이펙터를 한 번에 통과(Bypass)시켜 원음과 A/B 비교. enabled 상태는 보존.
  setBypassAll(on: boolean) {
    this.bypassed = on;
    for (const id of Object.keys(this.modules)) this._applyMix(this.modules[id]);
  }

  // 모듈 간 연결만 끊고 주어진 순서로 재연결 (내부 dry/wet 노드는 보존). 동기 실행.
  private _rewire(order: string[]) {
    this.chainIn.disconnect();
    for (const id of Object.keys(this.modules)) {
      try { this.modules[id].output.disconnect(); } catch (e) {}
    }
    const valid = order.filter(id => this.modules[id]);
    let prev: AudioNode = this.chainIn;
    for (const id of valid) {
      const m = this.modules[id];
      prev.connect(m.input);
      prev = m.output;
    }
    prev.connect(this.master); // 빈 체인이면 chainIn → master 직결
  }

  // 신호 체인 순서 갱신 + 무클릭 페이드. 재생 중에만 페이드(아니면 즉시 재연결).
  updateChain(order: string[]) {
    const valid = order.filter(id => this.modules[id]);
    this.chainOrder = [...valid];

    if (this.ctx.state !== 'running') { this._rewire(valid); return; }

    const mv = this.masterVol / 100; // 의도된 볼륨 캡처 (연속 드래그 중 라이브 gain 오염 방지)
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setValueAtTime(this.master.gain.value, t);
    this.master.gain.linearRampToValueAtTime(0.0001, t + 0.01); // 10ms 페이드아웃

    if (this._chainTimer) clearTimeout(this._chainTimer);
    this._chainTimer = setTimeout(() => {
      this._rewire(valid); // 페이드아웃 완료 후 재연결
      const t2 = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t2);
      this.master.gain.setValueAtTime(0.0001, t2);
      this.master.gain.linearRampToValueAtTime(mv, t2 + 0.01); // 10ms 페이드인
      this._chainTimer = null;
    }, 14);
  }

  private _mk_filter() {
    const m = this._shell('series');
    const bq = this.ctx.createBiquadFilter();
    bq.type = 'lowpass'; bq.frequency.value = 1200; bq.Q.value = 1;
    m.input.connect(bq); bq.connect(m.wet);
    return { ...m, bq };
  }

  private _mk_drive() {
    const m = this._shell('series');
    const pre = this._gain(1), shaper = this.ctx.createWaveShaper(), post = this._gain(1);
    m.input.connect(pre); pre.connect(shaper); shaper.connect(post); post.connect(m.wet);
    const mod = { ...m, shaper, post };
    this._setDrive(mod, 40);
    return mod;
  }

  private _setDrive(m: any, amt: number) {
    const k = amt * 1.2, n = 1024, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
    m.shaper.curve = curve;
    this._smooth(m.post.gain, 1 / (1 + amt * 0.012));
  }

  private _mk_tremolo() {
    const m = this._shell('series');
    const trem = this._gain(1), lfo = this.ctx.createOscillator(), depthG = this._gain(0.3);
    lfo.type = 'sine'; lfo.frequency.value = 5;
    lfo.connect(depthG); depthG.connect(trem.gain);
    m.input.connect(trem); trem.connect(m.wet);
    lfo.start();
    const mod = { ...m, trem, lfo, depthG };
    this._setTremDepth(mod, 60);
    return mod;
  }

  private _setTremDepth(m: any, pct: number) {
    const d = pct / 100;
    this._smooth(m.trem.gain, 1 - d / 2);
    this._smooth(m.depthG.gain, d / 2);
  }

  private _mk_chorus() {
    const m = this._shell('parallel'); m.mix = 0.5;
    const delay = this.ctx.createDelay(0.1); delay.delayTime.value = 0.025;
    const lfo = this.ctx.createOscillator(), depthG = this._gain(0.003);
    lfo.type = 'sine'; lfo.frequency.value = 1.5;
    lfo.connect(depthG); depthG.connect(delay.delayTime);
    m.input.connect(delay); delay.connect(m.wet);
    lfo.start();
    return { ...m, delay, lfo, depthG };
  }

  private _mk_delay() {
    const m = this._shell('parallel'); m.mix = 0.35;
    const delay = this.ctx.createDelay(2.0); delay.delayTime.value = 0.3;
    const fb = this._gain(0.4);
    const damp = this.ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 3200;
    m.input.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay); delay.connect(m.wet);
    return { ...m, delay, fb };
  }

  private _mk_reverb() {
    const m = this._shell('parallel'); m.mix = 0.3;
    const conv = this.ctx.createConvolver();
    conv.buffer = this._defaultImpulse; // 캐싱된 기본 임펄스 참조 (재계산 X)
    m.input.connect(conv); conv.connect(m.wet);
    return { ...m, conv };
  }

  private _impulse(sec: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate, len = Math.max(1, Math.floor(sec * rate));
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // 인스턴스 ID로 파라미터 조작 — 타입은 m.type으로 추적
  set(id: string, param: string, v: number | string) {
    const m = this.modules[id];
    if (!m) return;
    m.params[param] = v;
    switch (`${m.type}.${param}`) {
      case 'filter.type': m.bq.type = v; break;
      case 'filter.freq': this._smooth(m.bq.frequency, v as number); break;
      case 'filter.q': this._smooth(m.bq.Q, v as number); break;
      case 'drive.amount': this._setDrive(m, v as number); break;
      case 'tremolo.rate': this._smooth(m.lfo.frequency, v as number); break;
      case 'tremolo.depth': this._setTremDepth(m, v as number); break;
      case 'chorus.rate': this._smooth(m.lfo.frequency, v as number); break;
      case 'chorus.depth': this._smooth(m.depthG.gain, (v as number / 100) * 0.006); break;
      case 'chorus.mix': m.mix = (v as number) / 100; this._applyMix(m); break;
      case 'delay.time': this._smooth(m.delay.delayTime, v as number, 0.05); break;
      case 'delay.feedback': this._smooth(m.fb.gain, (v as number) / 100); break;
      case 'delay.mix': m.mix = (v as number) / 100; this._applyMix(m); break;
      case 'reverb.size': m.conv.buffer = this._impulse(v as number, 3); break;
      case 'reverb.mix': m.mix = (v as number) / 100; this._applyMix(m); break;
    }
  }

  setMaster(pct: number) { this.masterVol = pct; this._smooth(this.master.gain, pct / 100); }

  // ── 상태 직렬화 (프리셋 · URL 공유 공통 토대) ──
  getState(): EngineState {
    const instances: InstanceState[] = this.chainOrder
      .filter(id => this.modules[id])
      .map(id => {
        const m = this.modules[id];
        return { id, type: m.type, enabled: !!m.enabled, params: { ...m.params } };
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

  async start() {
    await this.ctx.resume();
    this._startSource();
    this.playing = true;
  }

  stop() { this._stopSource(); this.playing = false; }

  private _stopSource() {
    if (this._plkTimer) { clearInterval(this._plkTimer); this._plkTimer = null; }
    if (this._osc) { try { this._osc.stop(); } catch (e) {} this._osc.disconnect(); this._osc = null; }
    if (this._noise) { try { this._noise.stop(); } catch (e) {} this._noise.disconnect(); this._noise = null; }
  }

  private _startSource() {
    this._stopSource();
    if (this.srcMode === 'tone') {
      const o = this.ctx.createOscillator(); o.type = this.wave; o.frequency.value = this.freq;
      const g = this._gain(0.35); o.connect(g); g.connect(this.chainIn); o.start();
      this._osc = o;
    } else if (this.srcMode === 'noise') {
      const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = this.ctx.createBufferSource(); n.buffer = buf; n.loop = true;
      const g = this._gain(0.18); n.connect(g); g.connect(this.chainIn); n.start();
      this._noise = n;
    } else {
      const scale = [220, 261.63, 329.63, 440, 329.63, 261.63]; let step = 0;
      const fire = () => {
        const f = scale[step++ % scale.length];
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = this._gain(0); o.connect(g); g.connect(this.chainIn);
        const t = this.ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.4, t + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.5);
        o.start(t); o.stop(t + 0.6);
      };
      fire();
      this._plkTimer = setInterval(fire, 60000 / this.tempo / 2);
    }
  }

  setSource(mode: SrcMode) { this.srcMode = mode; if (this.playing) this._startSource(); }
  setWave(w: OscillatorType) { this.wave = w; if (this._osc) this._osc.type = w; }
  setFreq(f: number) { this.freq = f; if (this._osc) this._smooth(this._osc.frequency, f); }
  setTempo(t: number) { this.tempo = t; if (this.playing && this.srcMode === 'pluck') this._startSource(); }

  getScope() { this.analyser.getByteTimeDomainData(this.tdData); return this.tdData; }
  getSpectrum() { this.analyser.getByteFrequencyData(this.fdData); return this.fdData; }
}
