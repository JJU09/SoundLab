// 하위 호환 심(shim). 엔진이 audio/ 레이어로 분리됨에 따라, 기존 소비자
// (EffectPlayer·sandbox·presets)가 그대로 import 하도록 재export만 한다.
//
//   audio/core.ts      — AudioCore (공유 plumbing, 신디시스 위젯 재사용 토대)
//   audio/source.ts    — SignalSource (tone/pluck/noise)
//   audio/effects.ts   — 이펙트 팩토리 + 파라미터 디스패치
//   audio/pedalboard.ts— Pedalboard (= 기존 Engine)
export { Pedalboard as Engine } from '../audio/pedalboard';
export { DEFAULT_CHAIN } from '../audio/effects';
export type { SrcMode, InstanceState, EngineState } from '../audio/types';
