// tests/qa/items.mjs (구 v2-items.mjs) — 개별 QA 항목: 기간 추가·복사됨 칩·인원 0·오류 레코드·
// 합산 없음·전체 삭제·데이터 지우기 후 리포트.
import { BASE, OUT, launchChrome, outPath, Results } from './lib.mjs';

const browser = await launchChrome();
const ctx = await browser.newContext({
	viewport: { width: 1440, height: 1000 },
	acceptDownloads: true
});
const page = await ctx.newPage();
const dialogs = [];
page.on('dialog', async (d) => {
	dialogs.push(d.message());
	await d.accept();
});
const errs = [];
page.on('pageerror', (e) => errs.push(e.message.slice(0, 140)));
const R = new Results('items');
const txt = async () => (await page.locator('main').innerText()).replace(/\n+/g, ' | ');

// ---- 4 · 5 : 기간 추가 ----
await page.goto(BASE + '/data', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const yearBox = page.locator('#new-year');
const before = await yearBox.inputValue();
await page.getByRole('button', { name: '추가', exact: true }).click();
await page.waitForTimeout(600);
const after = await yearBox.inputValue();
R.add('#4 기간 추가 후 다음 연도', Number(after) === Number(before) + 1, `${before} → ${after}`);
const lastRow = (await page.locator('table tbody tr').last().innerText()).replace(/\s+/g, ' ');
R.add('#5 복사됨 칩', /복사|확인/.test(lastRow), lastRow.slice(0, 90));

// ---- 3 : 인원 0 ----
async function setByLabel(labelText, value) {
	const lab = page.locator(`label:has-text("${labelText}")`).first();
	const id = await lab.getAttribute('for');
	if (!id) return false;
	await page.locator(`#${id}`).fill(String(value));
	await page.locator(`#${id}`).dispatchEvent('change');
	await page.waitForTimeout(450);
	return id;
}
const hcId = await setByLabel('총 임직원 수', 0);
const rowAfterZero = (await page.locator('table tbody tr').last().innerText()).replace(/\s+/g, ' ');
const zeroVal = await page.locator(`#${hcId}`).inputValue();
const bodyZero = await txt();
R.add(
	'#3 인원 0 → 강제 1 변환 없음',
	zeroVal === '0',
	`입력칸=${zeroVal} / 표=${(rowAfterZero.match(/(\d+)명/) || [])[0] || '없음'}`
);
R.add(
	'#3 인원 0 오류 표시',
	/임직원|인원/.test(bodyZero) && /오류|1명 이상|이어야/.test(bodyZero),
	(bodyZero.match(/[^|]*(1명 이상|이어야|오류)[^|]*/) || [''])[0].trim().slice(0, 80)
);

// ---- 2 : 오류 레코드 제외 ----
await setByLabel('총 임직원 수', 36);
await setByLabel('영업비용', 1000000000);
await page.waitForTimeout(500);
await page.screenshot({ path: outPath('i-invalid-data.png', OUT), fullPage: true });
const dataBody = await txt();
R.add(
	'#2 오류 문구 위치(패널 상단)',
	/오류|클 수 없습니다/.test(dataBody),
	(dataBody.match(/[^|]*클 수 없습니다[^|]*/) || [''])[0].trim().slice(0, 70)
);
const lastRow2 = (await page.locator('table tbody tr').last().innerText()).replace(/\s+/g, ' ');
R.add('#2 표 행에 오류 표시', /오류|제외/.test(lastRow2), lastRow2.slice(0, 90));

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: outPath('i-invalid-dash.png', OUT), fullPage: true });
const dash = await txt();
// 대시보드 등급 기준선 라벨("우수 1.5")이 항상 떠 있어 "우수" 문구로는 오류 레코드 제외 여부를 못 가린다(오탐) —
// "입력 오류" 안내 문구 노출 + 오류가 섞였을 때 나오는 수치(4.8x배)가 안 보이는지로 함께 판정한다.
R.add(
	'#2 대시보드에서 오류 레코드 제외',
	/입력 오류/.test(dash) && !/4\.8\d배/.test(dash),
	(dash.match(/[^|]*입력 오류[^|]*/) || [''])[0].trim().slice(0, 60)
);

// ---- 2b : 합산 규칙 (오류 하위 기간 → 상위 합산 없음) ----
await page.goto(BASE + '/data', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const rows = await page.locator('table tbody tr').allInnerTexts();
const q1 = rows.findIndex((r) => /1분기/.test(r));
if (q1 >= 0) {
	await page.locator('table tbody tr').nth(q1).click();
	await page.waitForTimeout(500);
	await setByLabel('영업비용', 1000);
	await page.waitForTimeout(700);
	await page.screenshot({ path: outPath('i-rollup.png', OUT), fullPage: true });
	const rb = await txt();
	R.add(
		'#2b 합산 없음 안내',
		/합산 없음|하위 기간 오류/.test(rb),
		(rb.match(/[^|]*합산 없음[^|]*/) || [''])[0].trim().slice(0, 80)
	);
	const half = (await page.locator('table tbody tr').allInnerTexts()).find((r) => /상반기/.test(r));
	R.add(
		'#2b 상반기 합산 조용히 작아지지 않음',
		!half || !/^2025년 상반기\s+합산\s+6,6/.test(half.replace(/\s+/g, ' ')),
		(half || '없음').replace(/\s+/g, ' ').slice(0, 80)
	);
}

// ---- 20 · 1 : 삭제 ----
await page.getByRole('button', { name: '전체 삭제' }).click();
await page.waitForTimeout(700);
R.add(
	'#20 전체 삭제 확인창 백업 유도',
	/백업/.test(dialogs.at(-1) || ''),
	(dialogs.at(-1) || '').slice(0, 80)
);

await page.goto(BASE + '/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.getByText('이 PC 의 데이터 지우기').first().click();
await page.waitForTimeout(900);
await page.goto(BASE + '/report', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({ path: outPath('i-report-after-wipe.png', OUT), fullPage: true });
const rep = await txt();
R.add('#1 데이터 지우기 후 리포트', !/인건비 1원당/.test(rep), rep.slice(0, 90));
const printBtn = page.getByRole('button', { name: /인쇄/ });
R.add('#1 인쇄 버튼 비활성', await printBtn.isDisabled().catch(() => false));

console.log('dialogs:', JSON.stringify(dialogs));
R.add('페이지 오류 없음', errs.length === 0, errs.join(' || '));
await browser.close();
R.finish();
