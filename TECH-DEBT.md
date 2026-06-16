# SoundLab 기술 부채 리포트

> 작성일: 2026-06-16 · 대상: `soundlab-astro` (`main`, 배포 완료 — soundlab.jjuapp.com)
> 우선순위 점수 = (Impact + Risk) × (6 − Effort) — 각 항목 1~5점, Effort는 낮을수록 빠름

## 요약

코드 베이스는 전반적으로 건강한 편입니다. 오디오 엔진은 이미 `lib/` → `audio/` 레이어로 분리됐고(`lib/engine.ts`는 하위 호환 shim만 남음), `console.*` 누수나 `TODO/FIXME` 흔적이 거의 없고, 콘텐츠(MDX 25개)와 위젯(23개) 구조도 깔끔합니다.

가장 큰 부채는 **안전망 부재**입니다. 테스트가 0개이고 CI는 타입체크·테스트 없이 빌드 후 곧장 프로덕션에 배포합니다. 그다음은 **인터랙션 로직 중복**(노브/드래그/파라미터 매핑이 3곳에 재구현)과 **타입 회피**(`as any` 12곳)입니다. 문서 한 곳(README 데모 링크)이 실제 도메인과 어긋나 있습니다.

## 우선순위 표

| # | 항목 | 유형 | Impact | Risk | Effort | 우선순위 |
|---|------|------|:--:|:--:|:--:|:--:|
| 1 | CI 품질 게이트 부재 (빌드만 하고 바로 배포) | Infra | 3 | 3 | 2 | **24** |
| 2 | 테스트 인프라 0 (vitest/jest/playwright 없음) | Test | 4 | 4 | 3 | **24** |
| 3 | 노브/드래그/파라미터 매핑 로직 3곳 중복 | Code | 4 | 3 | 3 | **21** |
| 4 | `as any` 12곳 (dataset 파싱·AudioContext shim) | Code | 2 | 3 | 2 | **20** |
| 5 | README 데모 링크가 옛 GitHub Pages URL 가리킴 | Docs | 2 | 2 | 1 | **20** |
| 6 | 의존성 마이너 뒤처짐 (astro·tailwind) | Dependency | 1 | 2 | 1 | **15** |
| 7 | 대형 파일 2개 (effects 740줄 / EffectPlayer 600줄) | Architecture | 3 | 3 | 4 | **12** |
| 8 | GA4 측정 ID 미설정 (`G-XXXXXXX` 플레이스홀더) | Infra | 1 | 1 | 1 | **10** |

## 항목별 상세

### 1. CI 품질 게이트 부재 — 우선순위 24
`.github/workflows/deploy.yml`이 `main` push마다 `npm run build` 후 바로 GitHub Pages에 배포합니다. 타입체크·테스트·린트 단계가 없어, 타입 오류나 깨진 위젯이 그대로 프로덕션에 나갈 수 있습니다.
**근거:** 배포 후 단계라 "프로덕션 사고 예방"이 가장 직접적인 가치. 빌드 전에 `astro check`(타입·콘텐츠 스키마 검증)만 추가해도 회귀 상당수를 잡습니다.
**조치:** deploy 직전 `npx astro check` 스텝 추가 → (2번 완료 후) 테스트 스텝 추가.

### 2. 테스트 인프라 0 — 우선순위 24
복잡한 DSP 로직(`audio/pedalboard.ts`, `mixer.ts`, `effects.ts`)과 상태 직렬화(Base64 URL 공유·구버전 마이그레이션)가 전부 무테스트입니다. 회귀가 조용히 배포됩니다.
**근거:** 순수 로직부터 시작하면 비용 대비 효과가 큼. 캔버스/오디오 렌더링까지 갈 필요 없이 직렬화·프리셋 병합·파라미터 매핑·퀴즈 데이터 정합성만 덮어도 핵심을 보호합니다.
**조치:** vitest 도입 → `presets.ts` 직렬화 라운드트립, `modules.ts` 매핑, `quizzes.ts` 정답 인덱스 범위 검증부터.

### 3. 인터랙션 로직 중복 — 우선순위 21
노브 드래그(`pointerdown/move`), 파라미터 정규화(`toP`, `logMap`), 슬라이더 동기화가 `EffectPlayer.astro` · `sandbox/effects/index.astro` · `sandbox/synth/index.astro`에 각각 재구현돼 있습니다. 버그를 고치면 3곳을 고쳐야 합니다.
**근거:** 새 위젯을 추가할수록 비용이 선형 증가. 공통 모듈로 빼면 향후 개발 속도가 직접 개선됩니다.
**조치:** `src/lib/ui/knob.ts`(또는 `audio/ui.ts`)로 드래그+선형/로그 매핑 헬퍼 추출, 세 소비자가 import.

### 4. `as any` 12곳 — 우선순위 20
대부분 `el.dataset as any`(파라미터 파싱)와 `window as any`(webkitAudioContext 폴백)입니다. 런타임 타입 오류 위험이 있고 리팩터링 시 안전망이 사라집니다.
**조치:** `parseKnobDataset()` 타입드 헬퍼와 `createAudioContext()` shim 하나로 흡수 — 3번 작업과 함께 처리하면 자연스럽게 줄어듦.

### 5. README 데모 링크 불일치 — 우선순위 20 (퀵윈)
README는 `https://jju09.github.io/SoundLab/`를 가리키지만 실제 운영 도메인은 `soundlab.jjuapp.com`입니다(`public/CNAME`·`astro.config.mjs` 기준). 방문자가 옛 경로로 갈 수 있습니다.
**조치:** README 링크를 커스텀 도메인으로 교체. 1분.

### 6. 의존성 마이너 업데이트 — 우선순위 15 (퀵윈)
`astro 6.4.5 → 6.4.7`, `tailwindcss / @tailwindcss/vite 4.3.0 → 4.3.1`. 패치 레벨이라 리스크 낮음.
**조치:** `npm update` 후 빌드 확인.

### 7. 대형 파일 분리 — 우선순위 12
`sandbox/effects/index.astro`(740줄)와 `EffectPlayer.astro`(600줄)가 마크업+인라인 스크립트+시각화를 한 파일에 담고 있습니다. 가독성·재사용성 저하.
**조치:** 3·4번으로 공통 로직을 먼저 추출하면 자연히 줄어듦. 남는 시각화 루틴은 `viz/` 모듈로 분리. 큰 작업이라 후순위.

### 8. GA4 미설정 — 우선순위 10
`layouts/Base.astro`에 `G-XXXXXXX` 플레이스홀더만 있어 분석이 비활성입니다. 부채라기보다 미완 기능.
**조치:** 측정 ID 발급해 채우거나, 사용 안 하면 코드 제거.

## 단계별 실행 계획

**Phase 0 — 퀵윈 (반나절 이내):** #5 README 링크, #6 의존성 업데이트, #8 GA 결정. 기능 작업과 무관하게 즉시 처리 가능.

**Phase 1 — 안전망 (1~2일):** #1 CI에 `astro check` 추가 → #2 vitest 도입 + 순수 로직 테스트 → CI에 테스트 스텝 연결. 이후 모든 리팩터링의 토대.

**Phase 2 — 중복 제거 (2~4일):** #3 노브/파라미터 공통 모듈 추출 → #4 `as any`를 타입드 헬퍼로 흡수. Phase 1 테스트가 회귀를 잡아줌.

**Phase 3 — 구조 정리 (여유 시):** #7 대형 파일 분리. Phase 2 완료 후 자연스럽게 작아진 상태에서 마무리.
