// tests/qa/site.mjs (구 v4.mjs) — 공개판(product/commercial) 전용 분기: 워드마크·제목·소개 링크·
// 랜딩 CTA 실클릭·모바일 랜딩. main(SITE_ENABLED=false) 트리에서는 건너뛴다.
import {
	BASE,
	OUT,
	launchChrome,
	outPath,
	siteExpectations,
	Results,
	isIgnorableConsoleMessage
} from './lib.mjs';

const site = siteExpectations();
if (!site.enabled) {
	console.log('공개판 아님 — 건너뜀 (SITE_ENABLED=false)');
	process.exit(0);
}

const b = await launchChrome();
const R = new Results('site');

// ===== 공개판 전용 분기 =====
{
	const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
	const logs = [];
	p.on('pageerror', (e) => logs.push(e.message.slice(0, 100)));
	p.on('console', (m) => {
		if ((m.type() === 'error' || m.type() === 'warning') && !isIgnorableConsoleMessage(m))
			logs.push(`[${m.type()}] ${m.text().slice(0, 90)}`);
	});
	await p.goto(BASE + '/', { waitUntil: 'networkidle' });
	await p.waitForTimeout(800);
	const h = await p.evaluate(() => ({
		wm: [...document.querySelectorAll('header img, header svg')].some((e) =>
			/headroom|wordmark/i.test((e.getAttribute('src') || '') + (e.outerHTML || '').slice(0, 400))
		),
		title: document.title,
		h1: document.querySelector('h1')?.textContent.trim(),
		intro: [...document.querySelectorAll('a')].filter((a) =>
			/\/intro/.test(a.getAttribute('href') || '')
		).length
	}));
	R.add('워드마크 노출', h.wm);
	R.add(
		'대시보드 제목',
		h.title === site.dashboardTitle && h.h1 === site.dashboardTitle,
		`${h.title}/${h.h1}`
	);
	R.add('소개 링크 존재', h.intro > 0, `${h.intro}개`);
	await p.goto(BASE + '/data', { waitUntil: 'networkidle' });
	R.add('제품명', (await p.title()) === `데이터 — ${site.productName}`, await p.title());
	const r = await p.goto(BASE + '/intro', { waitUntil: 'networkidle' });
	await p.waitForTimeout(900);
	const it = (await p.locator('main').innerText()).replace(/\n+/g, ' | ');
	R.add(
		'/intro 랜딩 정상',
		r.status() === 200 && !/404/.test(it) && /DART/.test(it),
		it.slice(0, 60)
	);
	await p.screenshot({ path: outPath('v4-intro.png', OUT), fullPage: true });
	const ctas = await p.evaluate(() =>
		[...document.querySelectorAll('a')]
			.map((a) => a.getAttribute('href'))
			.filter((x) => /start=/.test(x || ''))
	);
	R.add(
		'랜딩 CTA 3종 링크',
		['pdf', 'excel', 'sample'].every((k) => ctas.some((c) => c.includes(`start=${k}`))),
		JSON.stringify([...new Set(ctas)])
	);
	R.add('공개판 콘솔/페이지 오류 없음', logs.length === 0, [...new Set(logs)].join(' || '));
}

// ===== CTA 실동작(랜딩에서 클릭) =====
for (const [name, rx] of [
	['결산서 PDF 로 시작', /PDF 를 올리면/],
	['양식 내려받기', /엑셀 템플릿/],
	['가상 회사 샘플 열어 보기', /샘플 데이터/]
]) {
	const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
	const p = await ctx.newPage();
	p.on('dialog', (d) => d.accept());
	await p.goto(BASE + '/intro', { waitUntil: 'networkidle' });
	await p.waitForTimeout(700);
	await p
		.getByRole('link', { name: new RegExp(name) })
		.first()
		.click();
	await p.waitForTimeout(2500);
	const t = (await p.locator('main').innerText()).replace(/\n+/g, ' | ');
	R.add(
		`랜딩 CTA "${name}" 동작`,
		rx.test(t) && !/[?]start=/.test(p.url()),
		`${p.url().replace(BASE, '')} "${(t.match(/[^|]*(비웠습니다|샘플 데이터)[^|]*/) || [''])[0].trim().slice(0, 45)}"`
	);
	await ctx.close();
}

// ===== 모바일 랜딩 =====
{
	const ctx = await b.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true
	});
	const p = await ctx.newPage();
	await p.goto(BASE + '/intro', { waitUntil: 'networkidle' });
	await p.waitForTimeout(800);
	const o = await p.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	R.add('모바일 랜딩 가로 스크롤 0', o === 0, `${o}px`);
	await p.screenshot({ path: outPath('v4-intro-390.png', OUT), fullPage: true });
	await ctx.close();
}

await b.close();
R.finish();
