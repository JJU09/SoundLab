# 모듈러 가상 페달보드 전환 플랜

## Context
현재 샌드박스는 6개 이펙트가 **id로 한 개씩 고정**된 랙이다 (`engine.ts`의 `modules: Record<id,...>`, `_buildGraph()`가 생성자에서 6개를 한 번씩 생성, `chainOrder`는 그 순열). 같은 타입을 여러 개 배치하거나(Filter A·B), 팔레트에서 꺼내 조립하거나, 삭제하는 개념이 없다.

목표: 샌드박스를 **이펙터를 무한히 찍어내 직렬로 조립하는 모듈러 페달보드**로 전환. 사용자가 본 카드 순서 = 오디오 신호 순서. 같은 타입의 여러 인스턴스가 각자 독립된 on/off·노브값을 가진다.

확정된 결정:
- **직렬(일직선) 체인만** (병렬 분기 없음)
- **레슨 페이지는 동작 유지**, 샌드박스만 전면 개편
- **신규 배열 포맷이 메인**, 구버전 맵 포맷 URL은 어댑터로 자동 변환

이미 완성된 토대를 최대 재사용: `reorder()`(동적 재연결 엔진), `getState/applyState`(직렬화), DnD·체인흐름 렌더링, shell(dry/wet) 독립 처리, 프리셋·URL 공유.

---

## Phase 1 · 엔진 동적 인스턴스화 (`src/lib/engine.ts`)

**1.1 빈 그래프로 시작.** `_buildGraph()`에서 6개 모듈 생성 루프를 제거. `chainIn → master → analyser → destination`만 연결하고 `modules`는 빈 객체. `chainOrder = []`.

**1.1b 리버브 임펄스 캐싱 (CPU 드롭아웃 방어).** 생성자/`_buildGraph`에서 기본 임펄스를 한 번만 계산해 `this._defaultImpulse = this._impulse(1.8, 3)`로 캐싱. `_mk_reverb()`는 매번 계산하지 말고 `conv.buffer = this._defaultImpulse` 참조만. (`set('reverb','size')`로 사용자가 Size를 바꿀 때만 `_impulse` 재계산 — 이는 의도된 사용자 액션이라 OK.) → 재생 중 리버브 카드 드롭 시 '뚝' 끊김 제거.

**1.2 인스턴스 생성/삭제.**
- `addInstance(id: string, type: string)`: `(this as any)['_mk_'+type]()` 호출 → `m.type = type`, `m.params = defaultParams(type)` 세팅 → `this.modules[id] = m`. 기본 `enabled=false`. (연결은 `updateChain`이 담당.)
- `removeInstance(id)`: `m.input.disconnect()`, `m.output.disconnect()`, 내부 LFO 정지(`m.lfo?.stop()` — tremolo/chorus 누수 방지) 후 `delete this.modules[id]`.

**1.2b 기본값 Single Source of Truth (PARAM_DEFAULTS 제거).** 하드코딩 `PARAM_DEFAULTS` 객체를 삭제하고 `modules.ts`의 `MODULE_MAP`에서 파생:
```ts
import { MODULE_MAP } from './modules';
function defaultParams(type: string) {
  const def = MODULE_MAP[type as ModuleId];
  const p: Record<string, number|string> = {};
  for (const k of def.knobs) p[k.param] = k.value;
  if (def.type) p.type = def.type.value;   // filter의 'lowpass' 등 노브 아닌 타입 셀렉터
  return p;
}
```
→ 엔진·UI·템플릿이 `modules.ts` 단일 소스를 바라봄. (`_buildGraph`의 `m.params = {...PARAM_DEFAULTS[id]}`도 이 함수로 교체.)

