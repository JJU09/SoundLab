// 코드 진행 지도 — 근음이 5도권(음의 원) 위에서 움직이는 길과, 지금 울리는 코드의 모양.
// 조·코드의 원(circleSvg)은 단조 코드를 나란한 장조 자리에 두어서 ii–V–I가 "반시계 세 칸"으로 보이지 않는다.
// 이 지도는 12음 한 줄짜리 원을 쓰고, 근음의 움직임만 화살표로 그린다.
import { chordInfo, PALETTE, type ChordInfo, type Song } from './sketch';

export type Mode = Song['mode'];
export interface Prog { id: string; name: string; mode: Mode; chords: string[]; desc: string; group: string; }

// 이름 있는 진행. desc는 화면 문구(해요체), 사실 먼저.
export const PROGS: Prog[] = [
  { id: 'pop', group: '기본', mode: 'major', name: 'I–V–vi–IV', chords: ['I', 'V', 'vi', 'IV'], desc: '팝에서 가장 흔한 진행이에요.' },
  { id: 'basic', group: '기본', mode: 'major', name: 'I–IV–V–I', chords: ['I', 'IV', 'V', 'I'], desc: '주요 3화음만 써요. 붙어 있는 세 칸 안에서만 움직여요.' },
  { id: 'fifties', group: '기본', mode: 'major', name: 'I–vi–IV–V', chords: ['I', 'vi', 'IV', 'V'], desc: '50년대 팝에서 많이 쓴 진행이에요.' },
  { id: 'sad', group: '기본', mode: 'major', name: 'vi–IV–I–V', chords: ['vi', 'IV', 'I', 'V'], desc: 'vi로 시작해서 같은 코드로도 차분하게 들려요.' },
  { id: 'canon', group: '발라드', mode: 'major', name: '캐논 진행', chords: ['I', 'V', 'vi', 'iii', 'IV', 'I', 'IV', 'V'], desc: '파헬벨 「캐논」의 진행이에요. 발라드에서 많이 써요.' },
  { id: 'royal', group: '발라드', mode: 'major', name: '로열로드', chords: ['IVmaj7', 'V7', 'iii7', 'vi7'], desc: 'IV에서 시작해 vi로 가요. J-pop과 K-pop 발라드에서 자주 들려요.' },
  { id: 'sec', group: '발라드', mode: 'major', name: 'I–V7/vi–vi–IV', chords: ['I', 'V7/vi', 'vi', 'IV'], desc: 'vi 앞에 vi의 딸림화음을 넣어서 vi가 또렷하게 들려요.' },
  { id: 'borrow', group: '발라드', mode: 'major', name: 'I–IV–iv–I', chords: ['I', 'IV', 'iv', 'I'], desc: 'IV를 단조로 바꾸면 아련하게 들려요.' },
  { id: 'jazz', group: '재즈', mode: 'major', name: 'ii–V–I', chords: ['ii7', 'V7', 'Imaj7', 'Imaj7'], desc: '재즈의 기본 진행이에요.' },
  { id: 'chain', group: '재즈', mode: 'major', name: 'vi–ii–V–I', chords: ['vi7', 'ii7', 'V7', 'Imaj7'], desc: '근음이 5도씩 세 번 내려와 I에 닿아요.' },
  { id: 'epic', group: '록·영화', mode: 'major', name: 'I–♭VI–♭VII–I', chords: ['I', '♭VI', '♭VII', 'I'], desc: '단조에서 빌린 두 코드를 지나 웅장하게 돌아와요.' },
  { id: 'mpop', group: '단조', mode: 'minor', name: 'i–♭VI–♭III–♭VII', chords: ['i', '♭VI', '♭III', '♭VII'], desc: '단조 팝에서 흔한 진행이에요.' },
  { id: 'mfall', group: '단조', mode: 'minor', name: 'i–iv–♭VII–♭III', chords: ['i', 'iv', '♭VII', '♭III'], desc: '근음이 5도씩 내려가요.' },
  { id: 'mstrong', group: '단조', mode: 'minor', name: 'i–♭VI–iv–V', chords: ['i', '♭VI', 'iv', 'V'], desc: '마지막 V가 i로 강하게 끌어당겨요.' },
  { id: 'mrock', group: '록·영화', mode: 'minor', name: 'i–♭VII–♭VI–♭VII', chords: ['i', '♭VII', '♭VI', '♭VII'], desc: '록과 영화 음악에서 많이 써요.' },
];
export const MAX_CHORDS = 8;
export const palette = (mode: Mode) => PALETTE[mode].flat();

