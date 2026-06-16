# 허브별 샌드박스 구현 플랜

> 작성 2026-06-16 · 목표: 5개 허브 각각에 "자유 조립·연주" 샌드박스 제공
> 원칙: 토픽=집중 학습(위젯 1개), 샌드박스=자유 실험(여러 요소 조합). AudioCore·기존 엔진 최대 재활용.

## 0. 현황·결정

- effects 샌드박스(`/sandbox/`)만 존재 = 모듈러 페달보드(Pedalboard 엔진 + 740줄 UI).
- 네비 샌드박스 드롭다운(Base.astro `SANDBOX_OF`)이 이미 전 허브를 "준비 중"으로 노출 → 약속 이행 필요.
- **결정**: 토픽별 ❌(위젯과 중복), **허브별 ⭕**. 자유조립 메타포가 허브마다 다르므로 개념을 허브별로 설계.

### 가치·난이도·재활용 (우선순위 근거)

| 허브 | 샌드박스 개념 | 엔진 재활용 | 가치 | 난이도 |
|------|--------------|------------|:---:|:---:|
| mixing | 미니 믹서 | **MixBus 완성** | 높음 | **낮음** |
| synthesis | 연주 가능한 신스 | SynthVoice + 토픽 엔진 | **최고** | 중–상 |
| acoustics | 파동/배음 실험실 | Additive·Phase·Beats 위젯 | 중 | 중 |
| digital | 로파이 열화 실험실 | Bitcrush·SampleRate·Level 위젯 | 중 | 중 |
| effects | 모듈러 페달보드 | — | — | ✅ 완료 |

권장 착수 순서: **mixing(빠른 출하)** → **synthesis(플래그십)** → acoustics → digital.

---

## 1. 공통 인프라 (Phase A — 첫 샌드박스 전에 1회)

5개를 각각 740줄로 짜면 중복 폭발. 공통 셸·라우팅을 먼저 세운다.

### 1A. 라우팅 재구성
- `/sandbox/` → **샌드박스 허브 선택 랜딩**(5개 카드 그리드, tools/index 패턴 재사용).
- 개별: `/sandbox/effects/`, `/sandbox/synth/`, `/sandbox/mixer/`, `/sandbox/waves/`, `/sandbox/lofi/`.
- 기존 effects 보드(`/sandbox.astro`) → `/sandbox/effects/index.astro`로 이동.
  - **구버전 URL 보존**: `astro.config.mjs` `redirects: { '/sandbox': '/sandbox/effects' }`… 단 `/sandbox/`를 랜딩으로 쓸 거면 redirect 불가 → 랜딩에서 effects를 첫째로 노출하는 것으로 갈음(트래픽 적어 리스크 낮음). 결정 필요.
- `Base.astro` `SANDBOX_OF` 매핑을 허브별 실제 경로로 갱신(ready 토글).

### 1B. 공통 셸 컴포넌트 — `src/components/sandbox/SandboxShell.astro`
effects 보드에서 반복 크롬을 추출해 5개가 공유:
- 헤더(SANDBOX 뱃지 · 제목 · 설명) + 브레드크럼.
- **트랜스포트 바**: ▶/■ 재생, 마스터 볼륨, (옵션) A/B 바이패스.
- **비주얼라이저**: 오실로스코프 + 스펙트럼 캔버스(core.getScope/getSpectrum 재사용) — 공통 `Visualizer.astro`.
- **프리셋 행**: 칩 클릭 → 상태 적용(각 샌드박스가 자기 state 직렬화 제공).
- **난이도 토글**: 토픽과 동일한 `data-level`(easy/normal/hard) 스캐폴딩 일관성.
- 하단 **관련 토픽 카드**(허브 토픽으로 크로스링크) + (no-share-button 원칙 유지: 공유 버튼 없음).

