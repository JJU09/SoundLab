// 믹스버스 — 여러 트랙을 동시에 울려 밸런스·팬·다이내믹스를 가르치는 멀티트랙 토대.
// AudioCore의 세 번째 소비자 (SignalSource·SynthVoice에 이어). 모든 음원은 합성(샘플 파일 없음).
//
//   [트랙 보이스들] → fader → muteG → eq → pan → analyser(트랙 미터) → core.input → master
//   compressor 토픽에선 core.input → comp → makeup → master 로 마스터 컴프를 끼워 넣음.
//   depth 토픽에선 각 트랙이 send → 공유 convolver → return → core.input 로 리버브를 보냄.
//
// 루프는 16스텝 시퀀서. setInterval로 직접 발음하지 않고 lookahead 스케줄러
// (25ms 폴링 + 0.1s 선행 예약)로 AudioContext 시계에 예약 → 백그라운드 탭에서도 박자 유지.
import type { AudioCore } from './core';

export interface MixTrack {
  id: string;
  name: string;
  kr: string;
  fader: GainNode;        // 페이더 (vol 보존용 — mute와 분리)
  muteG: GainNode;        // mute/solo 적용 지점
  eq: BiquadFilterNode;   // 트랙별 1밴드 피킹 EQ (기본 gain 0 = 무색)
  pan: StereoPannerNode;
  analyser: AnalyserNode; // 트랙 미터·스펙트럼 (post-fader·post-EQ)
  td: Uint8Array<ArrayBuffer>;
  fd: Uint8Array<ArrayBuffer>;
  vol: number;            // 0..100
  panV: number;           // -1..1
  muted: boolean;
  soloed: boolean;
  trigger: (t: number, step: number) => void; // 스텝마다 호출되는 합성 음원
}

const STEPS = 16;

export class MixBus {
  tracks: MixTrack[] = [];
  bpm = 100;
  playing = false;
  step = 0; // 현재 UI 표시용 스텝 (시각화에 사용 가능)

  private _nextTime = 0;
  private _nextStep = 0;
  private _timer: ReturnType<typeof setInterval> | null = null;

  constructor(private core: AudioCore) {}

  // ── 트랙 구성 ──
  private _addTrack(id: string, name: string, kr: string, trigger: MixTrack['trigger']): MixTrack {
    const fader = this.core.gain(0.7);
    const muteG = this.core.gain(1);
    const eq = this.core.ctx.createBiquadFilter();
    eq.type = 'peaking'; eq.frequency.value = 500; eq.Q.value = 1.2; eq.gain.value = 0;
    const pan = this.core.ctx.createStereoPanner();
    const analyser = this.core.ctx.createAnalyser();
    analyser.fftSize = 1024; // 스펙트럼 오버레이 해상도 (≈47Hz/빈) — EQ 노치가 보이는 수준
    analyser.smoothingTimeConstant = 0.85; // 리듬 소스의 깜빡임 완화
    fader.connect(muteG); muteG.connect(eq); eq.connect(pan); pan.connect(analyser); analyser.connect(this.core.input);
    const tr: MixTrack = {
      id, name, kr, fader, muteG, eq, pan, analyser,
      td: new Uint8Array(analyser.fftSize),
      fd: new Uint8Array(analyser.frequencyBinCount),
      vol: 70, panV: 0, muted: false, soloed: false, trigger,
    };
    this.tracks.push(tr);
    return tr;
  }

