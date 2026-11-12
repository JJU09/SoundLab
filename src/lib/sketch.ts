// 곡 스케치 — 8마디(벌스 4 + 코러스 4) 곡 데이터 모델, 예시 곡, 직렬화, 스텝별 이벤트 생성.
// 오디오와 분리된 순수 로직: 실시간 재생과 WAV 오프라인 렌더가 같은 이벤트를 쓴다.
import { ROMAN, CHORD_TYPES, ROOTS, spellFrom, spellScale, SCALES, type Letter } from './music';
import type { DrumTrack } from '../audio/drums';

export type PartId = 'drums' | 'bass' | 'chords' | 'melody';
export type SectionId = 'verse' | 'chorus';
export type ChordStyle = 'block' | 'arp' | 'stab' | 'pad';
export type BassStyle = 'whole' | 'eighth' | 'kick' | 'octave';
export type ChordInst = 'keys' | 'pad' | 'pluck';
export type BassInst = 'sub' | 'synth' | 'pluck';
export type LeadInst = 'soft' | 'bright' | 'bell';

export const PARTS: PartId[] = ['drums', 'bass', 'chords', 'melody'];
export const PART_LABEL: Record<PartId, string> = { drums: '드럼', bass: '베이스', chords: '코드', melody: '멜로디' };
export const SECTIONS: SectionId[] = ['verse', 'chorus'];
export const SECTION_LABEL: Record<SectionId, string> = { verse: '벌스', chorus: '코러스' };
export const DRUM_TRACKS: DrumTrack[] = ['kick', 'snare', 'hat', 'open', 'clap'];

export const BARS = 4;              // 섹션당 마디
export const STEPS = 16;            // 마디당 16분 스텝
export const MEL_CELLS = 8;         // 마디당 멜로디 칸(8분음표)
export const MEL_ROWS = 15;         // 멜로디 세로 칸 = 음계 2옥타브 + 1
export const SEC_STEPS = BARS * STEPS;
export const SONG_STEPS = SECTIONS.length * SEC_STEPS;
export const REST = -1, HOLD = -2;  // 멜로디 칸 값: 행 번호(0~14) · 쉼 · 앞 음 이어서

export interface Section {
  on: Record<PartId, boolean>;
  drums: Record<DrumTrack, string>;   // 16글자 한 마디 패턴('x' 침, 'o' 약하게, '.' 쉼) — 4마디 반복
  chords: string[];                   // 마디별 로마숫자('' = 쉼)
  chordStyle: ChordStyle;
  bass: BassStyle;
  melody: number[];                   // 32칸 (4마디 × 8분)
}
export interface Song {
  v: 1;
  title: string;
  key: number;                        // 으뜸음 pc (0 = C)
  mode: 'major' | 'minor';
  bpm: number;
  swing: number;                      // 0.5 스트레이트 ~ 0.67 셔플
  sections: Record<SectionId, Section>;
  inst: { chords: ChordInst; bass: BassInst; melody: LeadInst };
  vol: Record<PartId, number>;        // 0~100
}

// ── 조 · 코드 팔레트 ──
const MAJOR_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const MINOR_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'];
const parseRoot = (s: string) => ({ letter: s[0] as Letter, acc: s.includes('♯') ? 1 : s.includes('♭') ? -1 : 0 });
export const keyName = (song: Pick<Song, 'key' | 'mode'>) => (song.mode === 'major' ? MAJOR_NAMES : MINOR_NAMES)[song.key] + (song.mode === 'major' ? ' 장조' : ' 단조');
export const keyOptions = (mode: Song['mode']) => (mode === 'major' ? MAJOR_NAMES : MINOR_NAMES).map((n, i) => ({ pc: i, name: n }));
const keyRoot = (song: Pick<Song, 'key' | 'mode'>) => parseRoot((song.mode === 'major' ? MAJOR_NAMES : MINOR_NAMES)[song.key]);

