# 믹싱 허브 구현 플랜

## Context
5대 허브 중 믹싱만 토픽 0개 (`HUB_META`에 메타만 존재). 다른 허브 패턴 = 토픽 MDX(Easy/Normal/Hard `<Level>`) + 전용 위젯 + 퀴즈 + `scaffold: true`.

믹싱이 기존 허브와 결정적으로 다른 점: **여러 소리가 동시에 울려야** 한다. 지금까지의 오디오 레이어는 전부 단일 소스(SignalSource 1개 / SynthVoice 단발)였다. 따라서 이 허브의 토대는 **멀티트랙 믹스버스**(`audio/mixer.ts`)이고, 이것이 AudioCore 공유 추상화의 세 번째 소비자가 된다 (SignalSource·SynthVoice에 이어).

핵심 설계 결정:
- **음원은 100% 합성** (오디오 샘플 파일 없음 — 프로젝트의 zero-asset 원칙 유지). 드럼=노이즈 버스트+킥(사인 피치 드롭), 베이스=낮은 톤 플럭, 멜로디=상위 옥타브 플럭. 기존 `source.ts`/`synth.ts` 프리미티브 재사용.
- **위젯은 1개(`MixerWidget`)를 config로 변주** — EffectPlayer가 6개 이펙트를 1컴포넌트로 처리한 것과 동일한 전략. 토픽마다 노출 컨트롤만 다르게 (`widgetConfig.controls: ['fader'] | ['fader','pan'] | ...`).
- 토픽별 1커밋 파일럿 진행 (기존 허브들과 동일한 리듬).

---

## Phase A · 오디오 토대 — `src/audio/mixer.ts`

**MixBus**: AudioCore 위에 N개 트랙을 올리는 클래스.
```
MixTrack = { pattern(16step 시퀀서), gain(GainNode), pan(StereoPannerNode),
             eq(BiquadFilterNode, 옵션), analyser(트랙 미터용), mute/solo }
track.gain → track.pan → core.input   // master·메인 analyser는 코어 재사용
```
- 16스텝 패턴 루프: `setInterval` 대신 lookahead 스케줄러(Web Audio 표준 패턴, 25ms 폴링 + 0.1s 선행 예약) — 탭 백그라운드에서도 박자 안정.
- 트랙 팩토리 3종: `kick`(사인 150→50Hz 피치 드롭), `bass`(낮은 플럭), `lead`(높은 플럭). 패턴은 하드코딩 프리셋 (드럼 4onfloor, 베이스 8분, 멜로디 신코페이션).
- solo 로직: solo된 트랙이 하나라도 있으면 나머지 전부 임시 mute (DAW 표준 동작).
- 트랙별 소형 analyser → 트랙 미터. 마스터 클립 감지(>0.98)는 기존 미터 로직 재사용.

## Phase B · `MixerWidget.astro` (단일 위젯, config 변주)

3트랙 채널스트립 UI: [트랙명 | 미터 | 페이더 | Pan노브 | M/S 버튼].
`widgetConfig`로 토픽별 노출 제어:
- `controls`: 보일 컨트롤 (`fader`, `pan`, `eq`, `comp`)
- `tracks`: 초기 게인/팬 값 (밸런스 망가진 상태로 시작 → 학생이 고치는 과제형)
- 기존 컨벤션 재사용: `.slider-wrap` 데이터 속성, `setPwrVisual` 스타일 토큰, 스코프/스펙트럼 캔버스.

`content.config.ts`의 `WIDGETS`에 `'mixer'` 추가 + `TopicWidget.astro` 분기 1줄.

## Phase C · 토픽 4 + 1 (순서 = order)

| # | slug | kr | 위젯 구성 | 핵심 학습 |
|---|------|----|----------|----------|
| 1 | `balance` | 볼륨 밸런스 | fader + M/S | dB 개념, 게인 스테이징, "믹싱의 80%는 페이더". 시작 상태: 베이스 과다·멜로디 묻힘 → 균형 잡기 |
| 2 | `pan` | 패닝과 스테레오 | fader + pan | L/R 배치, 센터에 킥·베이스 두는 이유. 모노 합 체크(Hard) |
| 3 | `eq-masking` | 주파수 마스킹과 EQ | fader + 트랙별 1밴드 EQ | 베이스·멜로디가 같은 대역에서 충돌 → EQ로 자리 만들기. 스펙트럼에 트랙 색 오버레이 |
| 4 | `compressor` | 컴프레서 | fader + 마스터 comp | DynamicsCompressorNode, threshold/ratio, 게인 리덕션 미터. 효과음이 아니라 "다이내믹스 관리"임을 강조 |
| 5 | (확장) `depth` | 공간감과 깊이 | fader + 리버브 센드 | 센드/리턴 개념. 이펙트 허브 리버브와 교차 링크 |

각 토픽: Easy(비유·과제형 한 줄 지시) / Normal(dB·주파수 수치) / Hard(LUFS, 마스킹 심리음향, 컴프 어택·릴리즈) 3단 + 퀴즈(`quizzes.ts`에 키 추가).

## Phase D · 허브 인덱스 검증
`/learn/mixing/` 은 동적 라우트(`[hub]/index.astro`)라 토픽만 넣으면 자동 생성. 랜딩·커리큘럼 순번 노출 확인만.

---

## 영향 파일
- `src/audio/mixer.ts` — 신규 (MixBus + 트랙 팩토리 + lookahead 스케줄러)
- `src/components/MixerWidget.astro` — 신규 (단일 위젯, config 변주)
- `src/content.config.ts` — `WIDGETS`에 `'mixer'` 추가
- `src/components/TopicWidget.astro` — 분기 1줄
- `src/content/topics/mixing/*.mdx` — 토픽 4~5개
- `src/lib/quizzes.ts` — 퀴즈 키 추가

## 진행 순서 (커밋 단위)
1. `feat(mixing): MixBus 멀티트랙 토대 + balance 토픽 + MixerWidget` ← 파일럿(최대 작업)
2. `feat(mixing): pan 토픽 (StereoPanner + L/R 미터)`
3. `feat(mixing): eq-masking 토픽 (트랙 EQ + 스펙트럼 오버레이)`
4. `feat(mixing): compressor 토픽 (마스터 컴프 + GR 미터)`
5. (선택) `feat(mixing): depth 토픽 (리버브 센드)`

## 검증 (토픽마다)
1. `npm run build` 통과
2. `/learn/mixing/<slug>/` 재생 → 3트랙 동시 루프, 페이더·팬 독립 동작
3. Easy/Normal/Hard 전환 시 본문·노출 컨트롤 변화
4. 탭 비활성 1분 후 복귀 시 박자 안 깨지는지 (lookahead 검증)
5. 기존 허브 회귀 없음 (AudioCore 공유 변경 시 레슨 1개 스팟체크)