// ── 원 위의 자리 ──
export const posOf = (pc: number) => (pc * 7) % 12;               // 음 pc → 칸(0 = 12시, 시계 방향 = 5도 위)
export const pcAt = (pos: number) => (pos * 7) % 12;
const NOTE = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

// 근음이 움직인 칸 수. +는 시계 방향(5도 위), −는 반시계 방향(5도 아래). 맞은편(6)은 +6.
export const stepsBetween = (a: number, b: number) => { const d = (posOf(b) - posOf(a) + 12) % 12; return d > 6 ? d - 12 : d; };

export interface Move { from: ChordInfo; to: ChordInfo; steps: number; shared: number; text: string; }
const NUM = ['', '한', '두', '세', '네', '다섯', '여섯'];
export function describe(a: ChordInfo, b: ChordInfo): Move {
  const steps = stepsBetween(a.rootPc, b.rootPc);
  const shared = a.pcs.filter(p => b.pcs.includes(p)).length;
  const n = Math.abs(steps), dir = steps > 0 ? '시계 방향' : '반시계 방향';
  let text: string;
  if (n === 0) text = a.type === b.type ? '같은 코드를 한 번 더 울려요.' : '근음은 그대로 두고 코드의 성질만 바꿔요.';
  else if (steps === -1) text = '반시계 방향으로 한 칸 가요. 근음이 5도 내려가는 움직임이라 가장 자연스럽게 풀려요.';
  else if (steps === 1) text = '시계 방향으로 한 칸 가요. 근음이 5도 올라가서 부드럽게 떠나는 느낌이 들어요.';
  else if (n === 2) text = `${dir}으로 두 칸 가요. 한 칸을 건너뛰어서 움직임이 또렷하게 들려요.`;
  else if (n <= 4) text = `${dir}으로 ${NUM[n]} 칸 가요. ` + (shared >= 2 ? `멀리 가지만 두 코드가 음 ${shared}개를 같이 써서 부드럽게 이어져요.` : '같이 쓰는 음이 적어서 색이 바뀌는 게 들려요.');
  else if (n === 5) text = `${dir}으로 다섯 칸 가요. 거의 맞은편이라 색이 크게 바뀌어요.`;
  else text = '맞은편 칸으로 가요. 원에서 가장 먼 움직임이에요.';
  return { from: a, to: b, steps, shared, text };
}

// 진행 전체를 한두 문장으로. 마지막 코드에서 첫 코드로 돌아오는 움직임까지 센다.
export function summarize(moves: Move[]) {
  const real = moves.filter(m => m.steps !== 0);
  if (!real.length) return '근음이 움직이지 않는 진행이에요.';
  const ccw = real.filter(m => m.steps < 0).length, cw = real.length - ccw;
  const fifthsDown = real.filter(m => m.steps === -1).length;
  const far = real.filter(m => Math.abs(m.steps) >= 5).length;
  let s = `근음이 반시계 방향으로 ${ccw}번, 시계 방향으로 ${cw}번 움직여요.`;
  if (fifthsDown >= 2 && fifthsDown >= real.length / 2) s += ` 그중 ${fifthsDown}번은 5도 아래로 한 칸이라 계속 풀려 가는 느낌이 들어요.`;
  else if (far) s += ` 다섯 칸 이상 건너뛰는 곳이 ${far}번 있어서 그때 색이 확 바뀌어요.`;
  return s;
}

