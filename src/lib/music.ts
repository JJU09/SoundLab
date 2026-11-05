// 음악 이론 공용 헬퍼 — 음이름·MIDI·주파수 변환. 순수 함수(오디오·DOM 의존 없음).
// 건반 위젯·오선보·청음 도구가 공유한다. 기준: A4 = 440Hz, 가운데 도 = C4 = MIDI 60.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export type Letter = (typeof LETTERS)[number];

// 계이름(고정도) — 흰 건반 기준
export const SOLFEGE: Record<Letter, string> = { C: '도', D: '레', E: '미', F: '파', G: '솔', A: '라', B: '시' };

// 흰 건반 글자 → 옥타브 안의 반음 위치
export const LETTER_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// 반음 위치(0~11) → 샵 표기 / 플랫 표기
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];

export const isBlack = (midi: number) => [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12);
export const pitchClass = (midi: number) => ((midi % 12) + 12) % 12;
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;   // C4 = 60
export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export interface ParsedNote { letter: Letter; acc: -1 | 0 | 1; octave: number; midi: number; }

// "C4", "F#5", "Bb3", "E♭4" → 파싱. 잘못된 입력이면 null.
export function parseNote(s: string): ParsedNote | null {
  const m = /^([A-Ga-g])(#|♯|b|♭)?(-?\d)$/.exec(s.trim());
  if (!m) return null;
  const letter = m[1].toUpperCase() as Letter;
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  const octave = Number(m[3]);
  return { letter, acc, octave, midi: (octave + 1) * 12 + LETTER_PC[letter] + acc };
}

export const noteToMidi = (s: string) => parseNote(s)?.midi ?? null;

// MIDI → 영문 음이름 (prefer: 'sharp' | 'flat', withOctave)
export function midiName(midi: number, prefer: 'sharp' | 'flat' = 'sharp', withOctave = true) {
  const pc = pitchClass(midi);
  const n = (prefer === 'flat' ? FLAT_NAMES : SHARP_NAMES)[pc];
  return withOctave ? `${n}${octaveOf(midi)}` : n;
}

// MIDI → 계이름. 검은 건반은 "도♯/레♭"처럼 두 이름을 함께.
export function solfegeName(midi: number) {
  const pc = pitchClass(midi);
  const white = LETTERS.find(l => LETTER_PC[l] === pc);
  if (white) return SOLFEGE[white];
  const lower = LETTERS.find(l => LETTER_PC[l] === pc - 1)!;
  const upper = LETTERS.find(l => LETTER_PC[l] === pc + 1)!;
  return `${SOLFEGE[lower]}♯/${SOLFEGE[upper]}♭`;
}

// 검은 건반의 이명동음 쌍 (예: 61 → "C♯ = D♭")
export function enharmonic(midi: number) {
  return isBlack(midi) ? `${midiName(midi, 'sharp', false)} = ${midiName(midi, 'flat', false)}` : midiName(midi, 'sharp', false);
}

// 범위 [lo, hi]의 MIDI 목록
export const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

// ── 음정 ──
// 반음 수 → 음정 이름 (한 옥타브 안). 6은 증4도/감5도(트라이톤).
export const INTERVAL_NAMES = ['완전1도', '단2도', '장2도', '단3도', '장3도', '완전4도', '증4도·감5도', '완전5도', '단6도', '장6도', '단7도', '장7도', '완전8도'];
export function intervalName(semis: number) {
  const s = Math.abs(semis);
  if (s <= 12) return INTERVAL_NAMES[s];
  return `${INTERVAL_NAMES[s % 12 === 0 ? 12 : s % 12]} + 옥타브`;
}

// ── 음계 ──
// steps: 으뜸음에서의 반음 거리, deg: 7음 음계 안에서의 글자 순서(철자용)
export interface ScaleDef { id: string; kr: string; en: string; steps: number[]; deg: number[]; desc: string; }
export const SCALES: Record<string, ScaleDef> = {
  major:      { id: 'major', kr: '장음계', en: 'Major', steps: [0, 2, 4, 5, 7, 9, 11], deg: [0, 1, 2, 3, 4, 5, 6], desc: '밝고 안정적 — 대부분의 동요·팝' },
  natural:    { id: 'natural', kr: '자연 단음계', en: 'Natural Minor', steps: [0, 2, 3, 5, 7, 8, 10], deg: [0, 1, 2, 3, 4, 5, 6], desc: '어둡고 서정적 — 발라드·록' },
  harmonic:   { id: 'harmonic', kr: '화성 단음계', en: 'Harmonic Minor', steps: [0, 2, 3, 5, 7, 8, 11], deg: [0, 1, 2, 3, 4, 5, 6], desc: '7음을 올려 이끎음이 생김 — 클래식·이국적' },
  melodic:    { id: 'melodic', kr: '가락 단음계', en: 'Melodic Minor', steps: [0, 2, 3, 5, 7, 9, 11], deg: [0, 1, 2, 3, 4, 5, 6], desc: '올라갈 때 6·7음을 올림 — 재즈에서는 내려갈 때도' },
  majpent:    { id: 'majpent', kr: '장조 펜타토닉', en: 'Major Pentatonic', steps: [0, 2, 4, 7, 9], deg: [0, 1, 2, 4, 5], desc: '장음계에서 4·7음을 뺀 5음 — 동요·포크·컨트리' },
  minpent:    { id: 'minpent', kr: '단조 펜타토닉', en: 'Minor Pentatonic', steps: [0, 3, 5, 7, 10], deg: [0, 2, 3, 4, 6], desc: '단음계에서 2·6음을 뺀 5음 — 록·블루스 기타 솔로' },
  blues:      { id: 'blues', kr: '블루스 음계', en: 'Blues', steps: [0, 3, 5, 6, 7, 10], deg: [0, 2, 3, 4, 4, 6], desc: '단조 펜타토닉 + ♭5(블루 노트)' },
  ionian:     { id: 'ionian', kr: '이오니안', en: 'Ionian', steps: [0, 2, 4, 5, 7, 9, 11], deg: [0, 1, 2, 3, 4, 5, 6], desc: '= 장음계' },
  dorian:     { id: 'dorian', kr: '도리안', en: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], deg: [0, 1, 2, 3, 4, 5, 6], desc: '단조인데 6음이 밝음 — 펑크·재즈·시티팝' },
  phrygian:   { id: 'phrygian', kr: '프리지안', en: 'Phrygian', steps: [0, 1, 3, 5, 7, 8, 10], deg: [0, 1, 2, 3, 4, 5, 6], desc: '♭2의 어두운 긴장 — 플라멩코·메탈' },
  lydian:     { id: 'lydian', kr: '리디안', en: 'Lydian', steps: [0, 2, 4, 6, 7, 9, 11], deg: [0, 1, 2, 3, 4, 5, 6], desc: '♯4의 몽환적 밝음 — 영화음악' },
  mixolydian: { id: 'mixolydian', kr: '믹솔리디안', en: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], deg: [0, 1, 2, 3, 4, 5, 6], desc: '장조인데 ♭7 — 록·블루스·펑크' },
  aeolian:    { id: 'aeolian', kr: '에올리안', en: 'Aeolian', steps: [0, 2, 3, 5, 7, 8, 10], deg: [0, 1, 2, 3, 4, 5, 6], desc: '= 자연 단음계' },
  locrian:    { id: 'locrian', kr: '로크리안', en: 'Locrian', steps: [0, 1, 3, 5, 6, 8, 10], deg: [0, 1, 2, 3, 4, 5, 6], desc: '♭2·♭5로 불안정 — 거의 쓰지 않음' },
};