**1.3 `reorder()` → `updateChain(order: string[])`로 일반화 + 무클릭 페이드.** 모듈 간 연결만 끊고 순서대로 재연결하는 `_rewire(order)` 내부 헬퍼 분리(`chainIn`+모든 모듈 `output` disconnect → 순서대로 connect → `master`; 빈 배열이면 `chainIn.connect(master)` 직결; modules에 존재하는 id만 필터). `updateChain`은:
```
chainOrder = [...order]
if (ctx.state !== 'running') { _rewire(order); return; }   // suspended(레슨 init 등): 페이드 없이 즉시 — master 0 고착 방지
const mv = masterVol/100                                     // 라이브 gain이 아닌 의도된 볼륨 캡처(연속 드래그 안전)
master.gain fade-out → 0  (linearRampToValueAtTime, +10ms)
clearTimeout(_chainTimer); _chainTimer = setTimeout(() => {  // 페이드아웃 완료 후 재연결(디바운스)
  _rewire(order)
  master.gain: setValueAtTime(0.0001) → linearRampToValueAtTime(mv, +10ms)  // fade-in
}, 14)
```
→ 페이드아웃이 끝난 뒤 재연결되므로 진짜 무클릭. 격렬한 연속 드래그도 `_chainTimer` 디바운스로 마지막 순서만 재연결.

**1.4 `set(id, param, v)`의 타입 분기 수정.** 현재 `switch(\`${id}.${param}\`)` → `const m = this.modules[id]; if(!m) return; switch(\`${m.type}.${param}\`)`. 나머지 `_setDrive(m,…)` 등은 `m` 객체를 받으므로 변경 불필요.

**1.5 직렬화 포맷 교체.** `EngineState`를 다음으로 변경:
```ts
interface InstanceState { id: string; type: string; enabled: boolean; params: Record<string, number|string>; }
interface EngineState { src:{…}; master:number; instances: InstanceState[]; }  // 순서 = 배열 순서 (chain 필드 제거)
```
- `getState()`: `chainOrder`를 순회해 `instances` 배열 생성.
- `applyState(s)`: 기존 인스턴스 전부 `removeInstance` → `s.instances` 순서대로 `addInstance`+params `set`+`setEnabled` → `updateChain(s.instances.map(i=>i.id))`.

## Phase 2 · 레슨 호환 (최소 변경, `src/components/EffectPlayer.astro`)
레슨은 단일 이펙트. 엔진 생성 직후(play-init 블록 `engine = new Engine()` 다음)에:
```js
engine.addInstance(moduleId, moduleId);  // instanceId == type == moduleId
engine.updateChain([moduleId]);
```
이러면 이후 `engine.set(moduleId,…)`, `setEnabled(moduleId,…)`, 필터 캔버스 드래그까지 **전부 기존 코드 그대로 동작**. 그 외 레슨 코드·UI 변경 없음.

## Phase 3 · 샌드박스 UI 전면 개편 (`src/pages/sandbox.astro`)

**3.1 3단 레이아웃.**
- **좌 팔레트**: 6개 타입 칩(드래그 가능한 "창고"). 작은 카드, 클릭/드래그로 랙에 추가.
- **중앙 랙 (드롭존)**: 비어 있다가 인스턴스 카드가 쌓임. 빈 상태 안내 문구.
- **우 비주얼라이저**: 기존 출력 미터·오실로스코프·스펙트럼 그대로 유지.

**3.2 카드 템플릿.** 6개 타입의 카드 마크업을 Astro `<template data-type="…">`로 **서버 렌더**(노브 슬라이더 HTML을 `MODULES[type].knobs`로 그대로 생성, 기존 `.slider-wrap` data-속성 재사용). 드롭/추가 시 `template.content.cloneNode(true)`로 복제, 고유 `instanceId`(예: `filter-3`) 부여, 삭제(✕) 버튼 포함.

**3.3 동적 카드 생성 + 이벤트 팩토리.** `bindCard(card, instanceId, type)` 함수: 슬라이더 input→`engine.set(instanceId,…)`, 전원 버튼→`engine.setEnabled`, 타입버튼(filter)→`engine.set(instanceId,'type',…)`, 삭제 버튼→`engine.removeInstance`+카드 제거+`syncChain()`. 기존 `setPwrVisual`/`selectBtn`/`setSliderDOM`/`setSliderByParam` 재사용(인스턴스 카드 단위로 동작하도록 querySelector 범위만 card로).

