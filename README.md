# 🎛️ SoundLab (사운드랩)

> **Web Audio API로 듣고 만지며 배우는 인터랙티브 사운드·음악 학습 사이트**
>
> 소리를 글로만 읽는 대신 **직접 연주하고, 조립하고, 만지며** 음악과 오디오의 원리를 익힙니다. 모든 소리는 브라우저 안에서 실시간 합성되며(오디오 파일 0개), 설치도 회원가입도 없습니다.

<br />

## 🌐 Live Demo
👉 **[soundlab.jjuapp.com](https://soundlab.jjuapp.com/)**
* *무설치 · 무료 · 회원가입 없음 · 모바일 최적화 (헤드폰 착용 권장)*

<br />

## ✨ 무엇이 있나요 (Features)

SoundLab은 네 개의 기둥으로 구성됩니다.

### 📚 지식 허브 — 5개 허브 · 25개 레슨
소리와 파동 · 디지털오디오 · 신디시스 · 이펙트 · 믹싱. 각 개념마다 **실시간으로 조작하는 인터랙티브 위젯**(14종)을 붙여, 슬라이더를 움직이면 파형·스펙트럼·소리가 즉시 반응합니다.

### 🧪 샌드박스 — 5개
규칙 없이 자유롭게 실험하는 놀이터.
* **파동 실험실** — 파형·배음을 직접 쌓아 소리 만들기
* **로파이 실험실** — 샘플레이트·비트뎁스를 낮춰 디지털 열화 체감
* **신디사이저** — 오실레이터·필터·ADSR·LFO + 건반 연주 (터치 글리산도·멀티터치)
* **모듈러 페달보드** — 이펙터를 자유롭게 꺼내 직렬 체인 조립
* **미니 믹서** — 3트랙을 페이더·팬·EQ·컴프레서로 믹싱

### 🛠️ 연습 도구 — 10개
* **누구나** — 메트로놈 · 크로마틱 튜너 · 음정/코드 청음 · 노이즈(비·파도·바람·집중 앰비언트) · 톤 제너레이터
* **프로듀싱·믹싱** — BPM 딜레이 계산기 · 데시벨(dB) 계산기 · 노트↔주파수 변환기 · 주파수↔파장 계산기 · EQ 주파수 청음

### 📖 용어집 — 37개
"이게 무슨 뜻이지?" 싶은 오디오 용어를 **한 줄 정의 + 라이브 데모**로. 본문 인라인 링크로 레슨·도구와 연결됩니다.

<br />

### 기술적 하이라이트
* **제로 에셋(Zero-Asset):** 모든 소리는 OscillatorNode·노이즈 버퍼·DSP로 런타임 합성. 다운로드되는 오디오 파일이 없습니다.
* **무클릭 안티-팝 재배선:** 재생 중 이펙트 체인 순서를 바꾸거나 모듈을 탈착해도 10ms 페이드 램프로 팝 노이즈를 차단.
* **상태 직렬화·공유:** 페달보드 구성을 URL로 압축해 링크 공유 — 구버전 포맷도 마이그레이션 복원.
* **이펙터별 맞춤 시각화:** Filter(스펙트럼+캔버스 드래그로 Cutoff·Q 동시 조작), Drive(클리핑 줌), Chorus(잔상 앙상블), Delay·Reverb(엔벨로프 스크롤).
* **모바일 우선:** 햄버거 네비, 터치 연주(`pointer`+`touch-action`), 24px 슬라이더 히트영역, 한글 어절 줄바꿈.
* **SEO·구조화 데이터:** 페이지별 메타·canonical·OG, BreadcrumbList·DefinedTerm JSON-LD, sitemap.

<br />

## 🏗️ 아키텍처

### 공유 오디오 그래프 (`AudioCore`)
모든 사운드 모듈은 하나의 코어 그래프를 공유합니다.
```text
[Source / Engine] ➔ core.input ➔ Master Gain ➔ Analyser ➔ Audio Destination
                                                    └─➔ (Canvas 2D 실시간 시각화)
```

### 무재배선 Bypass 셸 (이펙트 샌드박스)
런타임에 노드를 끊지 않고 클릭 노이즈 없는 바이패스를 구현하기 위해, 모든 이펙트 인스턴스는 동일한 Dry/Wet 셸로 래핑됩니다.
```text
input ─┬─➔ dryGain (Bypass 시 1, Active 시 0) ──────────────────┐
       └─➔ [Effect Nodes] ➔ wetGain (Bypass 시 0, Active 시 Mix) ┴─➔ output
```

### 콘텐츠 시스템
* 레슨·용어집은 **Astro Content Collections**(`topics`, `glossary`)로 관리되는 MDX 문서.
* 허브/샌드박스 메타데이터는 `content.config.ts`에 중앙화(`HUBS`, `HUB_META`, `SANDBOX_OF`).

<br />

## 🛠️ Tech Stack

| 영역 | 사용 기술 |
|---|---|
| **Audio** | Web Audio API (순수 브라우저 합성·DSP) |
| **Graphics** | Canvas 2D (`requestAnimationFrame` 기반) |
| **Framework** | Astro (정적 생성) + Content Collections (MDX) |
| **Language** | Vanilla TypeScript (프레임워크 런타임 없음) |
| **Styling** | Tailwind CSS v4 |
| **분석/배포** | GA4 · GitHub Pages · `astro check` CI 게이트 |

<br />

## 📂 프로젝트 구조

```text
src/
├── audio/        # 오디오 엔진 (core, synth, effects, mixer, pedalboard …)
├── components/   # 인터랙티브 위젯 (*Widget.astro) · UI 컴포넌트
├── content/      # 레슨(topics) · 용어집(glossary) MDX
├── layouts/      # Base · TopicLayout · GlossaryLayout
├── pages/        # learn/ · sandbox/ · tools/ · glossary/ 라우트
└── styles/       # global.css (디자인 토큰 · 슬라이더 · 타이포)
```

<br />

## 📦 Getting Started (로컬 실행)

Node.js 22 이상이 필요합니다.

```bash
# 1. 클론
git clone https://github.com/jju09/SoundLab.git
cd SoundLab

# 2. 의존성 설치
npm install

# 3. 개발 서버 (localhost:4321)
npm run dev

# 4. 타입 체크 + 프로덕션 빌드
npm run check
npm run build
```

<br />

## 🗺️ Roadmap

* ✅ **지식 허브 5종 · 인터랙티브 위젯** — 음향학·디지털 오디오·신디시스·이펙트·믹싱
* ✅ **허브별 샌드박스 5종** — 파동·로파이·신스·페달보드·믹서
* ✅ **연습 도구 10종** — 메트로놈·튜너·청음부터 BPM/dB/파장 계산기까지
* ✅ **용어집 37종 + SEO·모바일 최적화**
* ⏳ 계산기·도구 시리즈 확장, 임베드 위젯, 콘텐츠(롱테일) 확장

<br />

## 📄 License

Copyright (c) 2026 jju09. All rights reserved.

본 프로젝트의 소스코드는 교육 및 학업 참조 목적으로 퍼블릭 공개되어 있으나, 저작권물의 보호를 위해 **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** 라이선스를 엄격히 적용합니다.
저작권자의 서면 동의 없는 **무단 복제 배포, 상업적 웹사이트 미러링 및 구글 애드센스 등을 포함한 모든 영리 목적의 호스팅 및 배포 행위를 절대 금지**합니다.
