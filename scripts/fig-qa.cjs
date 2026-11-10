// 설명 그림 품질 검사 — `npx astro preview --port 4322` 실행 중에:
//   node scripts/fig-qa.cjs <출력폴더> [레슨경로 ...]
// 1) 규칙 검사(측정): 토큰 밖 선 굵기·점선·글자 크기, 반투명 채우기, 글자 겹침, 글자–선 근접, 나란한 선 몰림, 칸 밖으로 나감
// 2) 눈 검사용 캡처: 실제 레슨 크기(데스크톱) · 모바일(390px) · 3배 확대(그림별) · 초급(simple)
// 수치 검사를 통과해도 지저분할 수 있으므로 캡처는 반드시 사람이 본다.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const OUT = process.argv[2] || 'fig-qa-out';
const BASE = 'http://localhost:4322';
const ALLOWED = { stroke: ['1', '2', '3'], dash: ['6 4', '2 3', '0 6'], font: ['16', '13', '11', '10'] }; // tokens.ts 와 맞출 것
const GAP_TEXT = 2.5, CROWD = 4, CROWD_RUN = 24;

function lessonsWithFigures() {
  const out = [];
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p); else if (f === 'index.html' && fs.readFileSync(p, 'utf8').includes('ex-panels')) out.push('/' + path.relative('dist', path.dirname(p)) + '/'); } };
  walk('dist/learn'); return out;
}

