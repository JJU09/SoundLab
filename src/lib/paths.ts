// 학습 경로 — 허브(주제별 백과)를 가로질러 "곡 하나"를 완성하는 순서.
// 새 경로(예: 발라드 한 곡, 로파이 비트 한 곡)는 PATHS에 항목을 추가하면 /path/<id>/ 페이지와
// 레슨 하단의 "경로에서 다음 레슨" 버튼이 자동으로 생깁니다. 레슨 id = "<hub>/<slug>".

export interface PathStage {
  id: string;
  title: string;      // 단계 이름
  goal: string;       // 이 단계에서 할 일 한 줄
  lessons: string[];  // 핵심 레슨 (순서대로) — 경로 진행·다음 버튼에 쓰임
  deeper?: string[];  // 더 깊이 가려면 (선택)
  output: string;     // 이 단계의 결과물
  checklist: string[];
  optional?: boolean; // 건너뛰어도 되는 단계
  sketch?: { tab: 'drums' | 'chords' | 'bass' | 'melody' | 'mix' | 'structure'; label: string }; // 곡 스케치 연습실에서 해 보기
}

export interface LearningPath {
  id: string;
  title: string;
  kr: string;
  genre: string;
  desc: string;
  result: string;
  stages: PathStage[];
}

export const PATHS: LearningPath[] = [
  {
    id: 'first-song',
    title: 'Your First Song',
    kr: '곡 하나 만들기',
    genre: '팝',
    desc: '리듬부터 믹스까지, 흩어진 지식을 순서대로 이어 8마디짜리 팝 곡 하나를 완성하는 길입니다. 악기를 몰라도, 악보를 읽지 못해도 시작할 수 있어요.',
    result: '드럼 · 베이스 · 코드 · 멜로디가 들어간 8마디 팝 곡 (WAV)',
    stages: [
      {
        id: 'ready',
        title: '준비',
        goal: '건반 위에서 도레미와 CDE를 찾을 수 있게 됩니다.',
        lessons: ['notation/keys'],
        deeper: ['notation/staff', 'notation/notes'],
        output: '건반에서 C(도) 찾기',
        checklist: ['흰 건반 7개의 이름을 말할 수 있다', '검은 건반이 ♯·♭인 이유를 안다'],
        optional: true,
      },
      {
        id: 'rhythm',
        title: '리듬',
        goal: '곡의 빠르기를 정하고 몸이 움직이는 드럼 루프를 만듭니다.',
        lessons: ['rhythm/beat-tempo', 'rhythm/drum-patterns'],
        deeper: ['rhythm/subdivision', 'rhythm/syncopation', 'rhythm/swing-groove'],
        output: '4마디 드럼 루프',
        sketch: { tab: 'drums', label: '스케치에서 드럼 찍기' },
        checklist: ['곡의 BPM을 정했다 (팝은 보통 90–120)', '킥·스네어·하이햇 자리를 정한 4마디 패턴이 있다'],
      },
      {
        id: 'chords',
        title: '코드',
        goal: '한 조 안에서 쓸 수 있는 코드를 고르고 4코드 진행을 만듭니다.',
        lessons: ['harmony/triads', 'harmony/diatonic-chords', 'harmony/progressions'],
        deeper: ['harmony/functions', 'harmony/sevenths', 'harmony/voice-leading'],
        output: '4코드 진행 하나',
        sketch: { tab: 'chords', label: '스케치에서 코드 고르기' },
        checklist: ['곡의 조를 정했다 (처음엔 C장조 추천)', '4개 코드를 고르고 2번 반복해 8마디를 채웠다'],
      },
      {
        id: 'melody',
        title: '멜로디',
        goal: '코드 진행 위에 부를 수 있는 멜로디를 얹습니다.',
        lessons: ['melody/major-scale', 'melody/pentatonic', 'melody/melody-writing'],
        deeper: ['melody/intervals', 'melody/circle-of-fifths'],
        output: '8마디 멜로디',
        sketch: { tab: 'melody', label: '스케치에서 멜로디 찍기' },
        checklist: ['짧은 모티브 하나를 만들고 반복·변형했다', '강박에서 코드 구성음에 착지한다', '마지막 음이 으뜸음(도)으로 끝난다'],
      },
      {
        id: 'arrange',
        title: '편곡',
        goal: '파트마다 역할을 나누고 단락별로 채우고 비웁니다.',
        lessons: ['arrangement/song-form', 'arrangement/instrument-roles', 'arrangement/density'],
        deeper: ['arrangement/voicing-range', 'arrangement/genre-recipes'],
        output: '벌스 · 코러스 섹션 지도',
        sketch: { tab: 'structure', label: '스케치에서 섹션 짜기' },
        checklist: ['벌스 4마디 · 코러스 4마디로 나눴다', '베이스 · 코드 · 멜로디 음역이 겹치지 않는다', '코러스가 벌스보다 파트가 많다'],
      },
      {
        id: 'sound',
        title: '사운드',
        goal: '베이스와 패드에 쓸 음색을 직접 만듭니다.',
        lessons: ['acoustics/tone', 'synthesis/adsr', 'synthesis/subtractive'],
        deeper: ['synthesis/modulation', 'effects/filter', 'effects/reverb'],
        output: '베이스 · 패드 음색',
        sketch: { tab: 'mix', label: '스케치에서 음색 고르기' },
        checklist: ['짧게 끊기는 음색(짧은 릴리스)과 천천히 피어오르는 음색(긴 어택)의 차이를 들어 봤다', '곡 스케치에서 파트마다 어울리는 음색을 골랐다'],
      },
      {
        id: 'mix',
        title: '믹스',
        goal: '파트의 크기와 자리를 잡고 완성 파일로 내보냅니다.',
        lessons: ['mixing/balance', 'mixing/eq-masking', 'mixing/loudness', 'mixing/export'],
        deeper: ['mixing/pan', 'mixing/compressor', 'mixing/mastering-chain'],
        output: 'WAV로 저장한 완성곡',
        sketch: { tab: 'mix', label: '스케치에서 믹스하고 WAV 저장' },
        checklist: ['보컬(멜로디)이 가장 잘 들린다', '킥과 베이스가 서로 가리지 않는다', '피크가 0dBFS를 넘지 않는다', '곡 스케치에서 WAV로 저장했다'],
      },
    ],
  },
];

export const pathById = (id: string) => PATHS.find(p => p.id === id);

// 레슨이 속한 경로 위치 — 레슨 하단 "경로에서 다음 레슨" 버튼용 (핵심 레슨만)
export function pathPositions(topicId: string) {
  const out: { path: LearningPath; stageIdx: number; stage: PathStage; next: string | null; nextStage: PathStage | null; step: number; total: number }[] = [];
  for (const path of PATHS) {
    const flat = path.stages.flatMap(s => s.lessons.map(l => ({ l, s })));
    const i = flat.findIndex(x => x.l === topicId);
    if (i < 0) continue;
    const stageIdx = path.stages.indexOf(flat[i].s);
    out.push({
      path, stageIdx, stage: flat[i].s,
      next: flat[i + 1]?.l ?? null,
      nextStage: flat[i + 1] && flat[i + 1].s !== flat[i].s ? flat[i + 1].s : null,
      step: i + 1, total: flat.length,
    });
  }
  return out;
}
