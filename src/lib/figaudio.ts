// 도식(읽는 그림)에서 쓰는 공용 오디오 — 페이지당 AudioCore 하나, 한 번에 한 도식만 재생.
import { AudioCore } from '../audio/core';
import { playKey } from '../audio/keys';

let core: AudioCore | null = null;
let stopCurrent: (() => void) | null = null;

export async function figCore() {
  core ??= new AudioCore();
  await core.resume();
  return core;
}

// 코드(여러 음)를 한 번 울림
export async function figChord(midi: number[], dur = 1.4) {
  const c = await figCore();
  for (const m of midi) playKey(c, m, c.ctx.currentTime + 0.01, dur, 0.2);
}

// 재생을 시작하는 도식은 자기 정지 함수를 등록 — 다른 도식이 시작하면 먼저 멈춘다
export function figClaim(stop: (() => void) | null) {
  if (stopCurrent && stopCurrent !== stop) stopCurrent();
  stopCurrent = stop;
}
