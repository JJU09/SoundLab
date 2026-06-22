# AdSense 준비 체크리스트

승인 후 **코드 한 곳만 채우면** 광고가 켜지도록 사전 정비해 둔 상태.

## 코드에서 끝낸 것 (배포 시 반영됨)
- [x] 개인정보처리방침에 광고 쿠키·제3자 공급업체 고지 보강 (`src/pages/privacy.astro`)
- [x] 소개(About) 페이지 + 푸터 링크 — 사이트 정체성 명시 (`src/pages/about.astro`)
- [x] 모바일 최적화 (네비·터치·타이포) — 승인 심사에 유리
- [x] `public/ads.txt` 자리표시자(주석) 준비
- [x] 게이트된 활성화 스캐폴드: `src/ads.config.ts`, `src/components/AdUnit.astro`,
      Base 헤드의 검증 메타+스크립트, 토픽·용어집 하단 광고 자리
- [x] **현재 ADSENSE_ID 비어 있음 → 광고 코드가 전혀 출력되지 않음** (승인 전 안전)

## 내(사용자)가 직접 해야 하는 것
1. **신청**: https://adsense.google.com → 사이트 `soundlab.jjuapp.com` 추가
2. **게시자 ID 확보**: `ca-pub-XXXXXXXXXXXXXXXX`
3. **사이트 검증 활성화**:
   - `src/ads.config.ts` 의 `ADSENSE_ID = ''` → 본인 ID 입력
   - commit → push → 배포 완료 후 AdSense에서 "확인" 클릭
   - (이 시점부터 헤드에 adsbygoogle 스크립트 + 검증 메타가 출력됨)
4. **검토 대기**: 수일~수주. 사이트는 정상 운영 유지.
5. **승인 후 광고 켜기**:
   - AdSense → 광고 → 광고 단위 만들기(디스플레이/반응형) → **슬롯 ID** 복사
   - `src/ads.config.ts` 의 `AD_SLOTS.content` 에 슬롯 ID 입력
   - 토픽·용어집 하단에 광고가 자동 표시됨 (`AdUnit` 게이트 해제)
6. **ads.txt 갱신**: `public/ads.txt` 의 마지막 줄 주석(#) 해제 + 본인 pub-ID로 교체
7. (선택) GA4 ↔ AdSense 연결, `page_path` 맞춤 측정기준 등록(기존 보류 항목)

## 정책 주의
- 본인 광고 클릭 금지 / 클릭 유도 문구 금지
- 광고는 콘텐츠와 명확히 구분 (AdUnit에 "Advertisement" 라벨 포함됨)
- 페이지당 콘텐츠 분량 충분히 유지 (현재 토픽·용어집·도구로 충족)

## 배치 조정 메모
- 추가 광고 위치가 필요하면 원하는 페이지에서 `<AdUnit slot="content" />` 호출.
  새 슬롯을 분리하려면 `AD_SLOTS` 에 키를 추가하고 슬롯 ID를 넣은 뒤 `<AdUnit slot="새키" />`.
