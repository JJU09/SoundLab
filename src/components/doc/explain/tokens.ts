// 설명 그림(Explain) 디자인 토큰 — 색은 두 계층으로 관리한다.
//   ① 영역 색: 비유 칸(따뜻한 바탕) / 원리 칸(흰 바탕+격자) — 모든 그림에서 고정.
//   ② 개념 색: 그 칸 안의 요소 색 — 개념의 의미에 맞게 고른다(예: 화성 기능 FN, 신호 처리 TECH).
// SVG 속성에 직접 쓰는 값(사이트 CSS 변수와 같은 색 계열).
export const INK = { ink: '#2d2d4a', sub: '#6b6b8e', faint: '#a0a0c0', line: '#e2e2f0', grid: '#f1f2f8' };

// ① 비유 영역 — 따뜻한 배경 위 플랫 일러스트. 외곽선은 둥근 2px 잉크.
export const META = {
  bg: '#fff8ee', border: '#f3dfc2', chip: '#b45309',
  outline: '#3d3550', sun: '#f6b94a', coral: '#ee7b5b', sky: '#9cc7f2', leaf: '#7cc99a', sand: '#f3e1c7', cream: '#fffdf8',
  motion: '#ea580c',   // 움직임 화살표(곡선, 2.5px)
};

// ② 실제 원리 영역 — 흰 배경 + 옅은 격자, 가는 선과 단위가 붙은 축.
export const TECH = {
  bg: '#ffffff', border: '#e2e2f0', chip: '#2563eb',
  input: '#2563eb',    // 입력·원래 신호
  output: '#7c3aed',   // 처리 후·출력 신호
  limit: '#dc2626',    // 기준선·경계·한계(점선)
  change: '#ea580c',   // 바뀐 양(줄어든·늘어난 부분, 빗금)
  axis: '#a0a0c0',
};

// 화성 기능 등 사이트 공통 의미색
export const FN = { T: '#16a34a', S: '#2563eb', D: '#dc2626', B: '#9333ea', X: '#ea580c' };

// 글자 위계 (그려지는 크기 기준, px)
export const TYPE = { label: 13, note: 11, unit: 11, big: 16 };
