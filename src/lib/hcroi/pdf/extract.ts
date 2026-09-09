/**
 * PDF → 쪽별 텍스트 조각 (pdf.js). **pdf.js 는 이 파일에서만 동적 import** 한다 — 번들 크기(본체 ~350KB + worker ~1.3MB).
 * 파일은 브라우저 메모리에서만 다루고 어디로도 보내지 않는다. 원문 텍스트도 저장하지 않는다(추출 값만, docs/plans/pdf-to-excel.md §4).
 */

import type { PageText } from './types';

export interface ExtractOptions {
	/** 진행 표시용 (읽은 쪽 수, 전체 쪽 수) */
	onProgress?: (done: number, total: number) => void;
	/** 앞쪽부터 몇 쪽만 (기본 전체) */
	maxPages?: number;
}

/** 텍스트 레이어가 없는(스캔 이미지) PDF */
export class NoTextLayerError extends Error {
	constructor() {
		super('텍스트가 없는 PDF 입니다(스캔 이미지). 엑셀 템플릿에 직접 입력해 주세요.');
		this.name = 'NoTextLayerError';
	}
}

export async function extractPages(
	data: ArrayBuffer,
	options: ExtractOptions = {}
): Promise<PageText[]> {
	const pdfjs = await import('pdfjs-dist');
	if (!pdfjs.GlobalWorkerOptions.workerSrc) {
		const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
		pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
	}
	const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
	try {
		const total = Math.min(doc.numPages, options.maxPages ?? doc.numPages);
		const pages: PageText[] = [];
		let anyText = false;
		for (let p = 1; p <= total; p++) {
			const page = await doc.getPage(p);
			const viewport = page.getViewport({ scale: 1 });
			const content = await page.getTextContent();
			const items = content.items.flatMap((it) => {
				if (!('str' in it) || !it.str.trim()) return [];
				anyText = true;
				return [{ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height }];
			});
			pages.push({ page: p, width: viewport.width, height: viewport.height, items });
			page.cleanup();
			options.onProgress?.(p, total);
		}
		if (!anyText) throw new NoTextLayerError();
		return pages;
	} finally {
		await doc.destroy();
	}
}