export function analyze(key: number, mode: Mode, chords: string[]) {
  const song = { key, mode };
  const infos = chords.map(rn => chordInfo(song, rn)).filter((c): c is ChordInfo => !!c);
  const moves = infos.map((c, i) => describe(c, infos[(i + 1) % infos.length]));
  // 같은 움직임이 이어지면 설명을 되풀이하지 않는다
  moves.forEach((m, i) => {
    const prev = moves[i - 1];
    if (i > 0 && m.steps !== 0 && prev.steps === m.steps) m.text = `이번에도 ${m.steps > 0 ? '시계' : '반시계'} 방향으로 ${NUM[Math.abs(m.steps)]} 칸 가요.`;
  });
  return { infos, moves, summary: summarize(moves) };
}

// 조의 일곱 음은 원 위에서 이어진 7칸. 장조는 으뜸음에서 반시계 1칸 ~ 시계 5칸, 단조는 반시계 4칸 ~ 시계 2칸.
export const scaleWindow = (key: number, mode: Mode) => { const t = posOf(key); return mode === 'major' ? [t - 1, t + 5] : [t - 4, t + 2]; };

// ── 그림 ──
const INK = '#2d2d4a', INK5 = '#6b6b8e', LINE = '#e2e2f0', SURF = '#f0f0f8', VIOLET = '#7c3aed', VIOLET_G = '#ede6fd', BLUE = '#2563eb';
const S = 400, C = S / 2, R = 130, ARC = 168;
const f = (n: number) => n.toFixed(1);
const at = (pos: number, r: number): [number, number] => { const a = (pos * 30 - 90) * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// upto: 몇 번째 움직임까지 화살표를 그릴지(재생 중 길이 그려지는 효과). 생략하면 전부(마지막 → 첫 코드 포함).
// now: 모양을 보여 줄 코드 번호.
export function mapSvg(key: number, mode: Mode, chords: string[], opts: { now?: number; upto?: number } = {}) {
  const { infos, moves } = analyze(key, mode, chords);
  const now = Math.min(opts.now ?? 0, infos.length - 1);
  const upto = opts.upto ?? moves.length;
  const cur = infos[now];
  let h = `<svg viewBox="0 0 ${S} ${S}" class="pm-svg" role="img" aria-label="${esc(`5도권 위의 근음 움직임: ${infos.map(c => c.name).join(' → ')}`)}">`;
  h += `<defs>${[['v', VIOLET], ['b', BLUE]].map(([k, c]) => `<marker id="pm-${k}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>`).join('')}</defs>`;

  // 조의 7칸: 원 바깥에 옅은 띠
  const [w0, w1] = scaleWindow(key, mode);
  const band = (r0: number, r1: number, a: number, b: number) => {
    const [x0, y0] = at(a, r1), [x1, y1] = at(b, r1), [x2, y2] = at(b, r0), [x3, y3] = at(a, r0);
    return `M ${f(x0)} ${f(y0)} A ${r1} ${r1} 0 ${b - a > 6 ? 1 : 0} 1 ${f(x1)} ${f(y1)} L ${f(x2)} ${f(y2)} A ${r0} ${r0} 0 ${b - a > 6 ? 1 : 0} 0 ${f(x3)} ${f(y3)} Z`;
  };
  h += `<path d="${band(R - 22, R + 22, w0 - 0.5, w1 + 0.5)}" fill="${SURF}"/>`;
  h += `<circle cx="${C}" cy="${C}" r="${R}" fill="none" stroke="${LINE}"/>`;

  // 지금 코드의 모양 (음의 원 위 다각형)
  const rootPos = posOf(cur.rootPc), minorish = cur.pcs.some(p => (p - cur.rootPc + 12) % 12 === 3);
  const tone = cur.pcs.map(pc => { const pos = posOf(pc), d = (pos - rootPos + 12) % 12; return { pc, pos, col: d === 0 ? INK : d < 6 || (d === 6 && !minorish) ? VIOLET : BLUE }; }).sort((a, b) => a.pos - b.pos);
  h += `<polygon class="pm-shape" points="${tone.map(t => at(t.pos, R).map(f).join(',')).join(' ')}" fill="${VIOLET_G}" fill-opacity="0.7" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;

  // 근음의 길: 원 바깥을 도는 호. 시계 방향 = 보라, 반시계 방향 = 파랑.
  moves.forEach((m, i) => {
    if (i >= upto || m.steps === 0) return;
    const a = posOf(m.from.rootPc), b = a + m.steps, r = ARC + (i % 2) * 9, col = m.steps > 0 ? VIOLET : BLUE;
    const pad = 0.28 * Math.sign(m.steps);
    const [x0, y0] = at(a + pad, r), [x1, y1] = at(b - pad, r);
    const large = Math.abs(m.steps) > 6 ? 1 : 0, sweep = m.steps > 0 ? 1 : 0;
    const loop = i === moves.length - 1;
    h += `<path class="pm-move" data-i="${i}" d="M ${f(x0)} ${f(y0)} A ${r} ${r} 0 ${large} ${sweep} ${f(x1)} ${f(y1)}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"${loop ? ' stroke-dasharray="1 5"' : ''} marker-end="url(#pm-${m.steps > 0 ? 'v' : 'b'})"/>`;
  });

  // 12칸
  const on = new Map(tone.map(t => [t.pos, t.col]));
  const roots = new Map<number, number[]>();
  infos.forEach((c, i) => { const p = posOf(c.rootPc); roots.set(p, [...(roots.get(p) ?? []), i]); });
  for (let pos = 0; pos < 12; pos++) {
    const [x, y] = at(pos, R), col = on.get(pos), inKey = ((pos - w0) % 12 + 12) % 12 <= w1 - w0;
    h += col
      ? `<circle cx="${f(x)}" cy="${f(y)}" r="15" fill="${col}"/><text x="${f(x)}" y="${f(y + 4.5)}" text-anchor="middle" font-size="13" font-weight="700" fill="white" class="pm-note">${NOTE[pcAt(pos)]}</text>`
      : `<circle cx="${f(x)}" cy="${f(y)}" r="13" fill="white" stroke="${inKey ? INK5 : LINE}" stroke-width="1"/><text x="${f(x)}" y="${f(y + 4)}" text-anchor="middle" font-size="11.5" font-weight="${inKey ? 600 : 400}" fill="${inKey ? INK : INK5}" class="pm-note">${NOTE[pcAt(pos)]}</text>`;
  }
  // 근음 번호(몇 번째 코드의 근음인지) — 원 안쪽에
  for (const [pos, idx] of roots) {
    const [x, y] = at(pos, R - 36), t = idx.map(i => i + 1).join('·'), w = 10 + t.length * 5.6;
    const isNow = idx.includes(now);
    h += `<g class="pm-root"><rect x="${f(x - w / 2)}" y="${f(y - 8)}" width="${f(w)}" height="16" rx="8" fill="${isNow ? VIOLET : 'white'}" stroke="${VIOLET}" stroke-width="1.2"/>`
      + `<text x="${f(x)}" y="${f(y + 3.6)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${isNow ? 'white' : VIOLET}" class="mono">${t}</text></g>`;
  }
  // 가운데: 지금 코드
  const halo = 'stroke="white" stroke-width="5" stroke-linejoin="round" paint-order="stroke"';
  h += `<text x="${C}" y="${C - 4}" text-anchor="middle" font-size="26" font-weight="700" fill="${INK}" ${halo} class="pm-name">${esc(cur.name)}</text>`
    + `<text x="${C}" y="${C + 18}" text-anchor="middle" font-size="12.5" fill="${INK5}" ${halo} class="mono">${esc(cur.rn)}</text>`;
  return h + '</svg>';
}

// ── 링크 ──
export function encodeState(key: number, mode: Mode, chords: string[]) {
  return new URLSearchParams({ k: String(key), m: mode, p: chords.join(' ') }).toString();
}
export function decodeState(q: URLSearchParams) {
  const mode: Mode = q.get('m') === 'minor' ? 'minor' : 'major';
  const k = parseInt(q.get('k') ?? '', 10);
  const key = Number.isInteger(k) && k >= 0 && k <= 11 ? k : mode === 'minor' ? 9 : 0;
  const pal = new Set(palette(mode));
  const chords = (q.get('p') ?? '').split(' ').filter(rn => pal.has(rn)).slice(0, MAX_CHORDS);
  return chords.length >= 2 ? { key, mode, chords } : null;
}
