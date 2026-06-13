# 성장·수익화 플랜 — 유틸 도구 중심

## Context & 결정 (2026-06-14)
25토픽 학습 사이트(5허브) 완성 후, "음악 학습자에게 유용 + 광고 수익" 두 목표 동시 추구.

사용자 결정:
- **호스팅/수익화**: 커스텀 도메인 확보 → AdSense 정석 경로.
- **타깃 학습자**: 입문자(소리·음악 기초) + 작곡·프로듀싱 + 악기 학습·청음. (음대/입시 이론은 후순위)
- **첫 착수**: 유틸 도구(튜너·이어트레이닝).

## 솔직한 수익 모델
광고 수익 = 트래픽 × RPM. 한국어 니치 교육 사이트는 RPM이 낮아, **트래픽이 유일한 레버**다.
광고 코드는 마지막 5%이고 그 앞 전제가 (1) AdSense 승인 가능한 호스팅(커스텀 도메인),
(2) 측정(애널리틱스), (3) 발견 가능성(SEO·공유·sticky 도구)이다. 기대치: 초기 수개월은
거의 0, 도구의 검색 유입이 누적되며 점진 상승. 단기 수익보다 **트래픽 자산 축적**이 목표.

## 현황 감사 (코드 확인 완료)
- ✅ sitemap, title/description, 정적 빌드(Astro), base 인지 링크(`import.meta.env.BASE_URL`)
- ✅ /privacy 페이지 존재
- ❌ OG/트위터 카드, JSON-LD, canonical, robots.txt, 페이지별 OG 이미지
- ❌ 애널리틱스 전무, 광고/동의 코드 전무
- ⚠️ `site: JJU09.github.io` + `base: /SoundLab` (서브패스) → AdSense 승인 난점. 도메인 전환 필요.

---

## Phase 0 · 기반 (측정 + 발견 + 도메인 트랙)

병렬 진행. 도메인은 사용자 액션, 나머지는 코드.

### 0A. SEO 메타 (코드, 저비용·고효과)
- `Base.astro` head 확장: `og:title/description/image/type/url`, `twitter:card=summary_large_image`,
  canonical, `image` prop 추가. 토픽은 frontmatter `desc`를 description으로 전달.
- JSON-LD: 사이트 전역 `WebSite`(+SearchAction), 레슨 페이지 `LearningResource`/`Course`,
  도구 페이지 `WebApplication`.
- `public/robots.txt` (sitemap 지시 포함).
- 페이지별 OG 이미지: 1차는 강한 기본 OG 1장 + 섹션별(학습/도구) 분리. 2차로
  `astro-og-canvas`(satori) 자동 생성 검토.

### 0B. 애널리틱스 (측정 없이는 판단 불가)
- GA4(무료) 또는 Umami/Plausible(프라이버시). **권장: GA4 + 동의 연동** (무료·표준).
- 이벤트: 도구 사용(시작/정답/스트릭), 레슨 진입, 난이도 전환.

### 0C. 도메인 트랙 (사용자 액션 + 코드 1줄)
- 도메인 구입(예 soundlab.kr/.app) → GitHub Pages 연결(CNAME, DNS).
- `astro.config`: `site`를 새 도메인으로, **`base` 제거**(루트 서빙). 링크는 BASE_URL 기반이라
  자동 대응. trailingSlash 유지.
- 전환 후 Search Console 등록 + sitemap 제출.

## Phase 1 · 유틸 도구 (첫 착수 — 유용 ∩ 트래픽 교집합)

새 `/tools/` 섹션(레슨과 분리된 독립 랜딩들 = SEO 진입점). 모두 AudioCore 재사용·합성음.
각 도구 = 독립 페이지 + 관련 레슨 교차링크 + 자체 위젯.

