/**
 * 결산서 PDF → 입력 레코드 변환의 공용 타입 (docs/plans/pdf-to-excel.md §4).
 *
 * - `extract.ts` 만 pdf.js 를 (동적으로) 불러 `PageText` 를 만든다.
 * - 나머지(table · locate · map · toRecord)는 순수 함수라 픽스처 JSON 으로 테스트한다.
 * - 좌표는 pdf.js 텍스트 공간(pt). y 는 **위로 갈수록 크다** (쪽 아래가 0).
 */

/** pdf.js `getTextContent()` 의 한 조각 — 글자 몇 개짜리 단편일 수 있다 */
export interface TextItem {
	s: string;
	/** 왼쪽 x */
	x: number;
	/** 기준선 y (위가 큼) */
	y: number;
	w: number;
	h: number;
}

export interface PageText {
	/** 1부터 */
	page: number;
	width: number;
	height: number;
	items: TextItem[];
}

/** 같은 행에서 가로로 붙어 있는 조각을 합친 셀 */
export interface Cell {
	text: string;
	x0: number;
	x1: number;
	/** 숫자로 읽힌 값 (콤마·괄호 음수 처리). 숫자가 아니면 null */
	num: number | null;
	/** "-" 하나만 있는 셀 (값 없음/0 표기) */
	dash: boolean;
}

export interface Row {
	y: number;
	cells: Cell[];
}

/** 화폐 단위 배수 — `(단위 : 천원)` → 1000 */
export type UnitScale = 1 | 1_000 | 1_000_000 | 100_000_000;