function inspect({ ALLOWED, GAP_TEXT, CROWD, CROWD_RUN }) {
  const res = [];
  const svgs = [...document.querySelectorAll('.ex .ex-panel svg')].filter(s => s.getBoundingClientRect().width > 0);
  for (const svg of svgs) {
    const name = (svg.getAttribute('aria-label') || '').slice(0, 24);
    const issues = [];
    const live = el => !el.closest('defs,pattern,marker,clipPath,mask,[data-qa="skip"]');
    const geoms = [...svg.querySelectorAll('path,line,polyline,polygon,rect,circle,ellipse')].filter(live);
    const texts = [...svg.querySelectorAll('text')].filter(live);
    const stroked = el => { const cs = getComputedStyle(el); return cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0 && cs.visibility !== 'hidden'; };
    // 토큰
    for (const el of geoms) {
      const sw = el.getAttribute('stroke-width'), da = el.getAttribute('stroke-dasharray'), op = el.getAttribute('opacity') ?? el.getAttribute('fill-opacity');
      if (sw && stroked(el) && !ALLOWED.stroke.includes(sw)) issues.push(`굵기 ${sw}`);
      if (da && !ALLOWED.dash.includes(da)) issues.push(`점선 "${da}"`);
      if (op && +op < 1 && getComputedStyle(el).fill !== 'none' && el.dataset.qa !== 'glow') issues.push(`반투명 채우기 ${el.tagName}`);
    }
    for (const t of texts) { const fs_ = t.getAttribute('font-size'); if (fs_ && !ALLOWED.font.includes(fs_)) issues.push(`글자 크기 ${fs_} "${t.textContent}"`); }
    // 글자 겹침·칸 밖
    const vb = svg.viewBox.baseVal;
    const tb = texts.filter(t => !t.getAttribute('transform')).map(t => ({ t, b: t.getBBox() }));
    for (let i = 0; i < tb.length; i++) {
      const a = tb[i].b;
      if (a.x < vb.x - 0.5 || a.y < vb.y - 0.5 || a.x + a.width > vb.x + vb.width + 0.5 || a.y + a.height > vb.y + vb.height + 0.5) issues.push(`칸 밖 "${tb[i].t.textContent}"`);
      for (let j = i + 1; j < tb.length; j++) { const c = tb[j].b;
        if (a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height) issues.push(`글자 겹침 "${tb[i].t.textContent}" / "${tb[j].t.textContent}"`); }
    }
    // 글자–선 근접 (글자 상자를 GAP 만큼 넓혀 선의 획과 닿는지)
    const sg = geoms.filter(stroked);
    for (const { t, b } of tb) {
      // 글자 실제 잉크 높이로 축소(줄간 여백 제외)
      const y0 = b.y + b.height * 0.18, y1 = b.y + b.height * 0.9;
      const pts = [];
      for (let x = b.x - GAP_TEXT; x <= b.x + b.width + GAP_TEXT; x += 2) for (let y = y0 - GAP_TEXT; y <= y1 + GAP_TEXT; y += 2) pts.push(new DOMPoint(x, y));
      for (const el of sg) {
        const sw = parseFloat(getComputedStyle(el).strokeWidth);
        el.style.strokeWidth = String(sw); // 원래 굵기 그대로 — 글자 상자를 넓혀서 간격을 잰다
        if (pts.some(p => el.isPointInStroke(p))) issues.push(`글자–선 근접 "${t.textContent}" ↔ ${el.tagName}${t.dataset.halo ? ' (할로 있음)' : ''}`);
        el.style.strokeWidth = '';
      }
    }
    // 나란한 선 몰림 (선 A 위의 점들이 선 B 에서 CROWD 이내로 CROWD_RUN 이상 이어지면)
    const lines = sg.filter(el => ['path', 'line', 'polyline'].includes(el.tagName) && el.getTotalLength() > 30);
    for (let i = 0; i < lines.length; i++) for (let j = 0; j < lines.length; j++) {
      if (i === j) continue;
      const A = lines[i], B = lines[j], L = A.getTotalLength();
      const OK = ['axis', 'ground', 'on'];
      if (OK.includes(A.dataset.qa) || OK.includes(B.dataset.qa)) continue; // 축(0으로 가라앉는 꼬리)·땅(서 있는 것)·얹힌 것(모자 등)은 원래 닿는다
      B.style.strokeWidth = String(CROWD * 2);
      let run = 0, best = 0;
      for (let s = 0; s <= L; s += 3) { const p = A.getPointAtLength(s); if (B.isPointInStroke(new DOMPoint(p.x, p.y))) { run += 3; best = Math.max(best, run); } else run = 0; }
      B.style.strokeWidth = '';
      if (best >= CROWD_RUN && i < j) issues.push(`선 몰림 ${A.tagName}↔${B.tagName} ${best}단위`);
    }
    res.push({ name, issues: [...new Set(issues)] });
  }
  return res;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const pages = process.argv.slice(3).length ? process.argv.slice(3) : lessonsWithFigures();
  const b = await chromium.launch();
  const modes = [
    { tag: 'desk', vp: { width: 1280, height: 900 }, dpr: 2, lvl: 'normal' },
    { tag: 'mob', vp: { width: 390, height: 844 }, dpr: 3, lvl: 'normal' },
    { tag: 'easy', vp: { width: 1280, height: 900 }, dpr: 2, lvl: 'easy' },
    { tag: 'zoom', vp: { width: 1280, height: 900 }, dpr: 3, lvl: 'normal' },
  ];
  const report = {};
  for (const m of modes) {
    const ctx = await b.newContext({ viewport: m.vp, deviceScaleFactor: m.dpr });
    await ctx.addInitScript(l => localStorage.setItem('sl-level', l), m.lvl);
    await ctx.route(u => !u.hostname.includes('localhost'), r => r.abort());
    const p = await ctx.newPage();
    for (const url of pages) {
      const slug = url.split('/').filter(Boolean).pop();
      await p.goto(BASE + url); await p.waitForTimeout(300);
      await p.evaluate(() => document.fonts.ready);
      await p.addStyleTag({ content: 'header.sticky{position:static!important}' }); // 고정 머리글이 캡처를 가리지 않게
      const figs = p.locator('figure.ex:visible');
      const n = await figs.count();
      if (m.tag === 'zoom') {
        const svgs = p.locator('figure.ex:visible .ex-panel svg');
        for (let i = 0; i < await svgs.count(); i++) await svgs.nth(i).screenshot({ path: `${OUT}/${slug}-zoom-${i}.png` });
        continue;
      }
      for (let i = 0; i < n; i++) await figs.nth(i).screenshot({ path: `${OUT}/${slug}-${m.tag}${n > 1 ? '-' + i : ''}.png` });
      if (m.tag === 'desk' || m.tag === 'mob') {
        const sw = await p.evaluate(() => document.documentElement.scrollWidth);
        const r = await p.evaluate(inspect, { ALLOWED, GAP_TEXT, CROWD, CROWD_RUN });
        report[`${slug}@${m.tag}`] = { scrollWidth: sw, figures: r };
      }
    }
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  let total = 0;
  for (const [k, v] of Object.entries(report)) {
    const bad = v.figures.flatMap(f => f.issues.map(i => `  [${f.name}] ${i}`));
    const wide = k.endsWith('@mob') && v.scrollWidth > 390;
    total += bad.length + (wide ? 1 : 0);
    if (k.endsWith('@desk') || wide) console.log(`${k}: ${bad.length ? bad.length + '건' : '통과'}${wide ? ` · 가로 넘침 ${v.scrollWidth}px` : ''}`), bad.forEach(x => k.endsWith('@desk') && console.log(x));
  }
  console.log(`\n총 ${total}건 · 캡처: ${OUT}`);
})();