### 1C. 공통 컴포넌트 라이브러리 `src/components/sandbox/`
- `Knob.astro`/`Slider.astro` — 기존 `.sl-range` 패턴 표준화(중복 제거).
- `Keyboard.astro` — 신스용 1.5옥타브 건반(클릭+컴퓨터 키보드 a s d f…), synthesis·digital(소스로) 공용.
- `Visualizer.astro` — scope/spectrum 토글.

---

## 2. 허브별 상세 설계

### 2-1. mixing 샌드박스 — 미니 믹서 (`/sandbox/mixer/`) ★ 먼저
**엔진**: 기존 `MixBus` 거의 그대로. UI만 신설(MixerWidget은 토픽용 단일 컨트롤 변형이라 풀 콘솔 UI 부재).
**구성**:
- 채널 스트립 N개(drums·bass·lead = MixBus.buildStandard). 각 스트립: 페이더(vol)·팬·EQ(freq/gain)·mute·solo·레벨미터(getLevel).
- 마스터 섹션: 마스터 페이더 + 컴프레서(enableCompressor: threshold/ratio/knee/attack/release/makeup + GR미터) + 리버브 센드(enableReverb/setSend).
- 재생 = MixBus 내부 스케줄러(loop). 트랜스포트 바에서 ▶/■.
- 프리셋: "드럼 강조", "보컬 앞으로", "널찍한 공간" 등 게인/팬/센드 레시피.
**스캐폴딩**: easy=페이더·팬·mute만, normal=+EQ·솔로, hard=+컴프·센드.
**크로스링크**: balance·pan·eq-masking·compressor·depth·loudness 전부.
**비용**: 낮음(엔진 완성, UI 조립 + 채널 스트립 반복).

### 2-2. synthesis 샌드박스 — 연주 가능한 신스 (`/sandbox/synth/`) ★ 플래그십
**엔진**: 새 `src/audio/synthengine.ts` — 신호 경로를 모듈로 구성.
```
[OSC A (+B, detune)] → [Mixer] → [Filter(+ADSR mod)] → [Amp(ADSR)] → core.input
                                      ↑                    
                                   [LFO] → (pitch/filter/amp 라우팅)
```
- 폴리포니: 건반 입력당 보이스 생성(간단 voice pool, 6보이스). SynthVoice 확장 또는 신규.
- OSC: 파형(sine/saw/square/tri) + 2nd osc detune(슈퍼소처럼 두껍게) + 옥타브.
- Filter: lowpass cutoff/Q + 엔벨로프 양(filter env amount).
- Amp ADSR: attack/decay/sustain/release(adsr 토픽 엔진 개념 재사용).
- LFO: rate/depth → pitch·filter·amp 중 라우팅(Modulation 위젯 패턴).
- (옵션) Additive 모드: 부분음 슬라이더(Additive 위젯 재활용) 토글.
**입력**: `Keyboard.astro`(클릭/컴퓨터 키보드) + (옵션) 시퀀서 라인 후속.
**프리셋**: "두꺼운 베이스", "플럭", "패드", "리드" 등.
**스캐폴딩**: easy=파형+필터+볼륨, normal=+ADSR, hard=+2nd osc·LFO 라우팅·additive.
**크로스링크**: additive·subtractive·fm·modulation·adsr + effects(이펙트 체인 후속 연결 여지).
**비용**: 중–상(폴리 보이스·건반·모듈 라우팅). 단계적: v1 모노+기본 → v2 폴리·LFO·additive.

### 2-3. acoustics 샌드박스 — 파동/배음 실험실 (`/sandbox/waves/`)
**엔진**: Additive 위젯 엔진(부분음 사인 합) 확장 + 2채널 위상 비교(Phase 위젯).
**구성**:
- 부분음 막대 8~16개(주파수=기본음 정수배, 진폭·위상 조절) → 합성 파형 + 스펙트럼 실시간.
- 모드 토글:
  - **합성(harmonic)**: 부분음 쌓아 음색 빚기(톤 = 배음 구조).
  - **맥놀이(beats)**: 두 근접 주파수 → 진폭 변조 포락선 관찰·청취(Beats 위젯).
  - **위상/간섭(phase)**: 동일 주파수 2개 위상차 → 보강·상쇄(Phase·Comb 위젯).
