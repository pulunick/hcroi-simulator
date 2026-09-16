// tests/qa/sweep.mjs (구 v2-sweep.mjs) — 7화면 스윕: 탭 제목·h1·헤더 링크·워드마크·표 폭·가로 초과·콘솔/HTTP 오류·스크린샷.
// env: BASE(dev 서버) · OUT(스크린샷 위치) · TAG(파일명 접두) · W(뷰포트 폭, 500 미만이면 모바일 취급)
import {
	BASE,
	OUT,
	launchChrome,
	outPath,
	siteExpectations,
	Results,
	IGNORABLE_LOG_RE,
	isIgnorableConsoleMessage
} from './lib.mjs';

const TAG = process.env.TAG || 'p';
const W = Number(process.env.W || 1440);
const pages = [
	['intro', '/intro'],
	['dashboard', '/'],
	['data', '/data'],
	['simulator', '/simulator'],
	['report', '/report'],
	['settings', '/settings'],
	['guide', '/guide']
];

const site = siteExpectations();
const browser = await launchChrome();
const ctx = await browser.newContext({
	viewport: { width: W, height: W < 500 ? 844 : 900 },
	isMobile: W < 500,
	hasTouch: W < 500
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => {
	if ((m.type() === 'error' || m.type() === 'warning') && !isIgnorableConsoleMessage(m))
		logs.push(`[${m.type()}] ${m.text().slice(0, 160)}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message.slice(0, 160)}`));
page.on('response', (r) => {
	if (r.status() >= 400 && !IGNORABLE_LOG_RE.test(r.url()))
		logs.push(`[http ${r.status()}] ${r.url().slice(-60)}`);
});

const R = new Results(`sweep ${TAG} W=${W}`);

for (const [name, path] of pages) {
	// /intro 는 사내 배포(SITE_ENABLED=false)에서 의도적으로 404 를 낸다 — 그 404 자체는 오류로 세지 않는다.
	const is404Intro = name === 'intro' && !site.enabled;
	const logsBefore = logs.length;
	await page.goto(BASE + path, { waitUntil: 'networkidle' });
	await page.waitForTimeout(600);
	if (is404Intro) logs.length = logsBefore; // 예상된 404 로 인한 콘솔/HTTP 로그는 버린다
	await page.screenshot({ path: outPath(`${TAG}-${name}-${W}.png`, OUT), fullPage: true });
	const d = await page.evaluate(() => {
		const overflowing = [...document.querySelectorAll('table')].map((t) => {
			const w = t.parentElement;
			return {
				tw: t.scrollWidth,
				ww: w?.clientWidth,
				cue: w ? (w.className.match(/scroll|overflow|fade/) || [''])[0] : ''
			};
		});
		return {
			title: document.title,
			scrollW: document.documentElement.scrollWidth,
			clientW: document.documentElement.clientWidth,
			h1: [...document.querySelectorAll('h1')].map((e) => e.textContent.trim()).slice(0, 2),
			navLinks: [...document.querySelectorAll('header a')]
				.map((e) => e.textContent.trim())
				.filter(Boolean),
			// 아이콘 svg 는 모든 화면(main 포함)에 있으므로 워드마크 여부는 파일명/alt 로 가려낸다.
			wordmark: [...document.querySelectorAll('header img, header svg')].some((e) =>
				/headroom|wordmark/i.test(
					(e.getAttribute('src') || '') +
						(e.getAttribute('alt') || '') +
						(e.outerHTML || '').slice(0, 300)
				)
			),
			tables: overflowing
		};
	});
	console.log(JSON.stringify({ p: name, ...d }));

	// /intro 는 사내 배포(SITE_ENABLED=false)에서 404 화면이라 나머지 검사는 건너뛴다.
	if (is404Intro) {
		R.add(
			`${name} 404(사내 배포)`,
			/404/i.test(d.title) || d.h1.some((h) => /404|찾을 수 없|없습니다/.test(h)),
			d.title
		);
		continue;
	}

	R.add(`${name} 탭 제목 존재`, !!d.title, d.title);
	R.add(`${name} h1 존재`, d.h1.length > 0, d.h1.join(' / '));
	if (name !== 'intro') {
		// 소개 페이지는 앱 헤더가 아닌 자체 헤더/네비를 그린다(+layout.svelte 참고).
		R.add(`${name} 헤더 링크 존재`, d.navLinks.length > 0, `${d.navLinks.length}개`);
		R.add(
			`${name} 워드마크 유무(SITE_ENABLED=${site.enabled})`,
			d.wordmark === site.enabled,
			`wordmark=${d.wordmark}`
		);
	}
	R.add(
		`${name} 표 가로 잘림 없음`,
		// 모바일(W<500)은 표 래퍼에 overflow-x-auto 로 가로 스크롤을 의도적으로 두므로(cue 매치),
		// 그 경우는 표 자체가 래퍼보다 넓어도 통과 — 문서 가로 스크롤 0 은 아래 항목이 따로 본다.
		d.tables.every((t) => t.ww == null || t.tw <= t.ww + 1 || (W < 500 && t.cue)),
		JSON.stringify(d.tables)
	);
	R.add(`${name} 문서 가로 스크롤 없음`, d.scrollW <= d.clientW + 1, `${d.scrollW} / ${d.clientW}`);
}

R.add('콘솔/HTTP 오류 없음', logs.length === 0, [...new Set(logs)].join(' || ').slice(0, 300));
await browser.close();
R.finish();
