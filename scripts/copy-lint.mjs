#!/usr/bin/env node
// 문구 검사: .claude/writing-style.md의 규칙 중 기계로 찾을 수 있는 것만.
//   node scripts/copy-lint.mjs [경로...]        기본: src/content
//   --strict   경고도 실패로 처리
//   --summary  파일별 내용 없이 규칙별 건수만
//   --notes    참고(사람이 판단할 것)도 보여 줌
// 코드 주석, import 줄은 건너뛴다. 마지막 판단은 소리 내어 읽기.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// [정규식, 메시지, 규칙 번호]
const ERR = [
  [/(를|을) 통해|(를|을) 통한/g, '번역투 "~를 통해" → "~로", "~해서"', '2-6'],
  [/에 대해서?|에 대한/g, '번역투 "~에 대해" → "~을", "~의"', '2-6'],
  [/에 있어서?[ ,]|함에 있어/g, '번역투 "~에 있어서" → "~할 때"', '2-6'],
  [/에 의해|에 의한/g, '번역투 "~에 의해" → 하는 쪽을 주어로', '2-6'],
  [/되어[지집]|보여[지집]|여겨[지집]|쓰여[지집]/g, '이중 피동 → "~된다", "보인다"', '2-6'],
  [/것이 가능|라고 (볼|할) 수 있/g, '에두른 표현 → "~할 수 있다", "~이다"', '2-6'],
  [/[가-힣](에서|에로|으로|로)의 /g, '이중 조사 "~에서의", "~로의" → 풀어 쓰기', '2-6'],
  [/[가-힣] 중 (하나|한 가지)(입|이|예|로)/g, '"~중 하나" → 빼기', '2-6'],
  [/신시사이저|신서사이저/g, '표기 → "신디사이저"', '4'],
  [/(^|[>'"])[A-Z][A-Za-z ]+ · [가-힣]/g, '"English · 한국어" 라벨 → 한국어<span class="label-en">English</span>', '6'],
  [/결론적으로|종합하면|살펴보았|시사하는 바|주목할 만/g, '상투적인 맺음말', '2-7'],
  [/수 있을 것으로 (보|예상|생각)/g, '완곡 겹치기 → 단정하거나 빼기', '2-8'],
];
const WARN = [
  [/ — /g, '줄표로 문장 잇기 → 마침표로 끊거나 조사로 잇기', '2-5'],
  [/(수 있(습니다|어요|다)).*(수 있(습니다|어요|다))/g, '한 줄에 "~할 수 있다" 두 번', '2-8'],
  [/(\*\*[^*]+\*\*.*){2,}/g, '한 문단에 굵은 글씨 두 개 이상', '3-1'],
  [/^[-*] \*\*[^*]+\*\* ?[—:-] /g, '"용어 — 설명" 글머리표 → DefCard나 문단', '3-2'],
  [/[가-힣]\)? ?→ ?\(?[가-힣].*[다요]\./g, '문장 안의 화살표 → 서술어로 풀기', '3-3'],
  [/\bvs\.?\b/gi, '"vs" → "A와 B"', '3-5'],
  [/^#{1,4} (?!.*[가-힣]란\?\s*$).*\?\s*$|^\*\*[^*]+까요\?\*\*/g, '물음 제목 → 답을 바로 쓰기', '1, 3-7'],
  [/다양한|효과적으로|혁신적|강력한|핵심|사실[ ,]|정말 |매우 /g, '잡초 낱말 → 빼거나 구체적으로', '2-13'],
  [/(으로|로) 기능|역할을 (합|해|하)|담당(합|하|해)|에 해당(합|하|해)/g, '돌려 말하는 동사 → "~입니다", "~합니다"', '2-11'],
  [/를 가지고 있|을 가지고 있|를 갖고 있|을 갖고 있/g, '"~를 가지고 있다" → "~이 있다"', '2-6'],
  [/DefCard[^>]*>[^<]*[가-힣](함|됨|냄|임|적|음)\.(?=[ <])/g, 'DefCard 본문을 명사로 끊음 → 서술어로', '2-2'],
];
const NOTE = [
  [/[가-힣]+(이|가) 아니라 [가-힣]/g, '"A가 아니라 B" 대구. 꼭 필요한지', '2-10'],
  [/마치 |처럼 [가-힣]+(죠|요|다)\./g, '비유. 사실을 먼저 말했는지', '2-3'],
  [/^(또한|따라서|즉|나아가|게다가)[ ,]/g, '문두 접속어', '2-14'],
];

// 한 문단 안에서 같은 어미가 세 번 이어지는지 (참고)
const endingRun = t => {
  const ends = [...t.matchAll(/([가-힣]{3})[.?!](?=\s|$)/g)].map(m => m[1]);
  for (let i = 0; i + 2 < ends.length; i++) if (ends[i] === ends[i + 1] && ends[i] === ends[i + 2]) return ends[i];
  return null;
};

const files = [];
const walk = p => { const s = statSync(p); if (s.isDirectory()) for (const f of readdirSync(p)) walk(join(p, f)); else if (['.mdx', '.md', '.ts', '.astro'].includes(extname(p))) files.push(p); };
const args = process.argv.slice(2);
const strict = args.includes('--strict'), summary = args.includes('--summary'), notes = args.includes('--notes');
const paths = args.filter(a => !a.startsWith('--'));
(paths.length ? paths : ['src/content']).forEach(walk);

let errs = 0, warns = 0, nts = 0;
const byRule = new Map();
const hit = (level, msg) => byRule.set(`${level}  ${msg}`, (byRule.get(`${level}  ${msg}`) || 0) + 1);

for (const file of files) {
  const out = [];
  let level = null, callout = false;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const t = line.trim();
    const lv = t.match(/<Level show="(\w+)"/); if (lv) level = lv[1];
    if (t.startsWith('</Level>')) level = null;
    if (t.startsWith('<Callout')) callout = true;
    if (t.includes('</Callout>')) { callout = false; return; }
    if (t.startsWith('//') || t.startsWith('{/*') || t.startsWith('*') || t.startsWith('import ') || t.startsWith('<!--')) return;
    if (!/[가-힣]/.test(t)) return;
    const body = t.replace(/\/\/ .*$/, '');   // 줄 끝 주석
    const add = (lvl, msg, rule) => {
      if (lvl === '오류') errs++; else if (lvl === '경고') warns++; else nts++;
      hit(lvl, `${msg}  [${rule}]`);
      if (lvl !== '참고' || notes) out.push(`  ${i + 1}  ${lvl}  ${msg}  [${rule}]\n        ${t.slice(0, 110)}`);
    };
    for (const [re, msg, rule] of ERR) { re.lastIndex = 0; if (re.test(body)) add('오류', msg, rule); }
    for (const [re, msg, rule] of WARN) { re.lastIndex = 0; if (re.test(body)) add('경고', msg, rule); }
    for (const [re, msg, rule] of NOTE) { re.lastIndex = 0; if (re.test(body)) add('참고', msg, rule); }
    // 합니다체 레벨(중급, 고급) 본문에 섞인 해요체. Callout은 화면 문구라 뺀다.
    if ((level === 'normal' || level === 'hard') && !callout && !t.startsWith('<')) {
      if (/[가-힣](죠|거든요|잖아요|에요|예요|어요|아요|해요)[.?!]/.test(body)) add('오류', '합니다체 본문에 해요체가 섞임', '1');
    }
    const run = endingRun(body);
    if (run) add('참고', `같은 어미 "${run}" 세 번 연속`, '2-14');
  });
  if (out.length && !summary) console.log(`\n${file}\n${out.join('\n')}`);
}
if (summary || byRule.size) {
  console.log('\n규칙별 건수');
  [...byRule].sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
}
console.log(`\n파일 ${files.length}개 · 오류 ${errs}건 · 경고 ${warns}건 · 참고 ${nts}건${notes ? '' : ' (--notes로 보기)'}`);
process.exit(errs || (strict && warns) ? 1 : 0);
