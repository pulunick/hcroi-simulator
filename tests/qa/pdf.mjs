// tests/qa/pdf.mjs (구 v3-pdf.mjs) — 결산서 PDF 가져오기 카드의 기간 구간 판정.
// env: PDF1, PDF2 (로컬 결산서 PDF 경로) — 둘 다 없으면 건너뛴다.
// 주의: 출력에는 구간 라벨(예: "3개월"·"누적")과 PASS/FAIL 만 남긴다 — 회사명·금액·인원 수치는 절대 찍지 않는다.
import { BASE, launchChrome, outPath, OUT, skipIfMissingFile, Results } from './lib.mjs';

const targets = [
	['A', process.env.PDF1],
	['B', process.env.PDF2]
].filter(([, pdf]) => pdf);

if (targets.length === 0 || targets.every(([, pdf]) => skipIfMissingFile(pdf, 'PDF1/PDF2'))) {
	console.log('PDF 없음 — 건너뜀');
	process.exit(0);
}

const b = await launchChrome();
const R = new Results('pdf');

for (const [tag, PDF] of targets) {
	if (skipIfMissingFile(PDF, `PDF${tag}`)) continue;
	const ctx = await b.newContext({ viewport: { width: 1440, height: 1200 } });
	const p = await ctx.newPage();
	let hasPageError = false;
	p.on('pageerror', () => {
		hasPageError = true;
	});
	p.on('dialog', (d) => d.accept());
	await p.goto(BASE + '/data', { waitUntil: 'networkidle' });
	await p.waitForTimeout(800);
	await p.getByRole('button', { name: '결산서 PDF 가져오기' }).click();
	await p.waitForTimeout(500);
	const ins = p.locator('input[type=file]');
	let target = null;
	for (let i = 0; i < (await ins.count()); i++) {
		const a = await ins.nth(i).getAttribute('accept');
		if ((a || '').includes('pdf')) {
			target = ins.nth(i);
			break;
		}
	}
	await target.setInputFiles(PDF);
	await p.waitForTimeout(11000);
	// 스크린샷은 산출물 폴더(gitignore 처리)에만 남고 커밋되지 않는다 — 회사명·수치가 찍혀도 저장소에는 남지 않는다.
	await p.screenshot({ path: outPath(`v3-pdf-${tag}.png`, OUT), fullPage: true });

	// 후보 셀렉트의 "구간" 표기만 뽑는다(예: "3개월"·"누적") — 금액·회사명은 옵션 텍스트에 없으므로 안전하다.
	const spans = await p.evaluate(() => {
		const sel = [...document.querySelectorAll('select')];
		const grab = (s) => {
			const v = s.selectedOptions[0]?.text || '';
			const m = v.match(/·\s*([^·]*?(누적|3개월|분기|반기|연간|기)[^·]*)\s*·/);
			return m ? m[1].trim() : (v.match(/(3개월|누적)/) || [''])[0];
		};
		return sel
			.map((s) => ({
				n: s.closest('label')?.innerText.split('\n')[0]?.trim() || '',
				span: grab(s)
			}))
			.filter((x) => x.span);
	});
	const loss = spans.slice(0, 3).map((x) => x.span);
	const hc = spans.slice(3).map((x) => x.span);
	const mixed = hc.some((h) => /3개월/.test(h)) && loss.some((l) => /누적/.test(l));
	R.add(
		`PDF-${tag} 기간 기준 통일`,
		!mixed,
		`손익구간=${JSON.stringify(loss)} 인건비구간=${JSON.stringify(hc)}`
	);
	R.add(`PDF-${tag} 페이지 오류 없음`, !hasPageError);
	await ctx.close();
}

await b.close();
R.finish();
