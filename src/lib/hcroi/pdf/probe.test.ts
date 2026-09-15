/**
 * 실제 결산서 PDF 로 파이프라인을 돌려 보는 프로브 (로컬 전용, 기본 skip).
 *
 *   HCROI_PDF="docs/a.pdf;docs/b.pdf" HCROI_PDF_OUT=probe.txt npx vitest run src/lib/hcroi/pdf/probe
 *   (HCROI_PDF_OUT 을 주면 파일에 덧붙인다 — vitest 가 콘솔 출력을 접을 때)
 *
 * PDF 는 커밋하지 않는다(docs/*.pdf 는 .gitignore). 결과는 콘솔에 요약만 찍는다.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { detectPeriod } from './detectPeriod';
import { scanDocument } from './locate';
import { DEFAULT_HC_INCLUDE, mapFields, periodForColumn } from './map';
import { buildRecord } from './toRecord';
import { DEFAULT_HEADCOUNT_BASIS } from '../types';
import type { PageText } from './types';

const files = (process.env.HCROI_PDF ?? '')
	.split(';')
	.map((s) => s.trim())
	.filter(Boolean);

async function nodeExtract(path: string): Promise<PageText[]> {
	const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
	const doc = await getDocument({
		data: new Uint8Array(fs.readFileSync(path)),
		useSystemFonts: true
	}).promise;
	const pages: PageText[] = [];
	for (let p = 1; p <= doc.numPages; p++) {
		const page = await doc.getPage(p);
		const vp = page.getViewport({ scale: 1 });
		const tc = await page.getTextContent();
		const items = tc.items.flatMap((it) =>
			'str' in it && it.str.trim()
				? [{ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height }]
				: []
		);
		pages.push({ page: p, width: vp.width, height: vp.height, items });
	}
	await doc.destroy();
	return pages;
}

describe.skipIf(files.length === 0)('pdf probe', () => {
	for (const file of files) {
		it(
			file,
			async () => {
				const pages = await nodeExtract(file);
				const scan = scanDocument(pages);
				const options = { consolidated: false, column: 'period' as const };
				const fields = mapFields(scan, options);
				const values = Object.fromEntries(
					fields.filter((f) => f.candidates.length > 0).map((f) => [f.key, f.candidates[0].value])
				);
				const period = periodForColumn(scan.cover, options.column) ?? {
					year: 0,
					type: 'Y',
					index: 1
				};
				const built = buildRecord({
					period,
					values,
					include: DEFAULT_HC_INCLUDE,
					employees: scan.employees[0] ?? null,
					basis: DEFAULT_HEADCOUNT_BASIS,
					payrollMonths: scan.cover.spanMonths
				});
				const summary = {
					pages: pages.length,
					detectedPeriod: detectPeriod(pages),
					cover: scan.cover,
					consolidatedRange: scan.consolidatedRange,
					tables: scan.tables.map((t) => ({
						kind: t.kind,
						page: t.page,
						title: t.title,
						consolidated: t.consolidated,
						unit: t.unitScale,
						columns: t.columns.map((c) => c.label),
						rows: t.rows.length,
						sample: t.rows.slice(0, 4).map((r) => `${r.label}: ${r.values.join(' | ')}`)
					})),
					employees: scan.employees,
					fields: fields
						.filter((f) => f.candidates.length > 0)
						.map((f) => ({
							key: f.key,
							top: f.candidates
								.slice(0, 3)
								.map(
									(c) =>
										`${c.value.toLocaleString()} ← p${c.page} ${c.rowLabel} [${c.column}] ${c.consolidated === null ? '?' : c.consolidated ? '연결' : '별도'}${c.preferred ? ' ★' : ''}`
								)
						})),
					record: built
				};
				const text =
					`
=== ${file}
` + JSON.stringify(summary, null, 1);
				if (process.env.HCROI_PDF_OUT) fs.appendFileSync(process.env.HCROI_PDF_OUT, text);
				else console.log(text);
				expect(scan.tables.length).toBeGreaterThan(0);
			},
			180_000
		);
	}
});
