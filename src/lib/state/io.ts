/**
 * 작업공간 내보내기/가져오기 — 순수 함수 + 브라우저 다운로드 헬퍼.
 * `/data` 와 `/settings` 가 JSON 내보내기·JSON 가져오기·엑셀 내보내기를 각자 구현하던 것을 이 모듈 하나로 합친다.
 * 파일명 규칙·동작은 기존과 동일: JSON `hcroi-workspace-YYYY-MM-DD.json`, 엑셀 `hcroi-{회사명-}YYYY-MM-DD.xlsx`.
 * exceljs 는 번들 크기 때문에 `excel/io.ts` 에서만 정적 import 한다(CLAUDE.md) — 여기서도
 * `exportWorkspaceExcel()` 안에서 동적 import 로만 부르고, 이 파일 자체는 정적 import 하지 않는다.
 */
import { workspace, type ImportResult } from './workspace.svelte';
import type { HeadcountBasis, PeerCompany, PeriodRecord, Scenario } from '$lib/hcroi/types';

/** 오늘 날짜 "YYYY-MM-DD" — 파일명에 쓴다 */
export function todayStamp(): string {
	return new Date().toISOString().slice(0, 10);
}

/** 회사명을 파일명에 안전하게 — 경로 구분자·따옴표·공백을 "-" 로 (빈 문자열이면 그대로 빈 문자열) */
export function sanitizeFileNamePart(name: string): string {
	return name.trim().replace(/[\\/:*?"<>|\s]+/g, '-');
}

/** 브라우저에 파일 다운로드를 일으킨다 (JSON·엑셀 공용) */
export function triggerDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** 작업공간을 JSON 백업 파일로 내려받는다. 내려받은 파일명을 돌려준다 */
export function exportWorkspaceJson(): string {
	const filename = `hcroi-workspace-${todayStamp()}.json`;
	triggerDownload(new Blob([workspace.exportJson()], { type: 'application/json' }), filename);
	return filename;
}

/** JSON 백업 파일을 읽어 작업공간에 반영한다. 파일을 읽지 못해도(손상·권한 등) 예외를 던지지 않고 오류로 돌려준다 */
export async function importWorkspaceJsonFile(
	file: File
): Promise<{ fileName: string; result: ImportResult }> {
	let text: string;
	try {
		text = await file.text();
	} catch (err) {
		return {
			fileName: file.name,
			result: { ok: false, error: `파일을 읽지 못했습니다: ${(err as Error).message}` }
		};
	}
	const result = workspace.importJson(text);
	return { fileName: file.name, result };
}

/**
 * 엑셀 내보내기에 넘길 스냅샷. 호출부(.svelte, runes 컴파일 대상)가 `$state.snapshot()` 으로
 * 반응형 프록시를 벗겨 만든다 — 이 모듈은 순수 `.ts` 라 룬을 쓸 수 없다.
 */
export interface WorkspaceExcelSnapshot {
	records: PeriodRecord[];
	scenarios: Scenario[];
	base: PeriodRecord | null;
	orgName: string;
	headcountBasis: HeadcountBasis;
	summaryRecords: PeriodRecord[];
	/** 동종업계 회사 — `동종업계` 시트로 나간다 (없으면 머리글만) */
	peers: PeerCompany[];
}

/**
 * 엑셀 내보내기 — exceljs 는 이 함수 안에서만 동적 로드한다. 내려받은 파일명을 돌려준다.
 * 파일명: `hcroi-{회사명-}YYYY-MM-DD.xlsx` (회사명은 `sanitizeFileNamePart` 로 다듬는다).
 */
export async function exportWorkspaceExcel(snapshot: WorkspaceExcelSnapshot): Promise<string> {
	const { buildWorkbookBuffer, downloadBuffer } = await import('$lib/hcroi/excel/io');
	const buf = await buildWorkbookBuffer(snapshot);
	const org = sanitizeFileNamePart(snapshot.orgName);
	const filename = `hcroi-${org ? org + '-' : ''}${todayStamp()}.xlsx`;
	downloadBuffer(buf, filename);
	return filename;
}
