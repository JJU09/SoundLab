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
