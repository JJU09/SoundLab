// 5도권 그림 — 조 안의 코드(부채꼴)와 코드 진행(화살표)을 한 장에. SVG 문자열을 돌려주므로
// Astro(set:html)와 클라이언트 스크립트(innerHTML) 양쪽에서 쓴다.
//   바깥 고리 = 장3화음(시계 방향 = 5도 위), 안쪽 고리 = 나란한 단조, 가장 안쪽 = 감3화음
import { chordInfo, DEGREES, type ChordInfo, type Fn, type Song } from './sketch';

const FN_COL: Record<Fn, string> = { T: '#16a34a', S: '#2563eb', D: '#dc2626', B: '#9333ea', X: '#ea580c' };
const INK = '#2d2d4a', INK5 = '#6b6b8e', INK3 = '#a0a0c0', LINE = '#e2e2f0', SURF = '#f0f0f8', VIOLET = '#7c3aed', VIOLET_L = '#a78bfa';
const MAJ = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MIN = ['Cm', 'C♯m', 'Dm', 'E♭m', 'Em', 'Fm', 'F♯m', 'Gm', 'G♯m', 'Am', 'B♭m', 'Bm'];

const S = 340, C = S / 2, RAD = [140, 84, 38], NR = [18, 16, 13];
const majPos = (pc: number) => (pc * 7) % 12;   // 장조 으뜸음 pc → 원 위의 자리(0 = 12시, 시계 방향)
const pt = (pos: number, r: number): [number, number] => { const a = (pos * 30 - 90) * Math.PI / 180; return [C + r * Math.cos(a), C + r * Math.sin(a)]; };
const f = (n: number) => n.toFixed(1);
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// 코드가 놓이는 자리: 장3화음 계열 = 바깥, 단3화음 계열 = 안쪽(나란한 장조 자리), 감3화음 = 가장 안쪽
export function circlePlace(ci: Pick<ChordInfo, 'rootPc' | 'type'>) {
  const ring = ['min', 'm7', 'm9'].includes(ci.type) ? 1 : ['dim', 'm7b5', 'dim7'].includes(ci.type) ? 2 : 0;
  return { ring, pos: majPos((ci.rootPc + [0, 3, 1][ring]) % 12), key: `${ring}-${majPos((ci.rootPc + [0, 3, 1][ring]) % 12)}` };
}

interface Node { key: string; ring: number; pos: number; rn: string; name: string; fn: Fn; bars: number[]; pick?: string; }

