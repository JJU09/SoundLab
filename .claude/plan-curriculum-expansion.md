# 커리큘럼 확장 플랜 — 허브 균형 + 부족 토픽 보강

## 목적
5대 허브의 토픽 수 불균형(이펙트 6·믹싱 5 vs 디지털 2·신스 2)을 해소하고,
"어떤 수준의 유저가 와도 학습이 끊기지 않는" 고른 학습 곡선을 만든다.

현재: **18토픽** (acoustics 3 · digital 2 · synthesis 2 · effects 6 · mixing 5)
목표: **25토픽** (acoustics 4 · digital 4 · synthesis 5 · effects 6 · mixing 6) → 분포 4·4·5·6·6

> 사용자 결정(2026-06-12): Tier 1+2 **전체 계획만 수립**(구현 보류). 신스 2번째 합성법은 **가산·FM 둘 다** 추가.

---

## 감사 결과 — 기존 18토픽

**잘 되어 있음**
- 전 토픽 `scaffold: true` + Easy/Normal/Hard 3단 + 퀴즈 1:1 매칭. 수준별 분기 일관됨.
- acoustics `tone`이 파형·배음·푸리에를 초급부터 깔아 신스/디지털의 개념 온램프 역할.
- 위젯 1개를 config로 변주하는 전략(effect 6종, mixer 5종)이 확립됨 → 신규 토픽도 이 패턴 재사용.

**개선 여지 (토픽과 별개의 병행 과제)**
- **U1. 기본 난이도 = `normal`** (`TopicLayout.astro:52`). 완전 초심자도 Normal 착지.
  → 첫 방문자 Easy 시작 또는 레벨 선택 가시성 강화 검토. (이 플랜의 토픽 작업과 독립)
- **U2. 여정 중간 함몰** — 학습 순서 1→5에서 2(디지털)·3(신스)가 빈약. 본 플랜으로 해소됨.

---

## Tier 1 — 얇은 허브 균형 (최우선, 4토픽)

### T1-1. digital ▸ 샘플레이트 (Sampling Rate)
- slug `samplerate` · kr `샘플레이트` · **order 1** (아래 디지털 재정렬 참조)
- tagline: 시간을 잘게 끊어 소리를 담다
- **핵심**: 비트뎁스(진폭축)의 짝 = 시간축 이산화. sample-and-hold 계단 → 재구성. 샘플레이트↑ = 더 촘촘 = 고음까지 정확.
- 3단:
  - Easy: 영화 필름처럼 1초에 몇 장을 찍느냐. 적게 찍으면 빠른 움직임을 놓침.
  - Normal: Hz/kHz, 44.1k·48k의 의미, 1샘플 = 한 순간의 진폭값. 비트뎁스와 직교하는 두 축.
  - Hard: 나이퀴스트 예고(→aliasing 교차링크), sinc 보간/재구성, 오버샘플링.
- **위젯**: 신규 `samplerate` (연속파 위에 샘플점 + sample-and-hold 계단 + 재구성선, rate 슬라이더). 경량 — tone/aliasing 캔버스 스캐폴딩 재사용.
- 퀴즈 키 `samplerate`

### T1-2. synthesis ▸ 가산합성 (Additive)
- slug `additive` · kr `가산합성` · **order 3**
- tagline: 사인파를 쌓아 음색을 빚다
- **핵심**: 감산의 정반대. tone의 "모든 파형은 사인의 합"을 손으로 실현 — 배음 진폭 슬라이더로 톱니/사각 만들기.
- 3단:
  - Easy: 레고처럼 단순한 사인을 쌓아 복잡한 소리. 1·3·5 배음만 켜면 사각파에 가까워짐.
  - Normal: 기음·배음·진폭 1/n, 푸리에 합성. 감산(깎기)과 가산(쌓기)의 대비.
  - Hard: 깁스 현상, 부분음(inharmonic partials), 가산의 비용(오실레이터 N개)과 한계.
- **위젯**: 신규 `additive` (배음 8~16개 진폭 슬라이더 → 실시간 파형 + 스펙트럼). tone 위젯의 스펙트럼 표시 재사용.
- 퀴즈 키 `additive` · tone(푸리에)·subtractive와 교차링크

### T1-3. synthesis ▸ FM 합성 (FM Synthesis)
- slug `fm` · kr `FM 합성` · **order 4**
- tagline: 주파수를 흔들어 금속·벨을 빚다
- **핵심**: 캐리어를 모듈레이터로 주파수 변조 → 측대역(sideband) 폭발. ratio가 음색 종류, index가 배음 풍부함.
- 3단:
  - Easy: 빠르게 떨면(비브라토를 극단으로) 떨림이 아니라 새 음색이 됨. 종·전자피아노 소리.
  - Normal: 캐리어/모듈레이터, C:M 비율(정수=조화, 비정수=금속), 변조 인덱스 = 측대역 수.
  - Hard: 베셀 함수 측대역 진폭 Jₙ(β), DX7 6오퍼레이터/알고리즘, 위상변조(PM)와의 등가.
