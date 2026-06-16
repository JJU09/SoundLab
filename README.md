# 🎛️ SoundLab (사운드랩)

> **Web Audio API로 배우는 사운드 이펙트 실습 플레이그라운드**
> 
> 사용자가 직접 가상의 페달보드를 드래그하여 조립하고, 노브를 조작함에 따라 소리와 파형·주파수가 실시간으로 동기화되어 변하는 것을 보며 사운드 엔지니어링의 원리를 주도적으로 학습하는 인터랙티브 교육용 웹 애플리케이션입니다.

<br />

## 🌐 Live Demo
👉 **[SoundLab 웹사이트 바로가기](https://soundlab.jjuapp.com/)**
* *회원가입이나 앱 설치 없이 브라우저에서 즉시 실행 가능합니다. (헤드폰 착용 권장)*

<br />

## ✨ Key Features (핵심 기능)

* **동적 모듈러 페달보드 (Modular Sandbox):** 고정된 이펙터 구조에서 벗어나 사용자가 원하는 이펙터를 원하는 순서대로 무한히 생성하고 직렬 신호 체인을 커스텀 빌드할 수 있습니다. 카드의 배치 순서가 실시간으로 오디오 신호 흐름에 반영됩니다.
* **이펙터별 맞춤형 실시간 시각화 (DSP Visualizer):**
  * **Filter:** 스펙트럼 스케일 뷰 제공, 캔버스 드래그를 통해 가로축(Cutoff 주파수)과 세로축(Q값)을 직관적으로 동시 조작 가능.
  * **Drive:** 파형 꼭대기가 수평으로 깎여 나가는 '클리핑(Clipping)' 현상을 관찰할 수 있도록 밀착 줌 렌더링 지원.
  * **Chorus:** 인광 잔상 효과(Persistence)를 활용하여 피치 변조로 인해 파형들이 출렁이며 겹치는 앙상블감을 가시화.
  * **Delay & Reverb:** 링버퍼 기반 시간 흐름 엔벨로프 스크롤 뷰를 장착하여 메아리와 잔향의 감쇠 꼬리 궤적을 긴 흐름으로 추적.
* **무클릭 안티-팝(Anti-Pop) 오디오 재배선:** 재생 중에 체인의 순서를 바꾸거나 모듈을 탈착해도 전기 플러그를 뺐다 꽂을 때 발생하는 지르르한 팝 노이즈를 10ms 안티-팝 페이드 램프 알고리즘으로 완벽 차단했습니다.
* **상태 직렬화 및 공유:** 현재 조립된 나만의 페달보드 전체 상태와 노브 설정을 Base64 스트링 URL로 압축하여 링크로 복사·공유할 수 있으며, 구버전 포맷 유입 시에도 호환 레이어를 통해 자동 마이그레이션 복원됩니다.
* **개념 레슨 및 인터랙티브 퀴즈:** 각 이펙터별 본질을 관찰할 수 있는 추천 오디오 소스(지속음, 플럭, 노이즈)와 실습 가이드라인을 내장하고 있으며, 하단에 객관식 이해도 확인 퀴즈 피드백 시스템을 갖추고 있습니다.

<br />

## 🏗️ Signal Chain & Architecture (신호 체인 구조)

### 오디오 신호 그래프 파이프라인
```text
[Source (Tone/Pluck/Noise)] ➔ [chainIn Node] ➔ (동적 인스턴스 배열 순회 연동) ➔ [Master Gain] ➔ [Analyser] ➔ [Audio Destination]
```

### 무재배선 Bypass 구현을 위한 Dry/Wet 셸(Shell) 구조
이펙터 노드를 런타임에서 매번 끊지 않고 클릭 노이즈 없는 바이패스를 구현하기 위해 모든 인스턴스는 동일한 셸 게인 구조로 래핑되어 처리됩니다.
```text
input ─┬─➔ dryGain (Bypass 시 1, Active 시 0) ───────────────┐
       └─➔ [Effect Nodes] ➔ wetGain (Bypass 시 0, Active 시 Mix) ┴─➔ output
```

<br />

## 🛠️ Tech Stack (기술 스택)

* **Audio Engine:** Web Audio API (순수 브라우저 오디오 컨텍스트 처리)
* **Graphics:** Canvas 2D (`requestAnimationFrame` 기반 하드웨어 가속 최적화 렌더링)
* **Framework:** Astro Framework (정적 지식 콘텐츠 문서 확장성 및 고성능을 위한 스택)
* **Styling & Components:** Tailwind CSS v4 / Vanilla TypeScript

<br />

## 📦 Getting Started (로컬 실행 방법)

로컬 환경에서 프로젝트를 실행하고 개발 환경을 구축하려면 아래 명령어를 terminal에서 실행하세요. Node.js 22 버전 이상이 필요합니다.

```bash
# 1. 원본 소스코드 클론
git clone https://github.com/jju09/SoundLab.git
cd SoundLab

# 2. 의존성 패키지 설치
npm install

# 3. 로컬 개발 서버 실행 (기본 포트: localhost:4321)
npm run dev

# 4. 프로덕션 빌드 테스트 및 배포 파일 컴파일
npm run build
```

<br />

## 🗺️ Future Roadmap (향후 개발 계획)

* **Phase 2 (음향학 & 디지털 오디오 이론 지식 허브):**
  * 소리의 3요소 인터랙티브 가이드 및 위상 간섭/상쇄(Phase Cancellation) 물리 시뮬레이터 구축.
  * 샘플링 레이트 다운에 따른 에일리어싱(Aliasing) 잡음 및 비트뎁스 하락에 따른 양자화 노이즈 체감 코너 신설.
* **Phase 3 (신스 사운드 디자인 및 심화 엔지니어링):**
  * 감산 합성(Subtractive Synthesis) 신디사이저 개념 및 마우스 드래그형 ADSR 엔벨로프 위젯 연동.
  * 프로 오디오 컴프레서(Compressor) 게인 감소 시각화 및 악기 간 주파수 충돌을 방지하는 EQ 믹싱 가상 부스 개설.
  * Astro 콘텐츠 컬렉션(Content Collections) 아키텍처를 도입하여 다량의 이론 학습 마크다운 문서 시스템 정립.

<br />

## 📄 License

Copyright (c) 2026 jju09. All rights reserved.

본 프로젝트의 소스코드는 교육 및 학업 참조 목적으로 퍼블릭 공개되어 있으나, 저작권물의 보호를 위해 **Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)** 라이선스를 엄격히 적용합니다.
저작권자의 서면 동의 없는 **무단 복제 배포, 상업적 웹사이트 미러링 및 구글 애드센스 등을 포함한 모든 영리 목적의 호스팅 및 배포 행위를 절대 금지**합니다. 