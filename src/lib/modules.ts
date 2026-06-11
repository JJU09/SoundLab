export type ModuleId = 'filter' | 'drive' | 'tremolo' | 'chorus' | 'delay' | 'reverb';

export type Tier = 'easy' | 'normal' | 'hard';

export interface KnobDef {
  param: string;
  label: string;
  min: number;
  max: number;
  value: number;
  curve?: 'log' | 'lin';
  unit?: string;
  fmt?: (v: number) => string;
  tier?: Tier; // 수준별 노출 (없으면 always). easy=항상, normal=중급↑, hard=고급만
}

export interface SelectorDef {
  param: string;
  label: string;
  options: [string, string][];
  value: string;
  tier?: Tier;
}

export interface ModuleDef {
  id: ModuleId;
  name: string;
  kr: string;
  num: string;
  color: 'violet' | 'blue';
  tagline: string;
  desc: string;
  type?: { options: [string, string][]; value: string; tier?: Tier };
  knobs: KnobDef[];
  selectors?: SelectorDef[]; // type 외 추가 셀렉터 (예: 필터 Slope)
  defaultSrc: 'tone' | 'pluck' | 'noise';
  defaultWave?: OscillatorType;
}

const fHz = (v: number) => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'kHz' : Math.round(v) + 'Hz';
const fPct = (v: number) => Math.round(v) + '%';
const fMs = (v: number) => v < 1 ? Math.round(v * 1000) + 'ms' : v.toFixed(2) + 's';

export const MODULES: ModuleDef[] = [
  {
    id: 'filter', name: 'Filter', kr: '필터', num: '01', color: 'violet',
    tagline: '주파수를 골라 음색을 빚다',
    desc: '특정 주파수 대역을 통과시키거나 차단합니다. Cutoff는 경계 주파수, Resonance(Q)는 그 경계를 얼마나 강조할지 정합니다.',
    type: { options: [['lowpass', 'Low Pass'], ['highpass', 'High Pass'], ['bandpass', 'Band Pass']], value: 'lowpass', tier: 'normal' },
    knobs: [
      { param: 'freq', label: 'Cutoff', min: 30, max: 18000, value: 1200, curve: 'log', fmt: fHz, tier: 'easy' },
      { param: 'q', label: 'Resonance', min: 0.1, max: 20, value: 1, curve: 'log', fmt: v => v.toFixed(1), tier: 'normal' },
    ],
    selectors: [
      { param: 'slope', label: 'Slope (차수)', options: [['12', '-12 dB/oct'], ['24', '-24 dB/oct']], value: '12', tier: 'hard' },
    ],
    defaultSrc: 'noise',
  },
  {
    id: 'drive', name: 'Drive', kr: '디스토션', num: '02', color: 'blue',
    tagline: '파형을 눌러 배음을 깨우다',
    desc: '파형의 꼭대기를 클리핑해 없던 배음(harmonics)을 만듭니다. 깨끗한 사인파가 거칠고 두꺼운 소리로 변합니다.',
    knobs: [
      { param: 'amount', label: 'Drive', min: 0, max: 100, value: 40, fmt: fPct },
    ],
    defaultSrc: 'tone',
    defaultWave: 'sine',
  },
  {
    id: 'tremolo', name: 'Tremolo', kr: '트레몰로', num: '03', color: 'violet',
    tagline: 'LFO로 음량에 숨결을 불어넣다',
    desc: '저주파 발진기(LFO)로 음량을 주기적으로 흔듭니다. Rate는 떨림의 속도, Depth는 떨림의 깊이입니다.',
    knobs: [
      { param: 'rate', label: 'Rate', min: 0.1, max: 20, value: 5, curve: 'log', fmt: v => v.toFixed(1) + 'Hz' },
      { param: 'depth', label: 'Depth', min: 0, max: 100, value: 60, fmt: fPct },
    ],
    defaultSrc: 'tone',
    defaultWave: 'triangle',
  },
  {
    id: 'chorus', name: 'Chorus', kr: '코러스', num: '04', color: 'blue',
    tagline: '미세한 지연으로 소리를 두껍게',
    desc: '아주 짧게 지연된 복사본을 LFO로 흔들어 원음과 섞습니다. 살짝 어긋난 음정이 합쳐져 풍성해집니다.',
    knobs: [
      { param: 'rate', label: 'Rate', min: 0.1, max: 8, value: 1.5, curve: 'log', fmt: v => v.toFixed(1) + 'Hz' },
      { param: 'depth', label: 'Depth', min: 0, max: 100, value: 50, fmt: fPct },
      { param: 'mix', label: 'Mix', min: 0, max: 100, value: 50, fmt: fPct },
    ],
    defaultSrc: 'pluck',
  },
  {
    id: 'delay', name: 'Delay', kr: '딜레이', num: '05', color: 'violet',
    tagline: '시간을 되돌려 메아리를 만들다',
    desc: '신호를 일정 시간 뒤로 미뤄 메아리를 만듭니다. Feedback은 그 반복을 다시 입력으로 돌려보내 메아리 횟수를 정합니다.',
    knobs: [
      { param: 'time', label: 'Time', min: 0.02, max: 1.2, value: 0.3, curve: 'log', fmt: fMs },
      { param: 'feedback', label: 'Feedback', min: 0, max: 90, value: 40, fmt: fPct },
      { param: 'mix', label: 'Mix', min: 0, max: 100, value: 35, fmt: fPct },
    ],
    defaultSrc: 'pluck',
  },
  {
    id: 'reverb', name: 'Reverb', kr: '리버브', num: '06', color: 'blue',
    tagline: '공간의 잔향을 신호에 입히다',
    desc: '수천 개의 반사음을 합성한 임펄스와 신호를 컨볼루션해 방·홀의 잔향을 만듭니다. Size는 공간의 크기입니다.',
    knobs: [
      { param: 'size', label: 'Size', min: 0.3, max: 4, value: 1.8, fmt: v => v.toFixed(1) + 's' },
      { param: 'mix', label: 'Mix', min: 0, max: 100, value: 30, fmt: fPct },
    ],
    defaultSrc: 'pluck',
  },
];

export const MODULE_MAP = Object.fromEntries(MODULES.map(m => [m.id, m])) as Record<ModuleId, ModuleDef>;
