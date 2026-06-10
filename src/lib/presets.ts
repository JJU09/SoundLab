import type { SrcMode } from './engine';

// 프리셋의 인스턴스 정의 (id는 적용 시점에 자동 부여)
export interface PresetInstance {
  type: string;
  enabled?: boolean;
  params?: Record<string, number | string>;
}

export interface PresetState {
  src?: { mode: SrcMode; wave: OscillatorType; freq: number; tempo: number };
  master?: number;
  instances?: PresetInstance[];
}

export interface Preset {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  state: PresetState;
}

// 프리셋 = 페달보드 전체를 한 번에 구성하는 "레시피".
// instances 배열 순서 = 신호 체인 순서. 클릭 시 mergePreset → applyFullState로 적용된다.
export const PRESETS: Preset[] = [
  {
    id: 'radio', name: '라디오 스타', emoji: '📻',
    desc: '밴드패스로 대역을 좁히고 드라이브로 살짝 찌그러뜨린 옛날 라디오 음색',
    state: {
      src: { mode: 'pluck', wave: 'triangle', freq: 220, tempo: 110 },
      instances: [
        { type: 'filter', enabled: true, params: { type: 'bandpass', freq: 1500, q: 6 } },
        { type: 'drive', enabled: true, params: { amount: 35 } },
      ],
    },
  },
  {
    id: 'astronaut', name: '우주비행사', emoji: '🚀',
    desc: '긴 딜레이 피드백과 거대한 리버브로 무중력 공간에 떠 있는 듯한 사운드',
    state: {
      src: { mode: 'pluck', wave: 'sine', freq: 220, tempo: 90 },
      instances: [
        { type: 'delay', enabled: true, params: { time: 0.42, feedback: 68, mix: 50 } },
        { type: 'reverb', enabled: true, params: { size: 3.6, mix: 65 } },
      ],
    },
  },
  {
    id: 'citypop', name: '80s 시티팝', emoji: '🌆',
    desc: '코러스로 두껍게 번지고 짧은 딜레이로 반짝이는 복고풍 신스 톤',
    state: {
      src: { mode: 'pluck', wave: 'sine', freq: 220, tempo: 115 },
      instances: [
        { type: 'chorus', enabled: true, params: { rate: 1.2, depth: 60, mix: 55 } },
        { type: 'delay', enabled: true, params: { time: 0.22, feedback: 28, mix: 25 } },
      ],
    },
  },
  {
    id: 'underwater', name: '수중 음파', emoji: '🌊',
    desc: '로우패스로 고음을 깎고 느린 트레몰로로 일렁이는 물속 사운드',
    state: {
      src: { mode: 'tone', wave: 'sawtooth', freq: 220, tempo: 110 },
      instances: [
        { type: 'filter', enabled: true, params: { type: 'lowpass', freq: 600, q: 4 } },
        { type: 'tremolo', enabled: true, params: { rate: 1.4, depth: 70 } },
        { type: 'reverb', enabled: true, params: { size: 2.4, mix: 40 } },
      ],
    },
  },
  {
    id: 'stacked-filter', name: '이중 필터', emoji: '🎚️',
    desc: '같은 필터를 두 개 직렬로 — 로우패스로 깎고 다시 하이패스로 깎아 좁은 대역만 통과',
    state: {
      src: { mode: 'noise', wave: 'sine', freq: 220, tempo: 110 },
      instances: [
        { type: 'filter', enabled: true, params: { type: 'lowpass', freq: 2400, q: 2 } },
        { type: 'filter', enabled: true, params: { type: 'highpass', freq: 600, q: 2 } },
      ],
    },
  },
  {
    id: 'clean', name: '원음', emoji: '🔊',
    desc: '모든 이펙터를 비운 깨끗한 원본 신호 — 비교용 기준점',
    state: {
      src: { mode: 'tone', wave: 'sine', freq: 220, tempo: 110 },
      instances: [],
    },
  },
];