- 비주얼: 파형 + 스펙트럼 + (맥놀이 모드) 포락선.
**프리셋**: "톱니(1/n)", "구형파(홀수배)", "옥타브 맥놀이", "역위상 상쇄".
**크로스링크**: tone·beats·phase·comb.
**비용**: 중(엔진 존재, 모드 전환·시각화 통합).

### 2-4. digital 샌드박스 — 로파이 열화 실험실 (`/sandbox/lofi/`)
**엔진**: Bitcrush·SampleRate(ZOH)·Level(클리퍼) 위젯 엔진을 직렬 체인으로.
```
[소스: 신스톤/플럭/노이즈/멜로디] → [다운샘플(ZOH)] → [비트뎁스 양자화] → [드라이브/클립] → core.input
```
- 소스 선택(SignalSource 재사용 또는 Keyboard).
- 노브: 가상 샘플레이트(↓할수록 에일리어싱), 비트뎁스(↓할수록 양자화 노이즈), 입력 레벨(클리핑/헤드룸).
- 비주얼: 파형(계단·양자화 계단 보임) + 스펙트럼(에일리어스·노이즈 플로어) + dBFS·CLIP LED(Level 위젯).
- "로파이" 프로듀싱 트렌드와 맞물려 실용적.
**프리셋**: "8비트", "전화 음질", "테이프", "깨끗".
**크로스링크**: samplerate·bitdepth·aliasing·levels.
**비용**: 중(엔진 존재, 체인·소스·시각화 통합).

---

## 3. 영향 파일

신규:
- `src/pages/sandbox/index.astro`(랜딩), `sandbox/{effects,synth,mixer,waves,lofi}/index.astro`
- `src/components/sandbox/SandboxShell.astro`, `Visualizer.astro`, `Knob.astro`, `Slider.astro`, `Keyboard.astro`
- `src/audio/synthengine.ts`(신스), 필요 시 `src/audio/degrade.ts`(로파이 체인)
- 프리셋: `src/lib/sandboxPresets.ts`(허브별)

수정:
- `src/pages/sandbox.astro` → `sandbox/effects/index.astro`로 이동(공통 셸 적용해 슬림화)
- `src/layouts/Base.astro` — `SANDBOX_OF` 허브별 경로·ready 갱신
- `astro.config.mjs` — (선택) redirects
- 각 허브 토픽/인덱스 — 샌드박스로 가는 링크 추가

## 4. 검증 (preview `soundlab-dev` :4321)
- 각 샌드박스 OfflineAudioContext 결정론 확인(신스 보이스 포락선·필터, 믹서 트랙 게인/팬, 파동 합성 스펙트럼, 열화 에일리어스·양자화).
- 건반 입력(클릭+키보드), 프리셋 적용, 난이도 스캐폴딩 노출, 콘솔 클린, 스크린샷.
- 빌드 페이지 수 증가 확인, 네비 드롭다운 ready 반영.

## 5. 시퀀싱 (제안)
- **Phase A**: 공통 인프라(라우팅 + SandboxShell + Visualizer) — effects 보드를 이 셸로 이식하며 검증.
- **Phase B**: mixing 미니믹서(빠른 출하, 엔진 완성).
- **Phase C**: synthesis 신스 v1(모노) → v2(폴리·LFO·additive).
- **Phase D**: acoustics 파동 실험실.
- **Phase E**: digital 로파이 실험실.
- 각 Phase 후 커밋·푸시·검증.

## 6. 미결 결정
1. `/sandbox/` 구URL 처리: 랜딩으로 전환(SEO 약손실 감수) vs effects 유지+개별은 하위경로.
2. synthesis 폴리포니 v1 포함 여부(모노로 빨리 낼지).
3. 공통 셸 추출 범위(effects 보드를 지금 리팩터할지, 신규 4개만 셸 쓰고 effects는 나중에).
