# SoundLab — 프로젝트 현황

> 최종 갱신: 2026-06-16 · 도메인 https://soundlab.jjuapp.com (운영 중)
> 스택: Astro + Tailwind + Web Audio API · GitHub Pages 배포 · 합성음만(제로 에셋)

## 한눈에

| 영역 | 상태 |
|------|------|
| 지식 허브 | 5개 / 토픽 **25개** |
| 유틸 도구 | **5개** (`/tools/`) |
| 샌드박스 | **5개** 전부 가동 (effects·mixing·synthesis·acoustics·digital) (`/sandbox/`) |
| 인프라 | 커스텀 도메인 · GA4 · SEO · Search Console **완료** |
| 수익화 | AdSense **미신청**(트래픽 확보 후) |

## 1. 지식 허브 (토픽 25)

| 허브 | 토픽 수 | 토픽 |
|------|:---:|------|
| acoustics (소리와 파동) | 4 | tone · beats · phase · comb |
| digital (디지털 오디오) | 4 | samplerate · bitdepth · aliasing · levels |
| synthesis (신디시스) | 5 | additive · subtractive · fm · modulation · adsr |
| effects (이펙트) | 6 | filter · drive · delay · reverb · chorus · tremolo |
| mixing (믹싱) | 6 | balance · pan · eq-masking · compressor · depth · loudness |

- 각 토픽: 3단계 스캐폴딩(easy/normal/hard, `data-level`) + 인터랙티브 위젯 + 퀴즈 + 교차링크.
- 난이도 기본값 `normal`(평균 사용자), FOUC 제거(페인트 전 저장값 적용).
- 위젯 14종: Tone·Beats·Phase·Comb·Alias·Bitcrush·SampleRate·Level·Additive·Subtractive·Fm·Modulation·Mixer·(TopicWidget 디스패처).

## 2. 유틸 도구 (`/tools/`) — Phase 1 완료

| 도구 | 핵심 기술 | 상태 |
|------|----------|:---:|
| 메트로놈 | lookahead 스케줄러(25ms/0.1s), 탭템포, 박자표 | ✅ |
| 음정·코드 청음 | 게임루프·스트릭·정답률(localStorage) | ✅ |
| EQ 주파수 청음 | 핑크노이즈 + peaking 부스트 맞히기 | ✅ |
| 크로마틱 튜너 | getUserMedia + autocorrelation 피치검출 | ✅ |
| 노이즈 제너레이터 | 화이트·핑크(Kellet)·브라운 + 타이머 | ✅ |

검증: 전 도구 OfflineAudioContext로 결정론적 확인(스펙트럼·피치·스케줄링).

## 3. 인프라 (Phase 0 완료)

- **도메인**: soundlab.jjuapp.com (Cloudflare DNS → jju09.github.io, `public/CNAME`). 향후 프로젝트는 `*.jjuapp.com` 서브도메인.
- **분석**: GA4 `G-XE8CLT7CER` (anonymize_ip), gtag.
- **SEO**: OG·트위터 카드, JSON-LD WebSite, canonical, robots.txt, sitemap, og.png(1200×630).
- **Search Console**: 도메인 속성 jjuapp.com Cloudflare 자동 인증 완료.

## 4. 최근 수정 (품질)

- 에일리어싱 위젯 음량 과다 → 출력 게인 0.5→0.22 (ZOH 계단파 고조파 보정).
- 제목·버튼 한글 폴백 결함 → 96곳 `'Space Grotesk'` 단독 지정에 Pretendard 폴백 추가(라틴 전용 폰트라 한글이 OS 기본폰트로 폴백되던 문제).

## 5. 미완료 / 대기

### 사용자 액션
- [ ] **Search Console에 sitemap 제출**: `https://soundlab.jjuapp.com/sitemap-index.xml`
- [ ] AdSense 신청 (트래픽 좀 쌓인 뒤)
- [ ] 앱 명칭 확정 — 현재 "SoundLab" 임시(SITE_NAME·헤더). J-네임 후보 검토했으나 미확정. 우산 도메인은 jjuapp.com 확정.

### Phase 2 · 수익화 (도메인+트래픽 후)
- AdSense + `public/ads.txt`, 동의 관리(CMP), 위젯 안 가리는 광고 배치.

### Phase 3 · 재방문·확장 (미착수)
- 진도 추적("이어서 학습"), 사이트 검색(Pagefind), 용어집 "X란?" 랜딩(저경쟁 한국어 SEO), 레벨 테스트 모드.

### 도구 후보 (추가 시)
- 톤 제너레이터 + 청력 테스트, BPM→딜레이 계산기, apex jjuapp.com 허브 랜딩.

## 참고 문서
- `.claude/plan-growth-monetization.md` — 성장·수익화 원안
- `.claude/plan-curriculum-expansion.md` — 커리큘럼 확장 원안
- `.claude/plan-mixing-hub.md`, `.claude/plan-modular-pedalboard.md`
