// tests/qa/dark.mjs (구 v2-dark.mjs) — 다크 모드 스윕: 설정에서 전환 후 7화면이 모두 다크를 유지하는지,
// 콘솔/페이지 오류가 없는지 확인한다.
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
const b = await launchChrome();
const p = await (await b.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const logs = [];
p.on('pageerror', (e) => logs.push(e.message.slice(0, 120)));
p.on('console', (m) => {
	if ((m.type() === 'error' || m.type() === 'warning') && !isIgnorableConsoleMessage(m))
		logs.push(`[${m.type()}] ${m.text().slice(0, 120)}`);
});
const R = new Results('dark');

await p.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await p.waitForTimeout(700);
await p.getByText('어둡게', { exact: true }).click();
await p.waitForTimeout(500);
const theme = await p.evaluate(() => document.documentElement.dataset.theme);
R.add('다크 모드로 전환됨', theme === 'dark', `theme=${theme}`);

for (const [n, path] of [
	['dash', '/'],
	['data', '/data'],
	['sim', '/simulator'],
	['report', '/report'],
	['guide', '/guide'],
	['intro', '/intro'],
	['settings', '/settings']
]) {
	// /intro 는 사내 배포(SITE_ENABLED=false)에서 의도적으로 404 를 낸다 — 그 404 로 인한
	// 콘솔/HTTP 로그는 오류로 세지 않는다(sweep.mjs 의 is404Intro 와 같은 처리).
	const is404Intro = n === 'intro' && !site.enabled;
	const logsBefore = logs.length;
	await p.goto(BASE + path, { waitUntil: 'networkidle' });
	await p.waitForTimeout(600);
	if (is404Intro) logs.length = logsBefore;
	await p.screenshot({ path: outPath(`d-${n}.png`, OUT), fullPage: true });
	const c = await p.evaluate(() => {
		const s = getComputedStyle(document.body);
		return { bg: s.backgroundColor, fg: s.color, theme: document.documentElement.dataset.theme };
	});
	console.log(n, JSON.stringify(c));
	if (n === 'intro') {
		// /intro 는 사내 배포에서 404 라 앱 테마 적용 대상이 아닐 수 있다 — 존재할 때만 판정한다.
		const h1 = await p
			.locator('h1')
			.first()
			.textContent()
			.catch(() => '');
		const is404 = /404|찾을 수 없|없습니다/.test(h1 || '');
		if (!is404) R.add(`${n} 다크 유지`, c.theme === 'dark', JSON.stringify(c));
	} else {
		R.add(`${n} 다크 유지`, c.theme === 'dark', JSON.stringify(c));
	}
}

R.add(
	'다크 스윕 콘솔/페이지 오류 없음',
	logs.length === 0,
	[...new Set(logs)].join(' || ').slice(0, 300)
);
await b.close();
R.finish();
