export type SrcMode = 'tone' | 'pluck' | 'noise';

export class Engine {
  ctx: AudioContext;
  modules: Record<string, any> = {};
  playing = false;
  srcMode: SrcMode = 'tone';
  wave: OscillatorType = 'sine';
  freq = 220;
  tempo = 110;

  private chainIn!: GainNode;
  private master!: GainNode;
  analyser!: AnalyserNode;
  tdData!: Uint8Array;
  fdData!: Uint8Array;

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

  private _buildGraph() {
    this.chainIn = this._gain(1);
    this.master = this._gain(0.7);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.tdData = new Uint8Array(this.analyser.fftSize);
    this.fdData = new Uint8Array(this.analyser.frequencyBinCount);

    const order = ['filter', 'drive', 'tremolo', 'chorus', 'delay', 'reverb'] as const;
    let prev: AudioNode = this.chainIn;
    for (const id of order) {
      const m = (this as any)[`_mk_${id}`]();
      prev.connect(m.input);
      prev = m.output;
      this.modules[id] = m;
    }
    prev.connect(this.master);
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

  setEnabled(id: string, on: boolean) {
    const m = this.modules[id]; m.enabled = on;
    if (m.kind === 'series') { this._smooth(m.dry.gain, on ? 0 : 1); this._smooth(m.wet.gain, on ? 1 : 0); }
    else { this._smooth(m.wet.gain, on ? m.mix : 0); }
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
    conv.buffer = this._impulse(1.8, 3);
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

  set(id: string, param: string, v: number | string) {
    const m = this.modules[id];
    switch (`${id}.${param}`) {
      case 'filter.type': m.bq.type = v; break;
      case 'filter.freq': this._smooth(m.bq.frequency, v as number); break;
      case 'filter.q': this._smooth(m.bq.Q, v as number); break;
      case 'drive.amount': this._setDrive(m, v as number); break;
      case 'tremolo.rate': this._smooth(m.lfo.frequency, v as number); break;
      case 'tremolo.depth': this._setTremDepth(m, v as number); break;
      case 'chorus.rate': this._smooth(m.lfo.frequency, v as number); break;
      case 'chorus.depth': this._smooth(m.depthG.gain, (v as number / 100) * 0.006); break;
      case 'chorus.mix': m.mix = (v as number) / 100; if (m.enabled) this._smooth(m.wet.gain, m.mix); break;
      case 'delay.time': this._smooth(m.delay.delayTime, v as number, 0.05); break;
      case 'delay.feedback': this._smooth(m.fb.gain, (v as number) / 100); break;
      case 'delay.mix': m.mix = (v as number) / 100; if (m.enabled) this._smooth(m.wet.gain, m.mix); break;
      case 'reverb.size': m.conv.buffer = this._impulse(v as number, 3); break;
      case 'reverb.mix': m.mix = (v as number) / 100; if (m.enabled) this._smooth(m.wet.gain, m.mix); break;
    }
  }

  setMaster(pct: number) { this._smooth(this.master.gain, pct / 100); }

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