| # | 도구 | 대상 | 검색 수요 | 핵심 기술 | 비용 |
|---|------|------|----------|----------|:---:|
| 1 | **메트로놈** | 전체 | "온라인 메트로놈" 고검색 | lookahead 스케줄러(mixer.ts 패턴 재사용) | 낮음(빠른 검증) |
| 2 | **이어트레이닝 — 음정·코드 청음** | 입문·청음 | "절대음감/이어트레이닝" | SynthVoice + 게임 루프·채점·스트릭 | 중 |
| 3 | **이어트레이닝 — EQ 주파수 청음** | 프로듀싱 | "EQ 청음/frequency ear" | BiquadPeaking + 보기 선택 | 중 (믹싱 허브 연결) |
| 4 | **튜너(크로마틱)** | 악기 학습 | "온라인 튜너/기타 튜너" 초고검색 | getUserMedia + 피치검출(autocorrelation/YIN) | 높음(마이크 권한·신규 모듈) |

진행 순서 제안: **1 메트로놈(검증)** → **2 음정·코드 청음(차별화 sticky)** →
**3 EQ 청음(프로듀서 각)** → **4 튜너(최대 검색이나 최난도)**.

공통 설계:
- 게임형 도구는 스트릭·정답률·레벨을 localStorage 저장 → 재방문 유인.
- 도구별 난이도(쉬움/보통/어려움)로 스캐폴딩 톤 유지.
- 각 도구 하단에 관련 레슨 카드(예: EQ청음→[eq-masking], 음정청음→[tone]·[beats]).
- 새 모듈: `src/audio/transport.ts`(스케줄러 추출), `src/audio/pitch.ts`(튜너용 검출).
- `/tools/` 인덱스 + 네비에 "도구" 항목 추가.

## Phase 2 · 수익화 (도메인 + 트래픽 확보 후)
- AdSense 신청(콘텐츠·도메인 준비된 뒤). `public/ads.txt`.
- 동의 관리(PIPA/GDPR): Google Funding Choices(CMP) 또는 경량 자체 배너 → 동의 전 비개인화.
- 광고 배치 원칙: 위젯·게임 플레이를 **가리지 않는 곳**(콘텐츠 하단, 사이드, 도구 결과 사이).
  도구의 인터랙션 영역엔 광고 금지(UX·정책 양쪽).
- 대안: 도메인 전 임시 수익화가 필요하면 Ezoic 등 비AdSense(단가 낮음) 검토.

## Phase 3 · 재방문·확장
- 진도 추적(완료 토픽 체크·"이어서 학습") + 학습 경로 시각화.
- 사이트 검색(Pagefind 정적 검색 — Astro 친화).
- 용어집 "X란?" 랜딩(저경쟁 한국어 용어 다수 → SEO 진입점), 토픽·도구와 상호링크.
- 퀴즈 모아 "레벨 테스트/진단" 모드.

---

## 영향 파일 (착수 시)
- `src/layouts/Base.astro` — OG/JSON-LD/canonical, `image` prop
- `public/robots.txt`, `public/ads.txt`(Phase2), OG 이미지 에셋
- `astro.config.mjs` — site/base(도메인 전환 시)
- `src/pages/tools/` — 인덱스 + 도구별 페이지
- `src/components/tools/*` — 메트로놈·이어트레이닝·튜너 위젯
- `src/audio/transport.ts`(신규, 스케줄러), `src/audio/pitch.ts`(신규, 튜너)
- 네비(`Base.astro`)에 도구 섹션, GA4 스니펫

## 검증 (도구마다)
1. `npm run build` 통과(페이지 증가 확인)
2. `/tools/<slug>/` 동작 — 합성음·게임 루프·채점·localStorage
3. 오디오 로직은 OfflineAudioContext로 결정론 검증(프리뷰 탭 throttle 회피, 기존 교훈)
4. 메타: 빌드 HTML에 OG/JSON-LD/ canonical 존재, OG 이미지 URL 유효
5. 모바일 반응형(도구는 모바일 사용 비중 큼) preview_resize 확인

## 권장 첫 스텝
Phase 0A/0B(메타+GA4, 반나절) **+** Phase 1-도구1(메트로놈)을 한 번에 — 측정 토대를 깔고
첫 도구로 `/tools/` 패턴·SEO를 검증. 이후 이어트레이닝으로 차별화. 도메인은 사용자가 병행 확보.