export function circleSvg(song: Pick<Song, 'key' | 'mode'>, chords: string[], opts: { pickable?: boolean; id?: string } = {}) {
  const id = opts.id ?? 'cq';
  const home = majPos(song.mode === 'major' ? song.key : (song.key + 3) % 12);
  const nodes = new Map<string, Node>();
  for (const d of DEGREES[song.mode]) {
    const ci = chordInfo(song, d.rn)!; const pl = circlePlace(ci);
    nodes.set(pl.key, { ...pl, rn: d.rn, name: ci.name, fn: ci.fn, bars: [], pick: d.rn });
  }
  const seq: (string | null)[] = chords.map((rn, i) => {
    const ci = rn ? chordInfo(song, rn) : null; if (!ci) return null;
    const pl = circlePlace(ci);
    if (!nodes.has(pl.key)) nodes.set(pl.key, { ...pl, rn, name: ci.name, fn: ci.fn, bars: [] });   // 조 밖의 코드는 쓰일 때만 나타남
    nodes.get(pl.key)!.bars.push(i);
    return pl.key;
  });

  let h = `<svg viewBox="0 0 ${S} ${S}" class="cq" role="img" aria-label="5도권 위의 코드 진행: ${esc(chords.map(rn => (rn && chordInfo(song, rn)?.name) || '쉼').join(' → '))}">`;
  h += `<defs><marker id="${id}-a" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke="${VIOLET}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>`
    + `<marker id="${id}-b" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M1 1 L9 5 L1 9" fill="none" stroke="${VIOLET_L}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker></defs>`;
  // 조 안의 코드가 모인 부채꼴
  const arc = (r: number, a0: number, a1: number, sweep: number) => { const [x, y] = pt(a1, r); return `A ${r} ${r} 0 0 ${sweep} ${f(x)} ${f(y)}`; };
  const [wx, wy] = pt(home - 1.5, 163), [ix, iy] = pt(home + 1.5, 20);
  h += `<path d="M ${f(wx)} ${f(wy)} ${arc(163, home - 1.5, home + 1.5, 1)} L ${f(ix)} ${f(iy)} ${arc(20, home + 1.5, home - 1.5, 0)} Z" fill="${SURF}"/>`;
  h += `<circle cx="${C}" cy="${C}" r="${RAD[0]}" fill="none" stroke="${LINE}"/><circle cx="${C}" cy="${C}" r="${RAD[1]}" fill="none" stroke="${LINE}"/>`;
  // 지도: 쓰이지 않는 자리는 이름만
  for (let pos = 0; pos < 12; pos++) {
    const pc = (pos * 7) % 12;
    if (!nodes.has(`0-${pos}`)) { const [x, y] = pt(pos, RAD[0]); h += `<circle cx="${f(x)}" cy="${f(y)}" r="13" fill="white"/><text x="${f(x)}" y="${f(y + 4)}" text-anchor="middle" font-size="11" font-weight="600" fill="${INK3}">${MAJ[pc]}</text>`; }
    if (!nodes.has(`1-${pos}`)) { const [x, y] = pt(pos, RAD[1]); h += `<circle cx="${f(x)}" cy="${f(y)}" r="12" fill="white"/><text x="${f(x)}" y="${f(y + 3.5)}" text-anchor="middle" font-size="9.5" fill="${INK3}">${MIN[(pc + 9) % 12]}</text>`; }
  }
  // 진행 화살표 (마지막 → 첫 마디는 연하게: 반복)
  const used = seq.map((k, i) => ({ k, i })).filter(x => x.k) as { k: string; i: number }[];
  const segs = used.map((u, j) => ({ a: u, b: used[(j + 1) % used.length], loop: j === used.length - 1 })).filter(sg => used.length > 1 && sg.a.k !== sg.b.k);
  for (const sg of segs) {
    const A = nodes.get(sg.a.k)!, B = nodes.get(sg.b.k)!;
    let [x1, y1] = pt(A.pos, RAD[A.ring]), [x2, y2] = pt(B.pos, RAD[B.ring]);
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    const ox = -uy * 3.5, oy = ux * 3.5;   // 오가는 화살표가 겹치지 않게 진행 방향의 오른쪽으로 살짝
    x1 += ux * (NR[A.ring] + 2) + ox; y1 += uy * (NR[A.ring] + 2) + oy; x2 -= ux * (NR[B.ring] + 4) - ox; y2 -= uy * (NR[B.ring] + 4) - oy;
    h += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${sg.loop ? VIOLET_L : VIOLET}" stroke-width="1.8" stroke-linecap="round" marker-end="url(#${id}-${sg.loop ? 'b' : 'a'})"/>`;
  }
  // 코드 자리
  for (const n of nodes.values()) {
    const [x, y] = pt(n.pos, RAD[n.ring]), r = NR[n.ring], col = FN_COL[n.fn];
    const pick = opts.pickable && n.pick ? ` data-rn="${esc(n.pick)}" tabindex="0" role="button" aria-label="${esc(n.rn)} ${esc(n.name)}"` : '';
    h += `<g class="cq-node${pick ? ' cq-pick' : ''}" data-bars="${n.bars.join(' ')}"${pick}>`
      + `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="white" stroke="${col}" stroke-width="1.5"/>`
      + `<text x="${f(x)}" y="${f(y + (n.ring === 2 ? -0.5 : 0))}" text-anchor="middle" font-size="${n.rn.length > 4 ? 8 : n.rn.length > 3 || n.ring === 2 ? 9.5 : 12}" font-weight="700" fill="${INK}" class="cq-rn">${esc(n.rn)}</text>`
      + `<text x="${f(x)}" y="${f(y + (n.ring === 2 ? 7.5 : 9.5))}" text-anchor="middle" font-size="${n.ring === 2 ? 6.5 : 7.5}" fill="${INK5}">${esc(n.name)}</text></g>`;
  }
  // 마디 번호
  for (const n of nodes.values()) {
    if (!n.bars.length) continue;
    const [x, y] = pt(n.pos, RAD[n.ring]), r = NR[n.ring], t = n.bars.map(b => b + 1).join('·'), w = 9 + t.length * 5;
    h += `<g pointer-events="none"><rect x="${f(x + r * 0.72 - w / 2)}" y="${f(y - r * 0.72 - 7)}" width="${w}" height="14" rx="7" fill="${VIOLET}" stroke="white" stroke-width="1.5"/>`
      + `<text x="${f(x + r * 0.72)}" y="${f(y - r * 0.72 + 3.2)}" text-anchor="middle" font-size="8.5" font-weight="700" fill="white">${t}</text></g>`;
  }
  return h + '</svg>';
}

// ── 음의 원: 코드 하나를 5도권 위의 모양으로 ──
// 12음을 5도 간격으로 둘러놓고(시계 방향 = 5도 위) 코드의 음을 점으로 찍어 선으로 잇는다.
// 근음에서 시계 쪽 음 = 보라(밝은 쪽), 반시계 쪽 음 = 파랑(어두운 쪽). 같은 종류의 코드는 늘 같은 모양.
export interface ShapeTone { pc: number; name: string; deg: string; }
const BLUE = '#2563eb';
export function chordShapeSvg(rootPc: number, tones: ShapeTone[], label: string) {
  const Sz = 200, c = Sz / 2, R = 64, DR = 12.5;
  const at = (pos: number, r: number): [number, number] => { const a = (pos * 30 - 90) * Math.PI / 180; return [c + r * Math.cos(a), c + r * Math.sin(a)]; };
  const rootPos = majPos(rootPc), minorish = tones.some(t => (t.pc - rootPc + 12) % 12 === 3);
  const ts = tones.map(t => { const pos = majPos(t.pc), d = (pos - rootPos + 12) % 12;
    return { ...t, pos, col: d === 0 ? INK : d < 6 || (d === 6 && !minorish) ? VIOLET : BLUE }; }).sort((a, b) => a.pos - b.pos);
  let h = `<svg viewBox="0 0 ${Sz} ${Sz}" class="cs" role="img" aria-label="${esc(label)}">`;
  h += `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="${LINE}"/>`;
  h += `<polygon class="cs-poly" points="${ts.map(t => at(t.pos, R).map(f).join(',')).join(' ')}" fill="${SURF}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  const on = new Set(ts.map(t => t.pos));
  for (let pos = 0; pos < 12; pos++) {
    if (on.has(pos)) continue;
    const [x, y] = at(pos, R);
    h += `<circle cx="${f(x)}" cy="${f(y)}" r="8" fill="white"/><text x="${f(x)}" y="${f(y + 3.2)}" text-anchor="middle" font-size="9" fill="${INK3}">${MAJ[(pos * 7) % 12]}</text>`;
  }
  for (const t of ts) {
    const [x, y] = at(t.pos, R), [lx, ly] = at(t.pos, R + 22);
    h += `<circle cx="${f(x)}" cy="${f(y)}" r="${DR}" fill="${t.col}"/>`
      + `<text x="${f(x)}" y="${f(y + 3.8)}" text-anchor="middle" font-size="${t.name.length > 1 ? 9.5 : 11}" font-weight="700" fill="white" class="fd">${esc(t.name)}</text>`
      + `<text x="${f(lx)}" y="${f(ly + 3.2)}" text-anchor="middle" font-size="9" font-weight="700" fill="${t.col}" class="mono">${esc(t.deg)}</text>`;
  }
  return h + '</svg>';
}
