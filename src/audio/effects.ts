// 이펙트 레이어 — dry/wet 셸 + 타입별 노드 팩토리 + 파라미터 디스패치.
// 코어(ctx·프리미티브) 위에서 동작하는 순수 함수 묶음. 페달보드가 이 팩토리로 인스턴스를 찍는다.
import { MODULE_MAP, type ModuleId } from '../lib/modules';
import type { AudioCore } from './core';
import type { FxModule } from './types';

export const DEFAULT_CHAIN = ['filter', 'drive', 'tremolo', 'chorus', 'delay', 'reverb'];

// 인스턴스 초기 파라미터를 modules.ts(단일 소스)에서 파생.
export function defaultParams(type: string): Record<string, number | string> {
  const def = MODULE_MAP[type as ModuleId];
  const p: Record<string, number | string> = {};
  if (!def) return p;
  for (const k of def.knobs) p[k.param] = k.value;
  if (def.type) p.type = def.type.value; // filter의 'lowpass' 등 노브 아닌 타입 셀렉터
  return p;
}

// dry/wet 셸: input → dry → output, wet → output. (이펙트 노드는 input → wet 경로에 삽입)
function shell(core: AudioCore, kind: 'series' | 'parallel'): FxModule {
  const input = core.gain(1), output = core.gain(1), dry = core.gain(1), wet = core.gain(0);
  input.connect(dry); dry.connect(output); wet.connect(output);
  return { input, output, dry, wet, kind, enabled: false, mix: 1 };
}

// ── 타입별 팩토리 ──
function makeFilter(core: AudioCore): FxModule {
  const m = shell(core, 'series');
  const bq = core.ctx.createBiquadFilter();
  bq.type = 'lowpass'; bq.frequency.value = 1200; bq.Q.value = 1;
  m.input.connect(bq); bq.connect(m.wet);
  return { ...m, bq };
}

function makeDrive(core: AudioCore): FxModule {
  const m = shell(core, 'series');
  const pre = core.gain(1), shaper = core.ctx.createWaveShaper(), post = core.gain(1);
  m.input.connect(pre); pre.connect(shaper); shaper.connect(post); post.connect(m.wet);
  const mod = { ...m, shaper, post };
  setDrive(core, mod, 40);
  return mod;
}

function setDrive(core: AudioCore, m: FxModule, amt: number) {
  const k = amt * 1.2, n = 1024, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; curve[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  m.shaper!.curve = curve;
  core.smooth(m.post!.gain, 1 / (1 + amt * 0.012));
}

function makeTremolo(core: AudioCore): FxModule {
  const m = shell(core, 'series');
  const trem = core.gain(1), lfo = core.ctx.createOscillator(), depthG = core.gain(0.3);
  lfo.type = 'sine'; lfo.frequency.value = 5;
  lfo.connect(depthG); depthG.connect(trem.gain);
  m.input.connect(trem); trem.connect(m.wet);
  lfo.start();
  const mod = { ...m, trem, lfo, depthG };
  setTremDepth(core, mod, 60);
  return mod;
}

function setTremDepth(core: AudioCore, m: FxModule, pct: number) {
  const d = pct / 100;
  core.smooth(m.trem!.gain, 1 - d / 2);
  core.smooth(m.depthG!.gain, d / 2);
}

function makeChorus(core: AudioCore): FxModule {
  const m = shell(core, 'parallel'); m.mix = 0.5;
  const delay = core.ctx.createDelay(0.1); delay.delayTime.value = 0.025;
  const lfo = core.ctx.createOscillator(), depthG = core.gain(0.003);
  lfo.type = 'sine'; lfo.frequency.value = 1.5;
  lfo.connect(depthG); depthG.connect(delay.delayTime);
  m.input.connect(delay); delay.connect(m.wet);
  lfo.start();
  return { ...m, delay, lfo, depthG };
}

function makeDelay(core: AudioCore): FxModule {
  const m = shell(core, 'parallel'); m.mix = 0.35;
  const delay = core.ctx.createDelay(2.0); delay.delayTime.value = 0.3;
  const fb = core.gain(0.4);
  const damp = core.ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 3200;
  m.input.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay); delay.connect(m.wet);
  return { ...m, delay, fb };
}

function makeReverb(core: AudioCore): FxModule {
  const m = shell(core, 'parallel'); m.mix = 0.3;
  const conv = core.ctx.createConvolver();
  conv.buffer = core.defaultImpulse; // 캐싱된 기본 임펄스 참조 (재계산 X)
  m.input.connect(conv); conv.connect(m.wet);
  return { ...m, conv };
}

export const EFFECT_FACTORIES: Record<string, (core: AudioCore) => FxModule> = {
  filter: makeFilter,
  drive: makeDrive,
  tremolo: makeTremolo,
  chorus: makeChorus,
  delay: makeDelay,
  reverb: makeReverb,
};

// dry/wet 믹스 반영. active = 이펙트가 실제로 켜진 상태(바이패스 포함 계산은 호출자 책임).
export function applyMix(core: AudioCore, m: FxModule, active: boolean) {
  if (m.kind === 'series') {
    core.smooth(m.dry.gain, active ? 0 : 1);
    core.smooth(m.wet.gain, active ? 1 : 0);
  } else {
    core.smooth(m.wet.gain, active ? m.mix : 0);
  }
}

// 인스턴스 파라미터 조작. active = 현재 유효 on/off (mix 파라미터 재반영에 필요).
export function setParam(core: AudioCore, m: FxModule, param: string, value: number | string, active: boolean) {
  switch (`${m.type}.${param}`) {
    case 'filter.type': m.bq!.type = value as BiquadFilterType; break;
    case 'filter.freq': core.smooth(m.bq!.frequency, value as number); break;
    case 'filter.q': core.smooth(m.bq!.Q, value as number); break;
    case 'drive.amount': setDrive(core, m, value as number); break;
    case 'tremolo.rate': core.smooth(m.lfo!.frequency, value as number); break;
    case 'tremolo.depth': setTremDepth(core, m, value as number); break;
    case 'chorus.rate': core.smooth(m.lfo!.frequency, value as number); break;
    case 'chorus.depth': core.smooth(m.depthG!.gain, (value as number / 100) * 0.006); break;
    case 'chorus.mix': m.mix = (value as number) / 100; applyMix(core, m, active); break;
    case 'delay.time': core.smooth(m.delay!.delayTime, value as number, 0.05); break;
    case 'delay.feedback': core.smooth(m.fb!.gain, (value as number) / 100); break;
    case 'delay.mix': m.mix = (value as number) / 100; applyMix(core, m, active); break;
    case 'reverb.size': m.conv!.buffer = core.impulse(value as number, 3); break;
    case 'reverb.mix': m.mix = (value as number) / 100; applyMix(core, m, active); break;
  }
}