- **위젯**: 신규 `fm` (캐리어 freq + C:M ratio + index 슬라이더 → 스펙트럼 측대역 + 파형). 측대역 가시화가 핵심.
- 퀴즈 키 `fm` · tremolo(LFO 변조)와 대비 교차링크

### T1-4. synthesis ▸ LFO·모듈레이션 (Modulation)
- slug `modulation` · kr `LFO와 모듈레이션` · **order 5**
- tagline: 느린 떨림으로 소리에 생명을 불어넣다
- **핵심**: 이펙트(트레몰로·코러스)가 쓰던 LFO의 "출처"를 신스가 소유. 한 LFO를 음량/피치/컷오프에 라우팅 → 트레몰로·비브라토·와우.
- 3단:
  - Easy: 느린 흔들기 손잡이 하나. 어디에 연결하냐에 따라 떨림(음량)·울렁임(음정)·왈왈(필터).
  - Normal: LFO rate/depth, 변조 대상(목적지) 라우팅, 단극/양극, 가청 이하(<20Hz).
  - Hard: 변조 매트릭스, rate를 가청대로 올리면 AM/FM(→fm 교차링크), 엔벨로프 vs LFO(1회성 vs 주기).
- **위젯**: `synth` 위젯 확장(`controls:[..., lfo]`) — 기존 신스 보이스에 LFO 라우팅 추가. 신규 위젯 회피.
- 퀴즈 키 `modulation` · tremolo·chorus·fm·adsr와 교차링크

---

## Tier 2 — 마감·심화 (3토픽)

### T2-1. digital ▸ dBFS·헤드룸 (Levels & Headroom)
- slug `levels` · kr `레벨과 헤드룸` · **order 4**
- tagline: 0을 넘으면 깨진다 — 디지털의 천장
- **핵심**: 0dBFS = 디지털 최대치, 초과 = 클리핑. 헤드룸·다이내믹 레인지·게인 스테이징을 디지털 관점에서 (balance/compressor의 단편 언급을 한 토픽으로 통합).
- 3단:
  - Easy: 컵에 물(소리)을 따르다 넘치면(0dBFS) 튄다(찌그러짐). 여유 공간 = 헤드룸.
  - Normal: dBFS 척도(0이 천장, 음수가 정상), 비트뎁스와 다이내믹 레인지(6dB/bit), -6dB 헤드룸 관행.
  - Hard: True Peak(인터샘플 피크), 게인 스테이징 체인, 고정소수점 vs 부동소수점 헤드룸.
- **위젯**: 신규 경량 `level` (입력 게인 슬라이더 → dBFS 미터 + 클립 표시 + 파형 클리핑 시각화). source.ts 재사용.
- 퀴즈 키 `levels` · bitdepth·balance·compressor와 교차링크

### T2-2. mixing ▸ 라우드니스·리미팅 (Loudness & Limiting)
- slug `loudness` · kr `라우드니스와 리미팅` · **order 6**
- tagline: 마지막 천장 — 크게, 그러나 깨지지 않게
- **핵심**: 믹싱 허브 캡스톤. 피크 vs 라우드니스(체감 음량), 리미터로 천장 누르고 전체 끌어올리기, 스트리밍 LUFS 타깃 맛보기.
- 3단:
  - Easy: 컴프의 극단 = 리미터(절대 못 넘는 벽). 벽을 낮추고 전체를 올리면 더 크게 들림.
  - Normal: 피크 미터 vs 라우드니스(RMS/LUFS 근사), 리미터 = 고비율 컴프(∞:1) + ceiling, 라우드니스 워.
  - Hard: LUFS(K-weighting) 개념, True Peak ceiling(-1dBTP), 스트리밍 정규화(-14 LUFS), 다이내믹 보존 트레이드오프.
- **위젯**: `MixerWidget` 확장(`controls:[fader, limiter]`) — MixBus 컴프 인프라 재사용(ratio 20:1+ceiling). 통합 RMS/라우드니스 근사 미터 추가. **저비용**(컴프 재활용).
- 퀴즈 키 `loudness` · compressor·depth·levels와 교차링크

