import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 5대 지식 허브 — 디렉터리(src/content/topics/<hub>/)와 일치
export const HUBS = ['acoustics', 'digital', 'synthesis', 'effects', 'mixing'] as const;
export type Hub = (typeof HUBS)[number];

// 허브 메타 (내비·라벨·순서). 코드 단일 소스.
export const HUB_META: Record<Hub, { kr: string; label: string; order: number; desc: string }> = {
  acoustics: { kr: '소리와 파동', label: 'Acoustics', order: 1, desc: '소리의 본질을 눈으로 보다' },
  digital:   { kr: '디지털오디오', label: 'Digital Audio', order: 2, desc: '컴퓨터가 소리를 다루는 법' },
  synthesis: { kr: '신디시스', label: 'Synthesis', order: 3, desc: '무에서 소리를 창조하다' },
  effects:   { kr: '이펙트', label: 'Effects', order: 4, desc: '소리를 빚고 가공하다' },
  mixing:    { kr: '믹싱', label: 'Mixing', order: 5, desc: '여러 소리를 조화롭게 섞다' },
};

// 허브별 샌드박스 (경로는 base 제외 슬러그, name은 표시용). 샌드박스 완성 시 등록.
// Base.astro 내비와 TopicLayout 크로스링크가 공유하는 단일 소스.
export const SANDBOX_OF: Partial<Record<Hub, { path: string; name: string }>> = {
  acoustics: { path: 'sandbox/waves/', name: '파동 실험실' },
  digital:   { path: 'sandbox/lofi/', name: '로파이 실험실' },
  synthesis: { path: 'sandbox/synth/', name: '신디사이저' },
  effects:   { path: 'sandbox/effects/', name: '모듈러 페달보드' },
  mixing:    { path: 'sandbox/mixer/', name: '미니 믹서' },
};

// 위젯 타입 — MDX가 어떤 인터랙티브 컴포넌트를 띄울지 결정
export const WIDGETS = ['effect', 'synth', 'subtractive', 'additive', 'fm', 'modulation', 'phase', 'beats', 'tone', 'comb', 'bitcrush', 'samplerate', 'aliasing', 'level', 'mixer', 'none'] as const;

const topics = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/topics' }),
  schema: z.object({
    hub: z.enum(HUBS),
    title: z.string(),
    kr: z.string(),
    order: z.number(),                          // 허브 내 순서 (prev/next 파생)
    color: z.enum(['violet', 'blue']).default('violet'),
    tagline: z.string(),
    desc: z.string(),
    widget: z.enum(WIDGETS).default('none'),
    // 위젯별 초기 설정. effect → { moduleId }, synth → ADSR 등. 위젯이 자체 해석.
    widgetConfig: z.record(z.string(), z.any()).optional(),
    quiz: z.string().optional(),                // QUIZZES 키 (없으면 퀴즈 생략)
    scaffold: z.boolean().default(false),       // 수준별 동적 스캐폴딩(Easy/Normal/Hard) 활성
    draft: z.boolean().default(false),
  }),
});

// 용어집 — "X란?" SEO 진입점. 토픽과 분리(간결 정의 + 라이브 위젯 + 토픽 크로스링크).
const glossary = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/glossary' }),
  schema: z.object({
    term: z.string(),                           // 한글 표제 (에일리어싱)
    en: z.string(),                             // 영문 (Aliasing)
    hub: z.enum(HUBS),                          // 분류·관련 샌드박스 파생
    definition: z.string(),                     // 1~2문장 정의(답변 먼저, 스니펫·meta 공용)
    widget: z.enum(WIDGETS).default('none'),    // 라이브 위젯 임베드(TopicWidget 재사용)
    widgetConfig: z.record(z.string(), z.any()).optional(),
    relatedTopic: z.string().optional(),        // "digital/aliasing" — 더 알아보기 링크
    relatedTerms: z.array(z.string()).optional(), // 관련 용어 slug
    aliases: z.array(z.string()).optional(),    // 검색 변형어(메타 keywords 등)
    order: z.number().default(0),
    draft: z.boolean().default(false),
  }),
});

export const collections = { topics, glossary };
