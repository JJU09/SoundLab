// 오디오 레이어 공유 타입.
export type SrcMode = 'tone' | 'pluck' | 'noise';

// 이펙트 인스턴스의 오디오 노드 묶음 (dry/wet 셸 + 타입별 노드).
export interface FxModule {
  input: GainNode;
  output: GainNode;
  dry: GainNode;
  wet: GainNode;
  kind: 'series' | 'parallel';
  enabled: boolean;
  mix: number;
  type?: string;
  params?: Record<string, number | string>;
  // 타입별 노드 (해당 이펙트에만 존재)
  bq?: BiquadFilterNode;
  bq2?: BiquadFilterNode; // 필터 차수(Slope) 2단
  slope?: number;
  shaper?: WaveShaperNode;
  post?: GainNode;
  trem?: GainNode;
  lfo?: OscillatorNode;
  depthG?: GainNode;
  delay?: DelayNode;
  fb?: GainNode;
  conv?: ConvolverNode;
}

export interface InstanceState {
  id: string;
  type: string;
  enabled: boolean;
  params: Record<string, number | string>;
}

export interface EngineState {
  src: { mode: SrcMode; wave: OscillatorType; freq: number; tempo: number };
  master: number;
  instances: InstanceState[]; // 순서 = 신호 체인 순서
}