// 으뜸음 선택지 (흔히 쓰는 철자)
export const ROOTS: { name: string; letter: Letter; acc: number }[] = [
  { name: 'C', letter: 'C', acc: 0 }, { name: 'D♭', letter: 'D', acc: -1 }, { name: 'D', letter: 'D', acc: 0 }, { name: 'E♭', letter: 'E', acc: -1 },
  { name: 'E', letter: 'E', acc: 0 }, { name: 'F', letter: 'F', acc: 0 }, { name: 'F♯', letter: 'F', acc: 1 }, { name: 'G', letter: 'G', acc: 0 },
  { name: 'A♭', letter: 'A', acc: -1 }, { name: 'A', letter: 'A', acc: 0 }, { name: 'B♭', letter: 'B', acc: -1 }, { name: 'B', letter: 'B', acc: 0 },
];
const ACC_TXT: Record<number, string> = { [-2]: '♭♭', [-1]: '♭', 0: '', 1: '♯', 2: '×' };

// 음계 철자: 같은 글자가 반복되지 않게(7음 음계) 올바른 ♯/♭ 이름을 붙인다.
export function spellScale(root: { letter: Letter; acc: number }, sc: ScaleDef) {
  const li = LETTERS.indexOf(root.letter);
  const rootPc = (LETTER_PC[root.letter] + root.acc + 12) % 12;
  return sc.steps.map((st, i) => {
    const letter = LETTERS[(li + sc.deg[i]) % 7];
    let acc = ((rootPc + st) - LETTER_PC[letter]) % 12;
    if (acc > 6) acc -= 12; if (acc < -6) acc += 12;
    return { letter, acc, name: letter + (ACC_TXT[acc] ?? ''), kr: SOLFEGE[letter] + (ACC_TXT[acc] ?? ''), pc: (rootPc + st) % 12 };
  });
}