  // 표준 3트랙 (드럼/베이스/멜로디) 구성 — 믹싱 허브 전 토픽 공용.
  buildStandard() {
    const ctx = this.core.ctx;

    // 드럼: 킥(사인 피치드롭, 4분) + 해트(하이패스 노이즈, 업비트)
    const drums = this._addTrack('drums', 'Drums', '드럼', (t, s) => {
      if (s % 4 === 0) { // kick
        const o = ctx.createOscillator(), g = this.core.gain(0);
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
        g.gain.setValueAtTime(0.9, t);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.25);
        o.connect(g); g.connect(drums.fader);
        o.start(t); o.stop(t + 0.3);
        o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (e) {} };
      }
      if (s % 4 === 2) { // hat
        const n = ctx.createBufferSource(); n.buffer = this._noiseBuf();
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
        const g = this.core.gain(0);
        g.gain.setValueAtTime(0.25, t);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.06);
        n.connect(hp); hp.connect(g); g.connect(drums.fader);
        n.start(t); n.stop(t + 0.08);
        n.onended = () => { try { n.disconnect(); hp.disconnect(); g.disconnect(); } catch (e) {} };
      }
    });

    // 베이스: 낮은 톱니파 8분 라인 (A1–A1–C2–E2 순환)
    const bassNotes = [55, 0, 55, 0, 65.41, 0, 82.41, 0, 55, 0, 55, 0, 65.41, 0, 49, 0];
    const bass = this._addTrack('bass', 'Bass', '베이스', (t, s) => {
      const f = bassNotes[s];
      if (!f) return;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      const g = this.core.gain(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.28);
      o.connect(lp); lp.connect(g); g.connect(bass.fader);
      o.start(t); o.stop(t + 0.32);
      o.onended = () => { try { o.disconnect(); lp.disconnect(); g.disconnect(); } catch (e) {} };
    });

    // 멜로디: 높은 트라이앵글 신코페이션 (A3 펜타토닉)
    const leadNotes = [0, 0, 440, 0, 523.25, 0, 0, 659.25, 0, 0, 587.33, 0, 523.25, 0, 0, 0];
    const lead = this._addTrack('lead', 'Melody', '멜로디', (t, s) => {
      const f = leadNotes[s];
      if (!f) return;
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const g = this.core.gain(0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.45, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0008, t + 0.4);
      o.connect(g); g.connect(lead.fader);
      o.start(t); o.stop(t + 0.45);
      o.onended = () => { try { o.disconnect(); g.disconnect(); } catch (e) {} };
    });
  }

  private _noise: AudioBuffer | null = null;
  private _noiseBuf(): AudioBuffer {
    if (!this._noise) {
      const len = Math.floor(this.core.ctx.sampleRate * 0.1);
      this._noise = this.core.ctx.createBuffer(1, len, this.core.ctx.sampleRate);
      const d = this._noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this._noise;
  }

  // ── 컨트롤 ──
  get(id: string) { return this.tracks.find(t => t.id === id); }

  setVol(id: string, pct: number) {
    const tr = this.get(id); if (!tr) return;
    tr.vol = pct;
    this.core.smooth(tr.fader.gain, pct / 100);
  }

  setPan(id: string, v: number) {
    const tr = this.get(id); if (!tr) return;
    tr.panV = v;
    this.core.smooth(tr.pan.pan, v);
  }

  // 트랙 EQ (피킹 1밴드) — freq(Hz)·gain(dB)
  setEqFreq(id: string, hz: number) {
    const tr = this.get(id); if (!tr) return;
    this.core.smooth(tr.eq.frequency, hz);
  }

  setEqGain(id: string, db: number) {
    const tr = this.get(id); if (!tr) return;
    this.core.smooth(tr.eq.gain, db);
  }

  // 트랙 스펙트럼 (오버레이용) — frequencyBinCount 길이의 0..255 배열
  getTrackSpectrum(id: string): Uint8Array | null {
    const tr = this.get(id); if (!tr) return null;
    tr.analyser.getByteFrequencyData(tr.fd);
    return tr.fd;
  }

  setMute(id: string, on: boolean) {
    const tr = this.get(id); if (!tr) return;
    tr.muted = on;
    this._applyMutes();
  }

  setSolo(id: string, on: boolean) {
    const tr = this.get(id); if (!tr) return;
    tr.soloed = on;
    this._applyMutes();
  }

  // solo가 하나라도 있으면 solo 안 된 트랙은 전부 임시 mute (DAW 표준).
  private _applyMutes() {
    const anySolo = this.tracks.some(t => t.soloed);
    for (const t of this.tracks) {
      const audible = !t.muted && (!anySolo || t.soloed);
      this.core.smooth(t.muteG.gain, audible ? 1 : 0);
    }
  }

  // ── 마스터 L/R 스테레오 미터 (pan 토픽용) ──
  private _lr: { l: AnalyserNode; r: AnalyserNode; tdL: Uint8Array<ArrayBuffer>; tdR: Uint8Array<ArrayBuffer> } | null = null;

  enableStereoMeter() {
    if (this._lr) return;
    const sp = this.core.ctx.createChannelSplitter(2);
    const mk = () => { const a = this.core.ctx.createAnalyser(); a.fftSize = 512; return a; };
    const l = mk(), r = mk();
    this.core.master.connect(sp); // 미터 탭만 — 본 신호 경로(master→analyser→dest)는 그대로
    sp.connect(l, 0); sp.connect(r, 1);
    this._lr = { l, r, tdL: new Uint8Array(l.fftSize), tdR: new Uint8Array(r.fftSize) };
  }

  // [L, R] 피크 (0..1). enableStereoMeter 전엔 [0,0].
  getStereoLevels(): [number, number] {
    if (!this._lr) return [0, 0];
    const peak = (a: AnalyserNode, td: Uint8Array<ArrayBuffer>) => {
      a.getByteTimeDomainData(td);
      let p = 0;
      for (let i = 0; i < td.length; i++) { const v = Math.abs(td[i] - 128) / 128; if (v > p) p = v; }
      return p;
    };
    return [peak(this._lr.l, this._lr.tdL), peak(this._lr.r, this._lr.tdR)];
  }

  // ── 마스터 컴프레서/리미터 (compressor·loudness 토픽용) ──
  // input → drive → comp → makeup → master 로 스플라이스. 트랙 합산 신호에 다이내믹스를 적용.
  // compressor: 기본 무압축(threshold 0)에서 임계점을 내려 조이는 과제형.
  // loudness(리미터): threshold를 천장(-1)에 고정하고 drive로 신호를 밀어넣어 평균만 끌어올림.
  private _comp: DynamicsCompressorNode | null = null;
  private _makeup: GainNode | null = null;
  private _drive: GainNode | null = null;

  enableCompressor() {
    if (this._comp) return;
    const drive = this.core.gain(1); // pre-comp 입력 드라이브 (리미터용, 기본 0dB)
    const c = this.core.ctx.createDynamicsCompressor();
    c.threshold.value = 0;   // dBFS — 0이면 풀스케일 근처만 건드림(=초기엔 무압축)
    c.knee.value = 6;
    c.ratio.value = 4;       // 4:1 — easy 티어 고정값
    c.attack.value = 0.003;
    c.release.value = 0.25;
    const mk = this.core.gain(1); // 메이크업 게인 (DynamicsCompressorNode엔 없음 → 별도 노드)
    this.core.input.disconnect();
    this.core.input.connect(drive); drive.connect(c); c.connect(mk); mk.connect(this.core.master);
    this._comp = c; this._makeup = mk; this._drive = drive;
  }

  setCompThreshold(db: number) { if (this._comp) this.core.smooth(this._comp.threshold, db); }
  setCompRatio(r: number) { if (this._comp) this.core.smooth(this._comp.ratio, r); }
  setCompKnee(db: number) { if (this._comp) this.core.smooth(this._comp.knee, db); }
  setCompAttack(s: number) { if (this._comp) this.core.smooth(this._comp.attack, s); }
  setCompRelease(s: number) { if (this._comp) this.core.smooth(this._comp.release, s); }
  setCompMakeup(db: number) { if (this._makeup) this.core.smooth(this._makeup.gain, Math.pow(10, db / 20)); }
  setCompDrive(db: number) { if (this._drive) this.core.smooth(this._drive.gain, Math.pow(10, db / 20)); }

  // 현재 게인 리덕션 (dB, 0 또는 음수). 컴프 미적용 시 0.
  getGainReduction(): number { return this._comp ? this._comp.reduction : 0; }

  // ── 리버브 센드/리턴 버스 (depth 토픽용) ──
  // 트랙마다 인서트로 리버브를 거는 대신, 컨볼버 하나를 공유 버스로 두고 각 트랙이
  // 센드 게인으로 보냄(post-fader). 한 공간을 함께 쓰니 "글루"가 생기고 CPU도 아낌.
  //   tr.pan → send(게인) → conv → ret(게인) → core.input(=마스터 합류)
  private _verb: { conv: ConvolverNode; ret: GainNode; sends: Map<string, GainNode> } | null = null;

  enableReverb() {
    if (this._verb) return;
    const conv = this.core.ctx.createConvolver();
    conv.buffer = this.core.impulse(2.4, 3); // 합성 IR (홀 크기)
    const ret = this.core.gain(0.9);          // 리턴 레벨
    conv.connect(ret); ret.connect(this.core.input);
    const sends = new Map<string, GainNode>();
    for (const tr of this.tracks) {
      const s = this.core.gain(0);  // 기본 센드 0 = 완전 드라이
      tr.pan.connect(s); s.connect(conv); // post-fader·post-pan 탭 (메인 경로는 그대로)
      sends.set(tr.id, s);
    }
    this._verb = { conv, ret, sends };
  }

  // 트랙 리버브 센드량 (0..1). 0=드라이(가까움), 1=흠뻑(멀어짐).
  setSend(id: string, amount: number) {
    if (!this._verb) return;
    const s = this._verb.sends.get(id);
    if (s) this.core.smooth(s.gain, amount);
  }

  // 트랙 미터용 피크 (0..1)
  getLevel(id: string): number {
    const tr = this.get(id); if (!tr) return 0;
    tr.analyser.getByteTimeDomainData(tr.td);
    let peak = 0;
    for (let i = 0; i < tr.td.length; i++) {
      const v = Math.abs(tr.td[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return peak;
  }

  // ── lookahead 스케줄러 ──
  async start() {
    await this.core.resume();
    if (this.playing) return;
    this.playing = true;
    this._nextStep = 0;
    this._nextTime = this.core.ctx.currentTime + 0.05;
    this._timer = setInterval(() => this._schedule(), 25);
  }

  stop() {
    this.playing = false;
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  private _schedule() {
    const stepDur = 60 / this.bpm / 4; // 16분음표
    while (this._nextTime < this.core.ctx.currentTime + 0.1) {
      const s = this._nextStep % STEPS;
      for (const tr of this.tracks) tr.trigger(this._nextTime, s);
      this.step = s;
      this._nextTime += stepDur;
      this._nextStep++;
    }
  }
}
