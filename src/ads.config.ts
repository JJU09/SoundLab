// Google AdSense 설정 — 승인 후 ID 한 줄만 채우면 광고가 자동 활성화됩니다.
//
// 활성화 절차:
//  1) AdSense 승인 → 게시자 ID(ca-pub-XXXXXXXXXXXXXXXX)를 ADSENSE_ID에 입력
//  2) public/ads.txt 의 자리표시자 주석을 해제하고 같은 pub-ID로 교체
//  3) AdSense 대시보드에서 '광고 단위'를 만들고 슬롯 ID를 AD_SLOTS 에 입력
//     (슬롯이 비어 있으면 해당 위치 광고는 출력되지 않습니다)
//
// ADSENSE_ID 가 비어 있으면 광고 스크립트·검증 메타·광고 태그가 전혀 출력되지
// 않습니다(= 현재 상태). 승인 전까지 사이트에 어떤 광고 코드도 노출되지 않습니다.
export const ADSENSE_ID = '';

// 광고 단위 슬롯 ID (AdSense → 광고 → 광고 단위 기준)
export const AD_SLOTS = {
  content: '', // 본문 하단(토픽·용어집) 반응형 디스플레이
} as const;

export type AdSlot = keyof typeof AD_SLOTS;