### T2-3. acoustics ▸ 맥놀이 (Beats)
- slug `beats` · kr `맥놀이` · **order 3** (아래 acoustics 재정렬 참조)
- tagline: 두 음이 가까울 때 생기는 음량의 진동
- **핵심**: 위상간섭의 후속. 두 근접 주파수(예 440·442Hz) → 보강·상쇄가 |f1−f2|Hz로 반복 = 음량 맥동. 조율의 원리.
- 3단:
  - Easy: 거의 같은 두 음 → "우-웅 우-웅" 느리게 커졌다 작아짐. 기타 줄 맞출 때 그 소리.
  - Normal: 맥놀이 주파수 = |f1−f2|, 두 주파수가 가까울수록 느려지고 같아지면 멈춤(조율 완료).
  - Hard: 삼각함수 합 → 평균 주파수 반송파 × 차주파수 포락선, 결합음(combination tone), 거친맥놀이→임계대역(→eq-masking 교차링크).
- **위젯**: `phase` 위젯 확장(`config`로 2주파수 미세차) 또는 경량 신규 `beats`(두 주파수 슬라이더 + 합성파형 + 포락선). phase 재사용 우선 검토.
- 퀴즈 키 `beats` · phase·tone·eq-masking과 교차링크

---

## 허브 내 순서 재정렬

신규 삽입으로 일부 기존 토픽 `order` 갱신 필요(학습 경로 정렬 목적).

| 허브 | 변경 |
|------|------|
| **acoustics** | tone 1 · phase 2 · **beats 3(신규)** · comb 4(3→4) |
| **digital** | **samplerate 1(신규)** · bitdepth 2(1→2) · aliasing 3(2→3) · **levels 4(신규)** |
| **synthesis** | adsr 1 · subtractive 2 · **additive 3** · **fm 4** · **modulation 5** (전부 append, 기존 불변) |
| **mixing** | balance~depth 1~5 불변 · **loudness 6(신규)** (append) |
| **effects** | 변경 없음 |

> digital은 "샘플링(시간) → 양자화(진폭) → 에일리어싱(실패) → 레벨(천장)" 순서가 되도록 samplerate를 맨 앞에 둠. acoustics는 beats를 phase 직후로.

---

## 위젯 작업량 요약 (효순위 산정)

| 토픽 | 위젯 전략 | 비용 |
|------|----------|:---:|
| loudness | MixerWidget 확장(comp 재사용) | **낮음** |
| modulation | synth 위젯 확장 | 낮~중 |
| beats | phase 위젯 확장 우선 | 낮~중 |
| levels | 신규 경량(source 재사용) | 중 |
| samplerate | 신규 경량(캔버스 재사용) | 중 |
| additive | 신규(배음 슬라이더+스펙트럼) | 중 |
| fm | 신규(측대역 스펙트럼) | 중 |

**신규 위젯 ~4개**(samplerate·additive·fm·levels), **기존 확장 3개**(modulation·loudness·beats).

---

## 권장 구현 순서 (커밋 단위 · 추후 착수 시)

1. `feat(synthesis): additive 토픽 (가산합성 위젯)` — tone 푸리에와 직결, 임팩트 큼
2. `feat(synthesis): fm 토픽 (FM 측대역 위젯)`
3. `feat(synthesis): modulation 토픽 (synth LFO 확장)` — 신스 허브 완성(5)
4. `feat(digital): samplerate 토픽 (sample-and-hold 위젯)`
5. `feat(digital): levels 토픽 (dBFS·헤드룸)` — 디지털 허브 완성(4)
6. `feat(mixing): loudness 토픽 (리미터·라우드니스)` — 믹싱 캡스톤(6)
7. `feat(acoustics): beats 토픽 (맥놀이)` — acoustics 완성(4)

각 토픽: MDX(Easy/Normal/Hard) + 위젯(신규/확장) + `quizzes.ts` 키 + `content.config.ts` WIDGETS 등록(신규 위젯 시) + 순서 재정렬 + build/preview 검증. 토픽당 1커밋.

## 영향 파일 (착수 시)
- `src/content/topics/<hub>/*.mdx` — 신규 7개
- `src/components/*Widget.astro` — 신규 4 + 확장 3
- `src/audio/*.ts` — additive/fm/samplerate 합성 로직(synth.ts·source.ts 재사용 가능 검토)
- `src/lib/quizzes.ts` — 키 7개
- `src/content.config.ts` — WIDGETS에 신규 위젯명 등록
- 기존 토픽 frontmatter `order` 갱신(acoustics comb, digital bitdepth·aliasing)

## 검증 (토픽마다, 기존 리듬 동일)
1. `npm run build` 통과(페이지 수 증가 확인)
2. `/learn/<hub>/<slug>/` 위젯 동작 + Easy/Normal/Hard 본문 전환
3. 신규 합성 위젯은 OfflineAudioContext로 결정론 검증(프리뷰 탭 throttle 회피 — 이전 세션 교훈)
4. 기존 토픽 회귀 없음(공유 위젯 확장 시 스팟체크)
5. prev/next 네비 순서 재정렬 반영 확인