export type Fn = 'T' | 'S' | 'D' | 'B' | 'X';
interface RomanDef { deg: number; semi: number; type: string; fn: Fn; }
const MINOR_ROMAN: Record<string, RomanDef> = {
  'i': { deg: 0, semi: 0, type: 'min', fn: 'T' }, 'ii°': { deg: 1, semi: 2, type: 'dim', fn: 'S' }, '♭III': { deg: 2, semi: 3, type: 'maj', fn: 'T' },
  'iv': { deg: 3, semi: 5, type: 'min', fn: 'S' }, 'v': { deg: 4, semi: 7, type: 'min', fn: 'D' }, 'V': { deg: 4, semi: 7, type: 'maj', fn: 'D' },
  'V7': { deg: 4, semi: 7, type: '7', fn: 'D' }, '♭VI': { deg: 5, semi: 8, type: 'maj', fn: 'S' }, '♭VII': { deg: 6, semi: 10, type: 'maj', fn: 'D' },
  'i7': { deg: 0, semi: 0, type: 'm7', fn: 'T' }, 'iv7': { deg: 3, semi: 5, type: 'm7', fn: 'S' }, '♭IIImaj7': { deg: 2, semi: 3, type: 'maj7', fn: 'T' },
  '♭VImaj7': { deg: 5, semi: 8, type: 'maj7', fn: 'S' }, 'IV': { deg: 3, semi: 5, type: 'maj', fn: 'B' },
};
export const PALETTE: Record<Song['mode'], string[][]> = {
  major: [['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'Vsus4'], ['V7/vi', 'V7/V', 'V7/ii', 'iv', '♭VI', '♭VII']],
  minor: [['i', 'ii°', '♭III', 'iv', 'v', '♭VI', '♭VII'], ['i7', '♭IIImaj7', 'iv7', 'V', 'V7', '♭VImaj7'], ['IV']],
};
export const FN_LABEL: Record<Fn, string> = { T: '토닉', S: '서브도미넌트', D: '도미넌트', B: '빌린 화음', X: '세컨더리' };

// ── 코드 고르기: 기능(토닉·서브도미넌트·도미넌트)별로 묶은 조 안의 코드 ──
// rn = 그 자리의 기본 코드, variants = 같은 자리의 모양([로마숫자, 이름]), mood = 분위기 한 줄
export type MainFn = 'T' | 'S' | 'D';
export const FN_GROUPS: { fn: MainFn; home: string; desc: string }[] = [
  { fn: 'T', home: '집', desc: '안정' },
  { fn: 'S', home: '나들이', desc: '떠남' },
  { fn: 'D', home: '긴장', desc: '돌아가려는 힘' },
];
export interface DegreeDef { rn: string; fn: MainFn; variants: [string, string][]; mood: string; }
const deg = (rn: string, fn: MainFn, mood: string, ...more: [string, string][]): DegreeDef => ({ rn, fn, mood, variants: [[rn, '기본'], ...more] });
export const DEGREES: Record<Song['mode'], DegreeDef[]> = {
  major: [
    deg('I', 'T', '가장 안정된 집. 시작과 끝에 두면 편안해요', ['Imaj7', '7화음']),
    deg('vi', 'T', '그늘진 집. 아련하고 서정적인 분위기', ['vi7', '7화음']),
    deg('iii', 'T', '집과 긴장 사이. 살짝 떠 있는 느낌', ['iii7', '7화음']),
    deg('IV', 'S', '밝게 열리며 집을 나서는 느낌', ['IVmaj7', '7화음']),
    deg('ii', 'S', '부드럽게 떠남. V로 이어 가기 좋아요', ['ii7', '7화음']),
    deg('V', 'D', '집으로 돌아가고 싶은 힘이 가장 강해요', ['V7', '7화음'], ['Vsus4', 'sus4']),
    deg('vii°', 'D', '불안정한 긴장. 드물게, 스쳐 가듯 써요'),
  ],
  minor: [
    deg('i', 'T', '어두운 집. 차분하고 안정적이에요', ['i7', '7화음']),
    deg('♭III', 'T', '밝은 집. 나란한 장조의 빛이 잠깐 들어요', ['♭IIImaj7', '7화음']),
    deg('iv', 'S', '깊은 그늘로 떠나는 느낌', ['iv7', '7화음']),
    deg('♭VI', 'S', '웅장하게 열림. 서사적인 느낌', ['♭VImaj7', '7화음']),
    deg('ii°', 'S', '불안하게 떠남. 드물게 써요'),
    deg('v', 'D', '부드러운 긴장. 은근히 집으로 돌아가요'),
    deg('♭VII', 'D', '힘차게 밀어 올림. i로 돌아갈 때 잘 어울려요'),
  ],
};
// 조 밖에서 잠깐 가져오는 코드
export const EXTRAS: Record<Song['mode'], { rn: string; note: string }[]> = {
  major: [
    { rn: 'V7/vi', note: 'vi로 강하게 끌어당겨요' }, { rn: 'V7/V', note: 'V로 강하게 끌어당겨요' }, { rn: 'V7/ii', note: 'ii로 강하게 끌어당겨요' },
    { rn: 'iv', note: '단조에서 빌린 그늘진 IV' }, { rn: '♭VI', note: '단조에서 빌린 웅장함' }, { rn: '♭VII', note: '단조에서 빌린 록 느낌' },
  ],
  minor: [
    { rn: 'V', note: '장3화음 V — i로 확실히 돌아가요' }, { rn: 'V7', note: '더 강하게 i로 끌어당겨요' }, { rn: 'IV', note: '밝은 IV — 도리안의 색' },
  ],
};
// 한 번에 넣는 4마디 진행
export const PROGS: Record<Song['mode'], { chords: string[]; note: string }[]> = {
  major: [
    { chords: ['I', 'V', 'vi', 'IV'], note: '가장 흔한 팝' }, { chords: ['vi', 'IV', 'I', 'V'], note: '아련하게 시작' },
    { chords: ['I', 'vi', 'IV', 'V'], note: '옛 팝' }, { chords: ['IV', 'V', 'iii', 'vi'], note: 'J-pop 왕도' }, { chords: ['ii', 'V', 'I', 'vi'], note: '재즈풍 순환' },
  ],
  minor: [
    { chords: ['i', '♭VI', '♭III', '♭VII'], note: '가장 흔한 단조 팝' }, { chords: ['i', '♭VII', '♭VI', '♭VII'], note: '록 · 영화음악' },
    { chords: ['i', 'iv', '♭VII', '♭III'], note: '5도씩 내려가기' }, { chords: ['i', '♭VI', 'iv', 'V'], note: '강하게 돌아오기' },
  ],
};
// 로마숫자가 속한 조 안의 자리(없으면 조 밖의 코드)
export const degreeOf = (mode: Song['mode'], rn: string) => DEGREES[mode].find(d => d.variants.some(v => v[0] === rn)) ?? null;

export interface ChordInfo { rn: string; name: string; fn: Fn; rootPc: number; pcs: number[]; type: string; }
export function chordInfo(song: Pick<Song, 'key' | 'mode'>, rn: string): ChordInfo | null {
  const def: RomanDef | undefined = song.mode === 'major' ? (ROMAN as Record<string, RomanDef>)[rn] : MINOR_ROMAN[rn];
  if (!def) return null;
  const t = CHORD_TYPES[def.type];
  const root = spellFrom(keyRoot(song), def.deg, def.semi);
  const rootPc = (song.key + def.semi) % 12;
  return { rn, name: root.name + t.sym, fn: def.fn, rootPc, pcs: t.steps.map(s => (rootPc + s) % 12), type: def.type };
}

// ── 멜로디 음 ──
const scaleSteps = (mode: Song['mode']) => (mode === 'major' ? SCALES.major : SCALES.natural).steps;
export const tonicMidi = (key: number) => (key <= 5 ? 60 : 48) + key;       // 가운데 도 근처에서 시작
export function rowMidi(song: Pick<Song, 'key' | 'mode'>, row: number) {
  const st = scaleSteps(song.mode);
  return tonicMidi(song.key) + 12 * Math.floor(row / 7) + st[row % 7];
}
export function rowLabels(song: Pick<Song, 'key' | 'mode'>) {
  const names = spellScale(keyRoot(song), song.mode === 'major' ? SCALES.major : SCALES.natural);
  return Array.from({ length: MEL_ROWS }, (_, r) => ({ name: names[r % 7].name, kr: names[r % 7].kr, deg: (r % 7) + 1, oct: Math.floor(r / 7) }));
}
// 펜타토닉에 들어가는 음계 도수 (장조 1 2 3 5 6, 단조 1 ♭3 4 5 ♭7)
export const PENTA_DEG: Record<Song['mode'], number[]> = { major: [0, 1, 2, 4, 5], minor: [0, 2, 3, 4, 6] };

// ── 이벤트 ──
export type Ev =
  | { kind: 'drum'; track: DrumTrack; at: number; vel: number }
  | { kind: 'note'; part: Exclude<PartId, 'drums'>; midi: number; at: number; dur: number; vel: number };

// 16분 스텝 안의 위치에 스윙 적용 (8분 뒷박을 늦춤). 반환: 스텝 단위 시작 위치
export function swingPos(step: number, swing: number) {
  const beat = Math.floor(step / 4), x = (step % 4) / 4;
  const y = x < 0.5 ? (x / 0.5) * swing : swing + ((x - 0.5) / 0.5) * (1 - swing);
  return (beat + y) * 4;
}

// 코드 보이싱: 각 음을 55~66 창에 넣어 가까운 자리로 (창 고정 = 자연스러운 보이스 리딩)
export const voice = (pcs: number[]) => pcs.map(pc => { let m = 48 + pc; while (m < 55) m += 12; return m; }).sort((a, b) => a - b);
const bassMidi = (pc: number) => 36 + pc;  // C2~B2

export function sectionOf(g: number): { id: SectionId; local: number } {
  return { id: SECTIONS[Math.floor(g / SEC_STEPS) % SECTIONS.length], local: g % SEC_STEPS };
}

// 곡 전체 스텝 g(0..SONG_STEPS-1)에서 시작하는 이벤트들. at = 곡 처음부터의 스텝 위치(스윙 반영)
export function stepEvents(song: Song, g: number): Ev[] {
  const { id, local } = sectionOf(g);
  const sec = song.sections[id];
  const bar = Math.floor(local / STEPS), s = local % STEPS;
  const at = Math.floor(g / STEPS) * STEPS + swingPos(s, song.swing);
  const out: Ev[] = [];
  if (sec.on.drums) for (const tr of DRUM_TRACKS) {
    const c = sec.drums[tr]?.[s];
    if (c === 'x' || c === 'o') out.push({ kind: 'drum', track: tr, at, vel: c === 'o' ? 0.4 : 0.85 });
  }
  const ch = sec.chords[bar] ? chordInfo(song, sec.chords[bar]) : null;
  if (ch && sec.on.chords) {
    const v = voice(ch.pcs);
    const st = sec.chordStyle;
    if (st === 'block' && s % 8 === 0) v.forEach(m => out.push({ kind: 'note', part: 'chords', midi: m, at, dur: 7.5, vel: 0.5 }));
    if (st === 'pad' && s === 0) v.forEach(m => out.push({ kind: 'note', part: 'chords', midi: m, at, dur: 15.8, vel: 0.45 }));
    if (st === 'stab' && s % 4 === 2) v.forEach(m => out.push({ kind: 'note', part: 'chords', midi: m + 12, at, dur: 1.2, vel: 0.45 }));
    if (st === 'arp' && s % 2 === 0) {
      const seq = [...v, v[0] + 12, ...v.slice(1).reverse()];
      out.push({ kind: 'note', part: 'chords', midi: seq[(s / 2) % seq.length], at, dur: 3, vel: 0.5 });
    }
  }
  if (ch && sec.on.bass) {
    const r = bassMidi(ch.rootPc);
    const b = sec.bass;
    if (b === 'whole' && s === 0) out.push({ kind: 'note', part: 'bass', midi: r, at, dur: 15.5, vel: 0.8 });
    if (b === 'eighth' && s % 2 === 0) out.push({ kind: 'note', part: 'bass', midi: r, at, dur: 1.7, vel: s % 4 === 0 ? 0.8 : 0.6 });
    if (b === 'octave' && s % 2 === 0) out.push({ kind: 'note', part: 'bass', midi: s % 4 === 0 ? r : r + 12, at, dur: 1.7, vel: 0.7 });
    if (b === 'kick') {
      const k = sec.on.drums ? sec.drums.kick : 'x...x...x...x...';
      if (k[s] === 'x' || k[s] === 'o') { let n = 1; while (s + n < STEPS && k[s + n] === '.') n++; out.push({ kind: 'note', part: 'bass', midi: r, at, dur: Math.min(n, 4) - 0.2, vel: 0.8 }); }
    }
  }
  if (sec.on.melody && s % 2 === 0) {
    const cell = bar * MEL_CELLS + s / 2;
    const row = sec.melody[cell];
    if (row >= 0) {
      let n = 1; while (cell + n < sec.melody.length && sec.melody[cell + n] === HOLD) n++;
      out.push({ kind: 'note', part: 'melody', midi: rowMidi(song, row), at, dur: n * 2 - 0.15, vel: 0.55 });
    }
  }
  return out;
}

// ── 기본값 · 예시 곡 ──
const pat = (kick: string, snare: string, hat: string, open = '................', clap = '................') => ({ kick, snare, hat, open, clap });
const ON = (d = true, b = true, c = true, m = true) => ({ drums: d, bass: b, chords: c, melody: m });
// 멜로디 표기: 8칸 한 마디를 공백으로 구분, 숫자 = 행(0 = 으뜸음), '.' 쉼, '-' 이어서
const mel = (s: string) => s.trim().split(/\s+/).flatMap(bar => bar.split(',')).map(t => (t === '.' ? REST : t === '-' ? HOLD : +t));

export const EXAMPLES: Record<string, { name: string; desc: string; song: Song }> = {
  pop: {
    name: '팝', desc: 'C장조 · 100 BPM · 8비트 → 16비트',
    song: {
      v: 1, title: '첫 팝송', key: 0, mode: 'major', bpm: 100, swing: 0.5,
      sections: {
        verse: { on: ON(true, true, true, true), drums: pat('x.......x.x.....', '....x.......x...', 'x.x.x.x.x.x.x.x.'), chords: ['vi', 'IV', 'I', 'V'], chordStyle: 'block', bass: 'whole',
          melody: mel('2,.,2,3,4,-,.,. 3,-,2,0,2,-,.,. 2,.,2,3,4,-,6,- 6,-,5,-,4,-,.,.') },
        chorus: { on: ON(true, true, true, true), drums: pat('x......x..x.....', '....x.......x...', 'xoxoxoxoxoxoxoxo', '..............x.'), chords: ['I', 'V', 'vi', 'IV'], chordStyle: 'stab', bass: 'eighth',
          melody: mel('7,-,6,7,9,-,7,- 6,-,4,-,4,5,6,- 5,-,4,5,7,-,6,5 5,-,-,-,7,-,-,-') },
      },
      inst: { chords: 'keys', bass: 'synth', melody: 'bright' }, vol: { drums: 80, bass: 75, chords: 60, melody: 75 },
    },
  },
  ballad: {
    name: '발라드', desc: 'G장조 · 72 BPM · 피아노 분산화음',
    song: {
      v: 1, title: '느린 발라드', key: 7, mode: 'major', bpm: 72, swing: 0.5,
      sections: {
        verse: { on: ON(false, true, true, true), drums: pat('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'), chords: ['I', 'V7/vi', 'vi', 'IV'], chordStyle: 'arp', bass: 'whole',
          melody: mel('.,.,0,1,2,-,-,- 2,-,1,-,2,-,.,. .,.,4,5,4,2,1,- 0,-,-,-,.,.,.,.') },
        chorus: { on: ON(true, true, true, true), drums: pat('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.'), chords: ['IV', 'V', 'iii7', 'vi'], chordStyle: 'arp', bass: 'whole',
          melody: mel('7,-,6,-,7,-,-,8 8,-,6,-,4,-,.,. 6,-,8,-,9,-,8,6 7,-,-,-,-,-,.,.') },
      },
      inst: { chords: 'keys', bass: 'sub', melody: 'soft' }, vol: { drums: 65, bass: 70, chords: 70, melody: 75 },
    },
  },
  lofi: {
    name: '로파이', desc: 'D단조 · 80 BPM · 스윙 붐뱁 + 7화음',
    song: {
      v: 1, title: '새벽 로파이', key: 2, mode: 'minor', bpm: 80, swing: 0.6,
      sections: {
        verse: { on: ON(true, true, true, false), drums: pat('x......x.x......', '....x.......x...', 'x.x.x.x.x.x.x.x.'), chords: ['i7', 'iv7', '♭VImaj7', 'V7'], chordStyle: 'pad', bass: 'kick',
          melody: mel('.,.,.,.,.,.,.,. .,.,.,.,.,.,.,. .,.,.,.,.,.,.,. .,.,.,.,.,.,.,.') },
        chorus: { on: ON(true, true, true, true), drums: pat('x......x.x......', '....x.......x...', 'x.x.x.x.x.x.x.x.', '................', '............x...'), chords: ['i7', 'iv7', '♭VImaj7', 'V7'], chordStyle: 'pad', bass: 'kick',
          melody: mel('4,-,6,7,-,6,4,- 3,-,-,2,0,-,.,. 2,-,3,4,-,6,4,- 1,-,-,-,.,.,.,.') },
      },
      inst: { chords: 'pad', bass: 'sub', melody: 'bell' }, vol: { drums: 75, bass: 70, chords: 60, melody: 70 },
    },
  },
};
export const cloneSong = (s: Song): Song => JSON.parse(JSON.stringify(s));

// ── 직렬화 (공유 링크 ?s=) ──
const toB64 = (str: string) => btoa(String.fromCharCode(...new TextEncoder().encode(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (b: string) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));
export const encodeSong = (s: Song) => toB64(JSON.stringify(s));
export function decodeSong(str: string): Song | null {
  try { return validate(JSON.parse(fromB64(str))); } catch (e) { return null; }
}
// 외부에서 들어온 데이터(링크·저장소)를 안전한 범위로 정리
export function validate(o: any): Song | null {
  if (!o || o.v !== 1 || !o.sections) return null;
  const base = cloneSong(EXAMPLES.pop.song);
  const clamp = (n: any, a: number, b: number, d: number) => (typeof n === 'number' && isFinite(n) ? Math.min(b, Math.max(a, n)) : d);
  const song: Song = {
    v: 1, title: String(o.title ?? '').slice(0, 40) || '내 스케치',
    key: Math.round(clamp(o.key, 0, 11, 0)), mode: o.mode === 'minor' ? 'minor' : 'major',
    bpm: Math.round(clamp(o.bpm, 50, 180, 100)), swing: clamp(o.swing, 0.5, 0.7, 0.5),
    sections: base.sections, inst: base.inst, vol: base.vol,
  };
  const pal = new Set(PALETTE[song.mode].flat());
  for (const id of SECTIONS) {
    const src = o.sections[id] ?? {}, dst = song.sections[id];
    for (const p of PARTS) dst.on[p] = src.on?.[p] !== false && !!src.on;
    for (const t of DRUM_TRACKS) { const v = String(src.drums?.[t] ?? '').replace(/[^xo.]/g, '.').padEnd(16, '.').slice(0, 16); dst.drums[t] = v; }
    dst.chords = Array.from({ length: BARS }, (_, i) => (pal.has(src.chords?.[i]) ? src.chords[i] : ''));
    dst.chordStyle = (['block', 'arp', 'stab', 'pad'] as ChordStyle[]).includes(src.chordStyle) ? src.chordStyle : 'block';
    dst.bass = (['whole', 'eighth', 'kick', 'octave'] as BassStyle[]).includes(src.bass) ? src.bass : 'whole';
    dst.melody = Array.from({ length: BARS * MEL_CELLS }, (_, i) => { const v = src.melody?.[i]; return Number.isInteger(v) && v >= HOLD && v < MEL_ROWS ? v : REST; });
    if (dst.melody[0] === HOLD) dst.melody[0] = REST;
  }
  const pick = <T extends string>(v: any, opts: T[], d: T) => (opts.includes(v) ? v : d);
  song.inst = { chords: pick(o.inst?.chords, ['keys', 'pad', 'pluck'], 'keys'), bass: pick(o.inst?.bass, ['sub', 'synth', 'pluck'], 'sub'), melody: pick(o.inst?.melody, ['soft', 'bright', 'bell'], 'soft') };
  for (const p of PARTS) song.vol[p] = Math.round(clamp(o.vol?.[p], 0, 100, 70));
  return song;
}

// 빈 스케치 (모든 파트 켜짐, 코드만 채움)
export function blankSong(mode: Song['mode'] = 'major'): Song {
  const s = cloneSong(EXAMPLES.pop.song);
  s.title = '내 스케치'; s.mode = mode; s.key = mode === 'major' ? 0 : 9;
  for (const id of SECTIONS) {
    const sec = s.sections[id];
    sec.chords = mode === 'major' ? ['I', 'IV', 'V', 'I'] : ['i', 'iv', 'v', 'i'];
    sec.melody = Array(BARS * MEL_CELLS).fill(REST);
    sec.drums = pat('x.......x.......', '....x.......x...', 'x.x.x.x.x.x.x.x.');
    sec.chordStyle = 'block'; sec.bass = 'whole';
  }
  return s;
}
export { ROOTS };
