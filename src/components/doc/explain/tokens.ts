// 설명 그림(Explain) 디자인 토큰 v2 — "검사할 수 있는 규칙".
// scripts/fig-qa.mjs 가 렌더된 SVG에서 아래 값만 쓰였는지 확인한다. 새 값이 필요하면 여기 먼저 추가할 것.
//
// 색은 두 계층:
//   ① 영역 색: 비유 칸(따뜻한 바탕) / 원리 칸(흰 바탕+격자) — 모든 그림에서 고정.
//   ② 개념 색: 칸 안 요소의 색 — 개념의 의미에 맞게 고른다(예: 화성 기능 FN, 신호 처리 TECH).
//
// 형태 규칙(부품 parts/ 가 계산으로 보장한다):
//   · 닿는 것은 정확히 닿는다(공–언덕, 사람–바닥, 문–기준선) → geo.ts 의 onCurve/tangent 계산 사용.
//   · 떨어지는 것은 GAP.min 이상 떨어진다 — 1~3 단위로 애매하게 붙지 않는다.
//   · 라벨은 할로(흰/바탕색 테두리)를 두르고, 지시선은 곡선을 가로지르지 않는다.
//   · 반투명 채우기를 겹치지 않는다 — 채우기는 한 겹, 미리 섞은 불투명 색(FILL)을 쓴다.
//   · 그래프의 선은 3개 이하를 기본으로 권장. 더 필요하면 굵기·색 위계로 주/보조를 나눈다(절대 규칙 아님).
//   · "이전 상태" 유령선은 바뀐 구간에만 그린다(변하지 않은 구간에서 새 선과 겹치지 않게).
//   · 비유 그림의 표현(곡선·복합 경로·그라데이션)은 자유. 공통으로 묶는 것은 선 굵기·글자·색·화살표·라벨·캐릭터 기본형뿐.

export const INK = { ink: '#2d2d4a', sub: '#6b6b8e', faint: '#a0a0c0', line: '#e2e2f0', grid: '#f1f2f8' };

// ① 비유 영역 — 따뜻한 배경 위 일러스트. 외곽선은 둥근 잉크선(STROKE.base).
export const META = {
  bg: '#fff8ee', border: '#f3dfc2', chip: '#b45309',
  outline: '#3d3550', sun: '#f6b94a', coral: '#ee7b5b', sky: '#9cc7f2', leaf: '#7cc99a', sand: '#f3e1c7', cream: '#fffdf8',
  shade: '#e9d8bf',    // 바닥 그림자·땅
  motion: '#ea580c',   // 움직임 화살표
};

// ② 실제 원리 영역 — 흰 배경 + 옅은 격자.
export const TECH = {
  bg: '#ffffff', border: '#e2e2f0', chip: '#2563eb',
  input: '#2563eb',    // 입력·원래 신호
  output: '#7c3aed',   // 처리 후·출력 신호
  limit: '#dc2626',    // 기준선·경계·한계(점선)
  change: '#ea580c',   // 바뀐 양(줄어든·늘어난 부분, 빗금)
  axis: '#a0a0c0',
};

// 반투명 대신 쓰는 불투명 연한 채우기(흰 바탕에 미리 섞은 색). 겹칠 일이 있으면 위쪽 것만 칠한다.
export const FILL = {
  input: '#dfe8fd', output: '#ebe2fd', limit: '#fde2e2', change: '#fde6d6', mel: '#fcebcf',
  T: '#d6f2df', S: '#dbe6fd', D: '#fbdcdc',
};

// 화성 기능 등 사이트 공통 의미색
export const FN = { T: '#16a34a', S: '#2563eb', D: '#dc2626', B: '#9333ea', X: '#ea580c' };

// 선 굵기 3단 (viewBox 단위, 칸당 320 좌표 기준)
export const STROKE = { hair: 1, base: 2, bold: 3 } as const;
// 점선 3종: 기준선(threshold·경계) / 이전 상태(유령선) / 걸어온 길(둥근 점)
export const DASH = { ref: '6 4', prev: '2 3', trail: '0 6' } as const;
// 글자 4단: 큰 말(비유 속 대사) / 제목 / 라벨 / 주석·눈금
export const TYPE = { display: 16, title: 13, label: 11, note: 10 } as const;
// 간격: 요소 사이 최소 거리, 라벨–선 최소 거리
export const GAP = { min: 4, label: 3 } as const;

// QA 스크립트가 허용하는 값 목록
export const ALLOWED = {
  stroke: Object.values(STROKE).map(String),
  dash: Object.values(DASH) as string[],
  font: Object.values(TYPE).map(String),
};
