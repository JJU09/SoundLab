#!/usr/bin/env node
// 문구 검사 — .claude/writing-style.md의 규칙 중 기계로 찾을 수 있는 것만.
//   node scripts/copy-lint.mjs [경로...]        기본: src/content
//   --strict   경고도 실패로 처리
// 코드 주석, 프런트매터의 키, import 줄은 건너뛴다. 마지막 판단은 소리 내어 읽기.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ERR = [
  [/(를|을) 통해|(를|을) 통한/g, '번역투 "~를 통해" → "~로", "~해서"'],
  [/에 대해서?|에 대한/g, '번역투 "~에 대해" → "~을", "~의"'],
  [/에 있어서?[ ,]|함에 있어/g, '번역투 "~에 있어서" → "~할 때"'],
  [/에 의해|에 의한/g, '번역투 "~에 의해" → 하는 쪽을 주어로'],
  [/되어[지집]|보여[지집]|여겨[지집]|쓰여[지집]/g, '이중 피동 → "~된다", "보인다"'],
  [/것이 가능|라고 (볼|할) 수 있/g, '에두른 표현 → "~할 수 있다", "~이다"'],
  [/결론적으로|종합하면|살펴보았|시사하는 바/g, '상투적인 맺음말'],
];
const WARN = [
  [/ — /g, '줄표로 문장 잇기 → 마침표로 끊거나 조사로 잇기'],
  [/(수 있(습니다|어요|다)).*(수 있(습니다|어요|다))/g, '한 줄에 "~할 수 있다" 두 번'],
  [/(\*\*[^*]+\*\*.*){3,}/g, '한 줄에 굵은 글씨 세 개 이상'],
  [/다양한|효과적으로|혁신적|강력한/g, '뜻이 흐린 꾸밈말 → 구체적으로'],
];

const files = [];
const walk = p => { const s = statSync(p); if (s.isDirectory()) for (const f of readdirSync(p)) walk(join(p, f)); else if (['.mdx', '.md', '.ts', '.astro'].includes(extname(p))) files.push(p); };
const args = process.argv.slice(2), strict = args.includes('--strict');
const paths = args.filter(a => !a.startsWith('--'));
(paths.length ? paths : ['src/content']).forEach(walk);

let errs = 0, warns = 0;
for (const file of files) {
  const out = [];
  let front = false;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (line.trim() === '---') { front = !front && i === 0 ? true : false; return; }
    const t = line.trim();
    if (t.startsWith('//') || t.startsWith('{/*') || t.startsWith('*') || t.startsWith('import ') || t.startsWith('<!--')) return;
    if (!/[가-힣]/.test(t)) return;
    const body = t.replace(/\/\/ .*$/, '');   // 줄 끝 주석
    for (const [re, msg] of ERR) { re.lastIndex = 0; if (re.test(body)) { out.push(`  ${i + 1}  오류  ${msg}\n        ${t.slice(0, 110)}`); errs++; } }
    for (const [re, msg] of WARN) { re.lastIndex = 0; if (re.test(body)) { out.push(`  ${i + 1}  경고  ${msg}\n        ${t.slice(0, 110)}`); warns++; } }
  });
  if (out.length) console.log(`\n${file}\n${out.join('\n')}`);
}
console.log(`\n파일 ${files.length}개 · 오류 ${errs}건 · 경고 ${warns}건`);
process.exit(errs || (strict && warns) ? 1 : 0);
