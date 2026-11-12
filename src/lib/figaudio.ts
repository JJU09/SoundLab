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

// 재생 버튼 하나가 여러 사건(소리·강조)을 시간 순서로 실행. 다시 누르면 멈춤.
// events의 at은 ms. 정밀한 박자가 필요한 소리는 run 안에서 오디오 시각으로 예약한다(LEAD만큼 미리 호출).
export const LEAD = 80;
export interface FigEvent { at: number; run: () => void; }
export function figPlayer(onReset: () => void) {
  let timers: number[] = [];
  let btn: HTMLElement | null = null;
  const stop = () => {
    timers.forEach(clearTimeout); timers = [];
    btn?.setAttribute('aria-pressed', 'false'); btn = null;
    onReset();
  };
  const start = (b: HTMLElement | null, events: FigEvent[], total: number) => {
    figClaim(stop); stop();
    btn = b; b?.setAttribute('aria-pressed', 'true');
    for (const e of events) timers.push(window.setTimeout(e.run, e.at));
    timers.push(window.setTimeout(stop, total));
  };
  const playing = (b: HTMLElement) => b.getAttribute('aria-pressed') === 'true';
  return { start, stop, playing };
}

// 좁은 화면(카드 안 가로 스크롤)에서 지금 울리는 요소가 보이도록 스크롤을 따라가게 한다
export function figFollow(el: Element) {
  const sc = el.closest<HTMLElement>('.overflow-x-auto');
  if (!sc || sc.scrollWidth <= sc.clientWidth) return;
  const r = el.getBoundingClientRect(), s = sc.getBoundingClientRect();
  if (r.left < s.left + 24 || r.right > s.right - 24) sc.scrollBy({ left: r.left + r.width / 2 - (s.left + s.width / 2), behavior: 'smooth' });
}