**3.4 DnD.**
- 팔레트→랙: 팔레트 칩 드래그 후 랙에 드롭 시 새 인스턴스 카드 추가. (또는 칩 클릭 = 맨 끝에 추가.)
- 랙 내부 재정렬: 기존 `getDragAfter`/드래그 손잡이 로직 재사용.
- 모든 추가/삭제/재정렬 후 `syncChain()` 호출 → DOM에서 카드 id 순서 수집 → `engine.updateChain(order)` + `renderChainFlow(order)`.

**3.5 체인 흐름줄·프리셋·Bypass.** `renderChainFlow`는 인스턴스 id/타입 기반으로 갱신(라벨에 타입명, 중복 시 `FILTER`, `FILTER` 식). 프리셋·Bypass·링크공유 버튼 유지.

## Phase 4 · 직렬화·프리셋·마이그레이션 (`sandbox.astro` + `src/lib/presets.ts`)

**4.1 DOM↔상태.** `readStateFromDOM()`이 랙의 카드들을 순회해 `instances: [{id,type,enabled,params}]` 생성. `writeStateToDOM(state)`가 랙을 비우고 `state.instances` 순서대로 카드를 만들어 꽂은 뒤 값·전원·체인흐름 반영(`applyFullState`가 `engine.applyState`도 호출).

**4.2 프리셋 재작성.** `presets.ts`를 신규 인스턴스 배열 포맷으로 변경. 각 프리셋이 `instances` 배열을 가짐(예: 라디오스타 = `[{type:'filter',…bandpass}, {type:'drive',…}]`). `CLEAN_BASE`는 빈 `instances:[]`.

**4.3 마이그레이션 어댑터.** `decodeState()` 전처리에 `migrate(obj)` 추가: `obj.modules`가 있고 `obj.instances`가 없으면(구버전) → `(obj.chain||DEFAULT_CHAIN).map(type => ({id:type, type, enabled:obj.modules[type].enabled, params:obj.modules[type].params}))`로 변환해 `instances`로 래핑. 신버전은 그대로 통과. 잘못된 입력은 `null` 반환(기존처럼).

---

## 영향 파일
- `src/lib/engine.ts` — 인스턴스 API + 직렬화 포맷 (핵심)
- `src/pages/sandbox.astro` — 팔레트·동적 랙·DnD 전면 개편 (가장 큰 작업)
- `src/lib/presets.ts` — 인스턴스 배열 포맷으로 재작성
- `src/components/EffectPlayer.astro` — 인스턴스 1개 생성 2줄 추가 (레슨 호환)
- `src/lib/modules.ts` — 변경 없음(타입 정의·노브 메타 재사용)

## 검증 (preview 서버 `soundlab-dev`, port 4321)
1. `npm run build`로 9페이지 컴파일 확인.
2. **레슨 회귀**: `/SoundLab/learn/filter/` 재생→슬라이더·전원·캔버스 드래그·퀴즈 정상 동작(인스턴스 1개 경로).
3. **인스턴스화**: 샌드박스에서 Filter 2개 추가 → 각각 Cutoff 다르게(500Hz / 5kHz) → `engine.set`이 독립 적용되는지 eval로 확인.
4. **동적 체인**: 재생 중 카드 순서 드래그 변경 → 콘솔 에러 없이 소리 재구성, 체인흐름줄 갱신.
5. **삭제**: 카드 ✕ → 인스턴스 제거 후에도 나머지 체인 정상.
6. **직렬화 왕복**: 인스턴스 2개 구성 → 링크 공유 → 새 URL 진입 시 동일 복원.
7. **구버전 호환**: 기존 맵 포맷 `?p=`(Phase 2에서 만든 base64) 진입 시 화면 안 깨지고 인스턴스로 변환되는지.
