// 공유 오디오 코어 — AudioContext 수명, 출력 그래프, 프리미티브, 비주얼라이저 데이터, 트랜스포트.
// 페달보드·신디시스 등 모든 위젯이 공통으로 올라타는 토대.
//
//   [입력원] → input → (이펙트 체인) → master → analyser → destination
//
// input: 소스(SignalSource)나 신스 보이스가 연결하는 지점.
// master: 이펙트 체인이 종착하는 지점 (체인이 비면 input → master 직결).
export class AudioCore {
  ctx: AudioContext;
  input!: GainNode;       // 소스가 연결되는 체인 입구
  master!: GainNode;      // 이펙트 체인 종착 + 마스터 볼륨
  analyser!: AnalyserNode;
  tdData!: Uint8Array<ArrayBuffer>;    // 시간축(오실로스코프)
  fdData!: Uint8Array<ArrayBuffer>;    // 주파수축(스펙트럼)
  defaultImpulse!: AudioBuffer; // 리버브 기본 임펄스 캐싱 (드롭아웃 방어)
  masterVol = 70;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.ctx.suspend();
    this._build();
  }

  private _build() {
    this.input = this.gain(1);
    this.master = this.gain(this.masterVol / 100);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.tdData = new Uint8Array(this.analyser.fftSize);
    this.fdData = new Uint8Array(this.analyser.frequencyBinCount);
    this.defaultImpulse = this.impulse(1.8, 3);

    this.input.connect(this.master);
    this.master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  // ── 프리미티브 ──
  gain(v?: number): GainNode {
    const g = this.ctx.createGain();
    if (v != null) g.gain.value = v;
    return g;
  }

  smooth(param: AudioParam, val: number, t = 0.02) {
    param.setTargetAtTime(val, this.ctx.currentTime, t);
  }

  impulse(sec: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate, len = Math.max(1, Math.floor(sec * rate));
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // ── 마스터 ──
  setMaster(pct: number) {
    this.masterVol = pct;
    this.smooth(this.master.gain, pct / 100);
  }

  // ── 비주얼라이저 데이터 ──
  getScope() { this.analyser.getByteTimeDomainData(this.tdData); return this.tdData; }
  getSpectrum() { this.analyser.getByteFrequencyData(this.fdData); return this.fdData; }

  // ── 트랜스포트 ──
  async resume() { await this.ctx.resume(); }
  suspend() { this.ctx.suspend(); }
}
