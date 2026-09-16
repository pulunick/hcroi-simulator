// tests/qa/branch.mjs (구 v3-main.mjs) — 브랜치 분기(main/product 어느 트리에서든 SITE_ENABLED 를 읽어
// 기대값을 자동으로 고른다) · `?start=` 3종 · 증감 색 · 다크 입력칸 테두리.
import { BASE, OUT, launchChrome, outPath, siteExpectations, Results } from './lib.mjs';

const site = siteExpectations();
const b = await launchChrome();
const R = new Results('branch');
const GREY = (c) => {
	const m = c.match(/\d+/g);
	if (!m) return false;
	const [r, g, bl] = m.map(Number);
	return Math.max(r, g, bl) - Math.min(r, g, bl) < 30; // 채도 낮음 = 중립
};

// ===== 브랜치별 분기(워드마크·제목·소개 링크·제품명·/intro) — SITE_ENABLED 로 기대값 자동 선택 =====
{
	const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
	await p.goto(BASE + '/', { waitUntil: 'networkidle' });
	await p.waitForTimeout(800);
	const h = await p.evaluate(() => ({
		wordmark: [...document.querySelectorAll('header img, header use, header svg')].some((e) =>
			/headroom|wordmark/i.test(
				(e.getAttribute('src') || '') +
					(e.getAttribute('href') || '') +
					(e.outerHTML || '').slice(0, 300)
			)
		),
		title: document.title,
		h1: document.querySelector('h1')?.textContent.trim(),
		intro: [...document.querySelectorAll('a')].some((a) =>
			/\/intro/.test(a.getAttribute('href') || '')
		)
	}));
	R.add(
		`워드마크 유무(SITE_ENABLED=${site.enabled})`,
		h.wordmark === site.enabled,
		`wordmark=${h.wordmark}`
	);
	R.add(
		'대시보드 제목',
		h.title === site.dashboardTitle && h.h1 === site.dashboardTitle,
		`${h.title} / ${h.h1}`
	);
	R.add(
		`소개 링크 유무(SITE_ENABLED=${site.enabled})`,
		h.intro === site.enabled,
		`intro=${h.intro}`
	);

	await p.goto(BASE + '/data', { waitUntil: 'networkidle' });
	R.add('제품명', (await p.title()) === `데이터 — ${site.productName}`, await p.title());

	const r = await p.goto(BASE + '/intro', { waitUntil: 'networkidle' });
	await p.waitForTimeout(700);
	const it = (await p.locator('body').innerText()).replace(/\n+/g, ' | ');
	if (site.enabled) {
		R.add('/intro 정상 노출', r.status() === 200 && !/404/.test(it), `HTTP ${r.status()}`);
	} else {
		R.add('/intro 404(사내 배포)', /404/.test(it), `HTTP ${r.status()}`);
	}
}

// ===== `?start=` 3종 =====
for (const [q, path, expect] of [
	['pdf', '/data?start=pdf', /비웠습니다|PDF/],
	['excel', '/data?start=excel', /비웠습니다|엑셀/],
	['sample', '/?start=sample', /샘플/]
]) {
	const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
	const p = await ctx.newPage();
	p.on('dialog', (d) => d.accept());
	await p.goto(BASE + path, { waitUntil: 'networkidle' });
	await p.waitForTimeout(2200);
	const t = (await p.locator('main').innerText()).replace(/\n+/g, ' | ');
	const rows = await p
		.locator('table tbody tr')
		.count()
		.catch(() => -1);
	const url = p.url();
	const cleared = q === 'sample' ? true : rows <= 2;
	R.add(
		`?start=${q}`,
		expect.test(t) && cleared,
		`행수=${rows} url=${url.replace(BASE, '')} 안내="${(t.match(/[^|]*(비웠습니다|샘플 데이터)[^|]*/) || [''])[0].trim().slice(0, 50)}"`
	);
	R.add(`?start=${q} 쿼리 제거`, !/[?]start=/.test(url), url.replace(BASE, ''));
	await p.screenshot({ path: outPath(`v3-start-${q}.png`, OUT), fullPage: true });
	await ctx.close();
}

