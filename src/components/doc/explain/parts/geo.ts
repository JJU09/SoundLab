// 설명 그림용 기하 도우미 — "눈대중 좌표" 대신 계산으로 접점·간격·곡선을 보장한다.
export type Pt = [number, number];

const f1 = (n: number) => Math.round(n * 10) / 10;
export const P = ([x, y]: Pt) => `${f1(x)},${f1(y)}`;

// 점들을 지나는 부드러운 곡선(Catmull-Rom → 3차 베지어). 꺾임 없는 매끈한 선.
export function smooth(pts: Pt[], t = 1): string {
  if (pts.length < 2) return '';
  let d = `M${P(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6 * t, p1[1] + (p2[1] - p0[1]) / 6 * t];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6 * t, p2[1] - (p3[1] - p1[1]) / 6 * t];
    d += ` C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return d;
}

// y = f(x) 를 x0~x1 구간에서 n등분 표본 → 점 배열
export const sample = (f: (x: number) => number, x0: number, x1: number, n = 48): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => { const x = x0 + (x1 - x0) * i / n; return [x, f(x)] as Pt; });

// 함수 곡선 경로 / 바닥까지 닫힌 면 경로
export const fnPath = (f: (x: number) => number, x0: number, x1: number, n = 48) => smooth(sample(f, x0, x1, n));
export const fnArea = (f: (x: number) => number, x0: number, x1: number, base: number, n = 48) =>
  `${fnPath(f, x0, x1, n)} L${f1(x1)},${f1(base)} L${f1(x0)},${f1(base)} Z`;
// 두 곡선 사이 면(위 f, 아래 g) — "깎인 양" 같은 차이 영역
export function between(f: (x: number) => number, g: (x: number) => number, x0: number, x1: number, n = 32) {
  const top = sample(f, x0, x1, n), bot = sample(g, x0, x1, n).reverse();
  const bs = smooth(bot);
  return `${smooth(top)} L${P(bot[0])} ${bs.slice(bs.indexOf('C'))} Z`;
}

// 곡선 위 점에서의 기울기 각(라디안)과 바깥쪽(위쪽) 법선
export function tangent(f: (x: number) => number, x: number, h = 0.5) {
  const dy = (f(x + h) - f(x - h)) / (2 * h);
  const len = Math.hypot(1, dy);
  return { ang: Math.atan2(dy, 1), nx: dy / len, ny: -1 / len }; // SVG(y 아래로) 기준 위쪽 법선
}
// 반지름 r 인 원이 곡선 y=f(x) 위 x 지점에 "정확히 닿아" 올라앉는 중심
export function restOn(f: (x: number) => number, x: number, r: number): Pt {
  const { nx, ny } = tangent(f, x);
  return [x + nx * r, f(x) + ny * r];
}

// 부드러운 최댓값 — max() 로 두 봉우리를 합칠 때 생기는 뾰족한 골을 없앤다
export const smax = (a: number, b: number, k = 24) => Math.log(Math.exp(k * a) + Math.exp(k * b)) / k;
export const gauss = (d: number, s: number) => Math.exp(-(d * d) / (2 * s * s));

// 선을 끝에서 len 만큼 줄인 점 (화살촉·간격용)
export function pull(from: Pt, to: Pt, len: number): Pt {
  const dx = to[0] - from[0], dy = to[1] - from[1], L = Math.hypot(dx, dy) || 1;
  return [to[0] - dx / L * len, to[1] - dy / L * len];
}

// 화살촉(끝점 tip, 방향 ang) — 마커 대신 직접 그려 id 충돌·크기 불일치가 없다
export function head(tip: Pt, ang: number, size = 7): string {
  const w = size * 0.62;
  const bx = tip[0] - Math.cos(ang) * size, by = tip[1] - Math.sin(ang) * size;
  const px = -Math.sin(ang) * w, py = Math.cos(ang) * w;
  return `${P(tip)} ${P([bx + px, by + py])} ${P([bx - px, by - py])}`;
}

// 2차 곡선 화살표 경로 점들(from→to, bend: 옆으로 휘는 정도, +면 진행 방향 왼쪽)
export function arc(from: Pt, to: Pt, bend = 0, n = 16): Pt[] {
  const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2;
  const dx = to[0] - from[0], dy = to[1] - from[1], L = Math.hypot(dx, dy) || 1;
  const c: Pt = [mx + (dy / L) * bend, my - (dx / L) * bend];
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, u = 1 - t;
    return [u * u * from[0] + 2 * u * t * c[0] + t * t * to[0], u * u * from[1] + 2 * u * t * c[1] + t * t * to[1]] as Pt;
  });
}

// 말풍선 — 몸통(타원)과 꼬리를 "한 경로"로: 이음새 없이 한 번에 칠하고 그린다
export function bubble(cx: number, cy: number, rx: number, ry: number, tail: Pt, spread = 0.32): string {
  const th = Math.atan2((tail[1] - cy) / ry, (tail[0] - cx) / rx);
  const a1 = th - spread, a2 = th + spread;
  const p1: Pt = [cx + rx * Math.cos(a1), cy + ry * Math.sin(a1)];
  const p2: Pt = [cx + rx * Math.cos(a2), cy + ry * Math.sin(a2)];
  return `M${P(p2)} A${rx},${ry} 0 1 1 ${P(p1)} Q${P([(p1[0] * 2 + tail[0]) / 3, (p1[1] * 2 + tail[1]) / 3])} ${P(tail)} Q${P([(p2[0] * 2 + tail[0]) / 3, (p2[1] * 2 + tail[1]) / 3])} ${P(p2)} Z`;
}

// 둥근 캐릭터 몸(캡슐) — 아래가 정확히 바닥 floor 에 닿는다
export function capsule(cx: number, floor: number, w: number, h: number): string {
  const r = w / 2, top = floor - h;
  return `M${f1(cx - r)},${f1(floor - r)} V${f1(top + r)} A${r},${r} 0 0 1 ${f1(cx + r)},${f1(top + r)} V${f1(floor - r)} A${r},${r} 0 0 1 ${f1(cx - r)},${f1(floor - r)} Z`;
}
