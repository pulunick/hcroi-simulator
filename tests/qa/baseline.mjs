// tests/qa/baseline.mjs (구 v3-base.mjs) — 기준선 3종 + 회귀 스팟:
//   1) 리포트 A4 정확히 1장  2) 엑셀 내보내기 → 전체 삭제 → 가져오기 왕복(6행 이상, 오류 0)
//   3) 390px 가로 스크롤 0. 그 외 표 잘림·모바일 탭 노출·행 클릭 스크롤·오류 레코드 제외 회귀도 함께 본다.
import fs from 'fs';
import { BASE, OUT, launchChrome, outPath, Results, isIgnorableConsoleMessage } from './lib.mjs';

const b = await launchChrome();
const R = new Results('baseline');
const pageCount = (f) =>
	(
		fs
			.readFileSync(f)
			.toString('latin1')
			.match(/\/Type\s*\/Page[^s]/g) || []
	).length;

// 데스크톱 기준선 + 회귀
{
	const ctx = await b.newContext({
		viewport: { width: 1440, height: 1000 },
		acceptDownloads: true
	});
	const p = await ctx.newPage();
	const dlg = [];
	p.on('dialog', async (d) => {
		dlg.push(d.message());
		await d.accept();
	});
	const logs = [];
	p.on('pageerror', (e) => logs.push(e.message.slice(0, 100)));
	p.on('console', (m) => {
		if ((m.type() === 'error' || m.type() === 'warning') && !isIgnorableConsoleMessage(m))
			logs.push(`[${m.type()}] ${m.text().slice(0, 90)}`);
	});
	await p.goto(BASE + '/report', { waitUntil: 'networkidle' });
	await p.waitForTimeout(900);
	const reportPdf = outPath('b-report.pdf', OUT);
	await p.pdf({ format: 'A4', printBackground: true, path: reportPdf });
	R.add('기준선 리포트 A4 1장', pageCount(reportPdf) === 1, `${pageCount(reportPdf)}장`);

	await p.goto(BASE + '/data', { waitUntil: 'networkidle' });
	await p.waitForTimeout(700);
	const tbl = await p.evaluate(() => {
		const t = document.querySelector('table');
		return { tw: t.scrollWidth, ww: t.parentElement.clientWidth };
	});
	R.add('#6 표 잘림 없음', tbl.tw <= tbl.ww, JSON.stringify(tbl));

	const xlsxPath = outPath('rt.xlsx', OUT);
	const [dl] = await Promise.all([
		p.waitForEvent('download'),
		p.getByRole('button', { name: '엑셀 내보내기' }).click()
	]);
	await dl.saveAs(xlsxPath);
	await p.getByRole('button', { name: '전체 삭제' }).click();
	await p.waitForTimeout(700);
	await p.locator('input[type=file]').first().setInputFiles(xlsxPath);
	await p.waitForTimeout(3000);
	const m = (await p.locator('main').innerText()).match(/정상 (\d+)행 · 오류 (\d+)행/);
	R.add('기준선 엑셀 왕복', !!m && +m[1] >= 6 && m[2] === '0', m ? m[0] : '없음');
	R.add('데스크톱 콘솔/페이지 오류 없음', logs.length === 0, [...new Set(logs)].join(' || '));
	await ctx.close();
}

// #2 오류 레코드 제외 회귀
{
	const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
	const p = await ctx.newPage();
	p.on('dialog', (d) => d.accept());
	await p.goto(BASE + '/data', { waitUntil: 'networkidle' });
	await p.waitForTimeout(700);
	await p.getByRole('button', { name: '추가', exact: true }).click();
	await p.waitForTimeout(600);
	const lab = p.locator('label:has-text("영업비용")').first();
	const id = await lab.getAttribute('for');
	await p.locator(`#${id}`).fill('1000000000');
	await p.locator(`#${id}`).dispatchEvent('change');
	await p.waitForTimeout(600);
	await p.goto(BASE + '/', { waitUntil: 'networkidle' });
	await p.waitForTimeout(900);
	const t = (await p.locator('main').innerText()).replace(/\n+/g, ' | ');
	R.add(
		'#2 오류 레코드 지표 제외 회귀',
		/입력 오류/.test(t) && !/4\.8\d배/.test(t),
		(t.match(/[^|]*입력 오류[^|]*/) || [''])[0].trim().slice(0, 50)
	);
	await ctx.close();
}

// 모바일
{
	const ctx = await b.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true
	});
	const p = await ctx.newPage();
	let over = 0;
	for (const path of ['/', '/data', '/simulator', '/report', '/settings', '/guide']) {
		await p.goto(BASE + path, { waitUntil: 'networkidle' });
		await p.waitForTimeout(600);
		const o = await p.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		if (o > over) over = o;
	}
	R.add('기준선 390px 가로 스크롤 0', over === 0, `최대 ${over}px`);

	await p.goto(BASE + '/data', { waitUntil: 'networkidle' });
	await p.waitForTimeout(700);
	const nav = await p.evaluate(() => {
		const a = [...document.querySelectorAll('header a')];
		return {
			t: a.length,
			v: a.filter((x) => {
				const r = x.getBoundingClientRect();
				return r.x >= 0 && r.right <= innerWidth && r.width > 0;
			}).length
		};
	});
	R.add('#7 모바일 탭 전부 노출', nav.v === nav.t, `${nav.v}/${nav.t}`);

	const y0 = await p.evaluate(() => scrollY);
	await p.locator('table tbody tr').nth(1).click();
	await p.waitForTimeout(900);
	const y1 = await p.evaluate(() => scrollY);
	R.add('#8 행 클릭 스크롤', y1 > y0, `${y0}→${y1}`);
	await ctx.close();
}

await b.close();
R.finish();