// ===== #14: 증감 색값 =====
{
	const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
	const p = await ctx.newPage();
	await p.goto(BASE + '/simulator', { waitUntil: 'networkidle' });
	await p.waitForTimeout(900);
	const rows = await p.evaluate(() => {
		const out = [];
		for (const tr of document.querySelectorAll('table tbody tr')) {
			const lab = tr.cells[0]?.innerText.trim().split('\n')[0];
			if (!/인건비|임직원/.test(lab || '')) continue;
			out.push({
				lab,
				// "+4명" 뿐 아니라 "↑ +4명" 처럼 부호 앞에 다른 문자가 오는 표기도 잡도록 느슨하게 매칭한다.
				d: [...tr.cells]
					.slice(1)
					.map((td) => ({
						t: td.innerText.trim(),
						c: getComputedStyle(td.querySelector('*') || td).color
					}))
					.filter((x) => /[+-]\s?\d/.test(x.t))
			});
		}
		return out;
	});
	for (const r0 of rows) {
		const isHc = /임직원/.test(r0.lab);
		// 매칭된 셀이 하나도 없으면 판정 불가 — every() 의 공허 참(vacuous true)으로 조용히 PASS 처리하지 않는다.
		const ok = r0.d.length > 0 && r0.d.every((x) => (isHc ? GREY(x.c) : !GREY(x.c)));
		R.add(
			`#14 ${r0.lab}`,
			ok,
			r0.d.length ? r0.d.map((x) => `${x.t}=${x.c}`).join(' ') : '매칭 셀 없음'
		);
	}
	await p.screenshot({ path: outPath('v3-sim.png', OUT), fullPage: true });

	await p.goto(BASE + '/', { waitUntil: 'networkidle' });
	await p.waitForTimeout(800);
	const tile = await p.evaluate(() => {
		const el = [...document.querySelectorAll('*')].find(
			(e) => e.children.length === 0 && /^[+-]\d+명 vs/.test(e.textContent.trim())
		);
		return el ? { t: el.textContent.trim(), c: getComputedStyle(el).color } : null;
	});
	R.add(
		'#14 대시보드 임직원 타일',
		!!tile && GREY(tile.c),
		tile ? `${tile.t}=${tile.c}` : '못 찾음'
	);

	await p.goto(BASE + '/report', { waitUntil: 'networkidle' });
	await p.waitForTimeout(900);
	const kpi = await p.evaluate(() => {
		const el = [...document.querySelectorAll('*')].find(
			(e) => e.children.length === 0 && /^전년 [+-]\d+명$/.test(e.textContent.trim())
		);
		return el ? { t: el.textContent.trim(), c: getComputedStyle(el).color } : null;
	});
	R.add(
		'#14 리포트 임직원 KPI(해당 표기 없으면 통과)',
		!kpi || GREY(kpi.c),
		kpi ? `${kpi.t}=${kpi.c}` : '해당 표기 없음'
	);
}

// ===== 다크 모드 입력칸 테두리 =====
{
	const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
	const p = await ctx.newPage();
	await p.goto(BASE + '/settings', { waitUntil: 'networkidle' });
	await p.waitForTimeout(600);
	await p.getByText('어둡게', { exact: true }).click();
	await p.waitForTimeout(500);
	await p.goto(BASE + '/', { waitUntil: 'networkidle' });
	await p.waitForTimeout(800);
	const bd = await p.evaluate(() => {
		const i = document.querySelector('.field-input, main input');
		return i ? { bc: getComputedStyle(i).borderColor, bw: getComputedStyle(i).borderWidth } : null;
	});
	R.add(
		'다크 입력칸 테두리',
		!!bd && bd.bw !== '0px' && bd.bc !== 'rgba(0, 0, 0, 0)',
		JSON.stringify(bd)
	);
	await p.screenshot({ path: outPath('v3-dark-dash.png', OUT), fullPage: true });
}

await b.close();
R.finish();
