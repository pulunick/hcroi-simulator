<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { newId, workspace } from '$lib/state/workspace.svelte';
	import {
		exportWorkspaceExcel,
		exportWorkspaceJson,
		importWorkspaceJsonFile
	} from '$lib/state/io';
	import {
		YEAR_MAX,
		YEAR_MIN,
		comparePeriods,
		isValidPeriod,
		isValidYear,
		periodIndexCount,
		periodKey,
		periodLabel,
		periodText
	} from '$lib/hcroi/period';
	import type { BlockedRollup } from '$lib/hcroi/rollup';
	import {
		mergeRecords,
		parseAmountUnit,
		parseCumulative,
		parseInputRows,
		parseHeadcountBasis,
		parseOrgName,
		type ParsedRecord,
		type ParseResult
	} from '$lib/hcroi/excel/fromRows';
	import { computeMetrics, gradeOf, sumHcCost, validateRecord } from '$lib/hcroi/formulas';
	import { estimateFromRevenue, splitHcCost, REFERENCE_DEFAULTS } from '$lib/hcroi/defaults';
	import {
		HC_COST_KEYS,
		HC_COST_LABELS,
		HEADCOUNT_KEYS,
		HEADCOUNT_LABELS,
		PERIOD_TYPES,
		PERIOD_TYPE_LABELS,
		sameHeadcountBasis,
		type BaseInputs,
		type HcCostBreakdown,
		type HeadcountBasis,
		type HeadcountBreakdown,
		type Period,
		type PeriodRecord,
		type PeriodType
	} from '$lib/hcroi/types';
	import {
		amountUnitLabel,
		columnUnitSuffix,
		derivedLabel,
		formatAmount,
		headcountBasisLabel,
		formatCellAmount,
		hintAmountUnit,
		formatHeadcount,
		formatMultiple,
		formatWon
	} from '$lib/hcroi/format';
	import NumberField from '$lib/components/ui/NumberField.svelte';
	import GradeBadge from '$lib/components/ui/GradeBadge.svelte';
	import PdfImport from '$lib/components/data/PdfImport.svelte';

	// 금액 표기는 작업공간의 표시 단위를 따른다 (저장값은 언제나 원 단위 정수). 규칙은 format.ts 한 곳
	const won = (v: number | null | undefined, suffix = '원') =>
		formatAmount(v, workspace.amountUnit, suffix);
	const cellWon = (v: number | null | undefined) => formatCellAmount(v, workspace.amountUnit);
	const colUnit = $derived(columnUnitSuffix(workspace.amountUnit));
	const hintUnit = $derived(hintAmountUnit(workspace.amountUnit));

	let selectedId = $state<string | null>(null);
	/** 선택된 기간 — 합산 레코드도 고를 수 있다(읽기 전용 패널) */
	const selected = $derived(
		workspace.effective.find((y) => y.id === selectedId) ?? workspace.latest
	);
	const errors = $derived(selected ? validateRecord(selected) : []);
	/**
	 * 오류 문구를 해당 입력 칸에 이어 준다 — 칸에는 붉은 테두리(`aria-invalid`)만 두고
	 * 문구 자체는 패널 **상단**에서 한 번만 보여 준다. 판정은 언제나 코어 `validateRecord` 다.
	 */
	const fieldInvalid = $derived.by(() => {
		const has = (...needles: string[]) => errors.some((e) => needles.some((n) => e.startsWith(n)));
		return {
			revenue: has('매출액'),
			operatingCost: has('영업비용', '총 인건비가 영업비용보다'),
			hcCost: has('총 인건비', '인건비 세부'),
			headcount: has('총 임직원 수'),
			headcountBreakdown: has('인원 구분')
		};
	});
	/** 편집 패널 — 모바일(≤1024px)에서 행을 고르면 여기로 스크롤한다 (패널이 표 한참 아래에 있다) */
	let editPanel = $state<HTMLElement | null>(null);
	function selectRecord(id: string) {
		selectedId = id;
		if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
			// 패널이 다시 그려진 뒤 움직인다
			requestAnimationFrame(() =>
				editPanel?.scrollIntoView({ block: 'start', behavior: 'smooth' })
			);
		}
	}

	// --- 편집 입력 (값을 고치면 "복사됨 · 확인 필요" 표시가 풀린다) ---
	function setInput<K extends keyof BaseInputs>(k: K, v: number) {
		if (!selected || selected.derived) return;
		selected.inputs[k] = v;
		workspace.markEdited(selected.id);
	}
	function setBreakdownField(k: keyof HcCostBreakdown, v: number) {
		if (!selected?.breakdown) return;
		selected.breakdown[k] = v;
		workspace.markEdited(selected.id);
	}
	function setHeadField(k: keyof HeadcountBreakdown, v: number) {
		if (!selected?.headcountBreakdown) return;
		selected.headcountBreakdown[k] = v;
		workspace.markEdited(selected.id);
	}
	/** 직접 입력한 값이 하위 기간 합산과 다른 항목 */
	const mismatch = $derived(selected ? workspace.mismatchOf(selected) : []);
	function editDerived() {
		if (!selected?.derived) return;
		const m = workspace.materialize(selected.id);
		if (m) selectedId = m.id;
	}

	// --- 기간 추가 (연도 + 유형 + 순번) ---
	// 연도 칸은 사용자가 손대기 전까지 "가장 최근 기간의 이듬해"를 따른다
	// (localStorage 는 레이아웃 onMount 에서 읽히므로 초기값을 고정하면 샘플 기준 연도가 박힌다)
	let newYearInput = $state<number | null>(null);
	const newYear = $derived(
		newYearInput ?? (workspace.latest?.period.year ?? new Date().getFullYear() - 1) + 1
	);
	let newType = $state<PeriodType>('Y');
	let newIndex = $state(1);
	const newPeriod = $derived<Period>({ year: newYear, type: newType, index: newIndex });
	let addError = $state<string | null>(null);
	function addPeriod() {
		addError = null;
		if (!isValidYear(newYear)) {
			addError = `연도는 ${YEAR_MIN}~${YEAR_MAX} 사이의 정수여야 합니다.`;
			return;
		}
		if (!isValidPeriod(newPeriod)) {
			addError = '기간 순번이 올바르지 않습니다.';
			return;
		}
		if (workspace.hasPeriod(newPeriod)) {
			addError = `${periodLabel(newPeriod)} 데이터가 이미 있습니다.`;
			return;
		}
		// 추가 전 연도를 잡아 둔다 — `newYear` 는 `workspace.latest` 에 기대는 $derived 라서
		// addPeriod() 뒤에 읽으면 이미 한 해 올라가 있다(그대로 +1 하면 한 해를 건너뛴다)
		const addedYear = newYear;
		const rec = workspace.addPeriod(newPeriod);
		selectedId = rec.id;
		// 다음 기간으로 넘긴다: 4분기 다음은 이듬해 1분기
		if (newIndex < periodIndexCount(newType)) {
			newIndex += 1;
			newYearInput = addedYear;
		} else {
			newIndex = 1;
			newYearInput = addedYear + 1;
		}
	}
	/** 선택 기간의 값을 표준 레퍼런스 기본값으로 되돌린다 (매출액·인원은 유지) */
	function resetYear() {
		if (!selected) return;
		if (
			!confirm(
				`${periodLabel(selected.period)} 데이터를 표준 기본값으로 초기화할까요? (매출액·인원은 유지)`
			)
		)
			return;
		const est = estimateFromRevenue(selected.inputs.revenue, selected.inputs.headcount);
		selected.inputs.operatingCost = est.operatingCost;
		selected.inputs.hcCost = est.hcCost;
		if (selected.breakdown) workspace.setBreakdown(selected.id, splitHcCost(est.hcCost));
	}
	function removeRecord(id: string, label: string) {
		if (!confirm(`${label} 데이터를 삭제할까요?`)) return;
		workspace.removeRecord(id);
		if (selectedId === id) selectedId = null;
	}

	// 세부 내역은 6항목을 다 쓰지 않는 회사도 있어 합계 < 총액을 허용한다 (차액 = 미분류).
	// 총 인건비를 합계로 덮어쓰지 않는다 — 지표 계산의 기준은 언제나 총액이다.
	const breakdownSum = $derived(selected?.breakdown ? sumHcCost(selected.breakdown) : null);
	const unclassified = $derived(
		selected && breakdownSum !== null ? selected.inputs.hcCost - breakdownSum : null
	);
	function matchTotalToSum() {
		if (selected && breakdownSum !== null) selected.inputs.hcCost = breakdownSum;
	}
	function toggleBreakdown() {
		if (!selected) return;
		if (selected.breakdown) {
			workspace.setBreakdown(selected.id, null);
		} else {
			workspace.setBreakdown(selected.id, splitHcCost(selected.inputs.hcCost));
		}
	}
	function redistribute() {
		if (selected) workspace.setBreakdown(selected.id, splitHcCost(selected.inputs.hcCost));
	}

	// --- 임직원 수 산정 기준 ---
	// 총원 = 기준을 적용한 구분 합계 는 레이아웃의 $effect(workspace.applyHeadcountBasis) 가 항상 유지한다
	const basisLabel = $derived(headcountBasisLabel(workspace.headcountBasis));
	function toggleHeadcountBreakdown() {
		if (!selected) return;
		workspace.setHeadcountBreakdown(
			selected.id,
			selected.headcountBreakdown
				? null
				: // 총원을 전부 정규직으로 놓고 시작한다 (나머지는 사용자가 나눠 적는다)
					{ regular: selected.inputs.headcount, contract: 0, dispatched: 0, executive: 0 }
		);
	}
	// 가져오기 / 내보내기 (JSON · 엑셀 내보내기의 파일명 규칙·동작은 `io.ts` 공용 — /settings 와 동일)
	let fileInput = $state<HTMLInputElement | null>(null);
	let ioMessage = $state<string | null>(null);
	function exportJson() {
		exportWorkspaceJson();
	}
	async function importJson(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		try {
			const { fileName, result } = await importWorkspaceJsonFile(file);
			ioMessage = result.ok
				? `${fileName} 을(를) 불러왔습니다.${result.warning ? ` ${result.warning}` : ''}`
				: result.error;
			selectedId = null;
		} finally {
			// 실패해도(파일 읽기 오류 등) 같은 파일을 다시 고를 수 있도록 항상 입력을 비운다
			if (fileInput) fileInput.value = '';
		}
	}
	// 엑셀 내보내기 / 템플릿 / 가져오기 (exceljs 는 io.ts 에서 동적 로드)
	let busy = $state(false);
	let preview = $state<{
		fileName: string;
		result: ParseResult;
		/** 파일의 `조직 정보` 시트에서 읽은 회사명. 시트가 없으면 null */
		orgName: string | null;
		/** 파일이 나른 임직원 수 산정 기준. 기준 행이 없는 옛 파일이면 null */
		basis: HeadcountBasis | null;
		/** 파일의 금액 단위 (조직 정보 시트) */
		unit: { label: string; scale: number };
		/** 손익이 누계로 적혀 있어 앞 순번을 빼서 읽었는지 */
		cumulative: boolean;
	} | null>(null);
	let overwrite = $state(true);
	let skipErrors = $state(false);
	/** 미리보기에서 "제목도 바꾸기" 체크 여부 (파일 조직명이 현재와 다를 때만 노출) */
	let applyOrgName = $state(true);
	/** 미리보기에서 "산정 기준도 파일 기준으로" 체크 여부 (파일 기준이 현재와 다를 때만 노출) */
	let applyBasisFromFile = $state(true);
	/** 결산서 PDF 가져오기 패널 — `/data#pdf` 로 들어오면 자동으로 펼친다(랜딩·가이드의 앵커 링크) */
	let pdfOpen = $state(false);
	onMount(() => {
		if (window.location.hash === '#pdf') pdfOpen = true;
	});
	/**
	 * 소개 페이지 시작 경로(`/data?start=pdf` · `/data?start=excel`) — 작업공간에 가상 회사 샘플이
	 * 섞여 있으면 사용자 값이 샘플과 합산되어 버리므로, 시작 영역을 열기 전에 샘플을 비운다.
	 * 두 경로의 규칙은 같다(샘플뿐이면 조용히 비움 / 사용자 데이터면 확인) — 다른 것은 안내 문구와
	 * 어느 영역으로 데려가느냐뿐이다(PDF 카드 / 엑셀 템플릿·가져오기 줄).
	 * `workspace.loaded` 가 켜진 뒤(레이아웃의 onMount 가 localStorage 를 읽은 뒤) 한 번만 처리한다 —
	 * 이 페이지의 onMount 는 레이아웃보다 먼저 실행돼 로드 전 상태(샘플 기본값)만 보일 수 있다.
	 * `routerReady` 도 함께 기다린다 — 하이드레이션 중 첫 $effect 는 SvelteKit 라우터 초기화보다 먼저
	 * 돌 수 있고, 그때 `replaceState` 를 부르면 예외가 나면서 **하이드레이션 전체가 멈춘다**
	 * (화면이 SSR 상태로 굳어 샘플 9행이 그대로 남고 PDF 카드도 안 열린다 — 2026-09-15 회귀).
	 * `afterNavigate` 는 라우터 초기화 뒤 첫 진입(type 'enter')에도 불리므로 안전 신호가 된다.
	 */
	let routerReady = $state(false);
	afterNavigate(() => {
		routerReady = true;
	});
	let startHandled = false;
	$effect(() => {
		if (!workspace.loaded || !routerReady || startHandled) return;
		startHandled = true;
		const params = new URLSearchParams(window.location.search);
		const start = params.get('start');
		if (start !== 'pdf' && start !== 'excel') return;
		const isPdf = start === 'pdf';
		if (workspace.isSampleOnly()) {
			workspace.startFresh();
			ioMessage = isPdf
				? '샘플을 비웠습니다. 결산서 PDF 를 올리면 첫 기간이 됩니다.'
				: '샘플을 비웠습니다. 엑셀 템플릿을 내려받아 채운 뒤 가져오세요.';
		} else if (
			confirm(
				isPdf
					? '입력된 데이터가 있습니다. 지우고 결산서 PDF 로 새로 시작할까요? (취소하면 현재 데이터에 추가합니다)'
					: '입력된 데이터가 있습니다. 지우고 엑셀 양식으로 새로 시작할까요? (취소하면 현재 데이터에 추가합니다)'
			)
		) {
			workspace.startFresh();
		}
		if (isPdf) pdfOpen = true;
		// 처리 후 쿼리를 지워 새로고침 시 반복되지 않게 한다
		replaceState(resolve('/data'), {});
		// 해당 시작 영역으로 스크롤 (렌더 뒤에)
		queueMicrotask(() =>
			document
				.getElementById(isPdf ? 'pdf' : 'excel')
				?.scrollIntoView({ block: 'start', behavior: 'smooth' })
		);
	});
	/** PDF 카드에서 확인한 값 → 엑셀 가져오기와 같은 미리보기·병합·되돌리기 경로 */
	function fromPdf(fileName: string, records: ParsedRecord[], companyName: string | null) {
		applyOrgName = true;
		applyBasisFromFile = true;
		ioMessage = null;
		preview = {
			fileName,
			result: { records, errors: [], headerError: null },
			orgName: companyName,
			basis: null,
			unit: { label: '원', scale: 1 },
			cumulative: false
		};
	}
	async function exportExcel() {
		busy = true;
		try {
			const fname = await exportWorkspaceExcel({
				records: $state.snapshot(workspace.records),
				scenarios: $state.snapshot(workspace.scenarios),
				base: workspace.base ? $state.snapshot(workspace.base) : null,
				orgName: workspace.orgName,
				headcountBasis: $state.snapshot(workspace.headcountBasis),
				summaryRecords: $state.snapshot(workspace.effective)
			});
			ioMessage = `엑셀 파일(${fname})을 내려받았습니다. 시트: 지표 요약 · 입력 데이터 · 시나리오 비교 · 조직 정보 · 산식·가정`;
		} catch (e) {
			ioMessage = `엑셀 내보내기 실패: ${(e as Error).message}`;
		} finally {
			busy = false;
		}
	}
	async function downloadTemplate() {
		busy = true;
		try {
			const { buildTemplateBuffer, downloadBuffer } = await import('$lib/hcroi/excel/io');
			downloadBuffer(await buildTemplateBuffer({ withSample: true }), 'hcroi-template.xlsx');
			ioMessage =
				'입력 템플릿(hcroi-template.xlsx)을 내려받았습니다. 샘플 행을 자사 값으로 바꾸세요. 기간은 드롭다운, 맨 끝 "검증" 열이 틀린 행을 붉게 표시합니다. "조직 정보" 시트에서 회사 이름·금액 단위(천원 등)·누계 입력 여부를 정합니다.';
		} catch (e) {
			ioMessage = `템플릿 생성 실패: ${(e as Error).message}`;
		} finally {
			busy = false;
		}
	}
	async function importExcel(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		busy = true;
		ioMessage = null;
		try {
			const { readWorkbook } = await import('$lib/hcroi/excel/io');
			const read = await readWorkbook(await file.arrayBuffer());
			applyOrgName = true;
			applyBasisFromFile = true;
			// 인원 구분 합계는 산정 기준에 따라 달라지므로 파일이 나른 기준을 우선 적용해 파싱한다
			const fileBasis = parseHeadcountBasis(read.org);
			const unit = parseAmountUnit(read.org);
			const cumulative = parseCumulative(read.org);
			preview = {
				fileName: file.name,
				result: parseInputRows(read.input, {
					basis: fileBasis ?? $state.snapshot(workspace.headcountBasis),
					scale: unit.scale,
					cumulative
				}),
				orgName: parseOrgName(read.org),
				basis: fileBasis,
				unit,
				cumulative
			};
		} catch (err) {
			ioMessage = `엑셀 파일을 읽지 못했습니다: ${(err as Error).message}`;
		} finally {
			busy = false;
			input.value = '';
		}
	}
	type PreviewRow = {
		row: number;
		/** 기간 라벨 (연도조차 못 읽은 오류 행은 null) */
		label: string | null;
		status: '신규' | '덮어씀' | '건너뜀' | '오류';
		inputs: { revenue: number; operatingCost: number; hcCost: number; headcount: number } | null;
		notes: string[];
	};
	const previewRows = $derived.by((): PreviewRow[] => {
		if (!preview) return [];
		const existing = new Set(workspace.records.map((y) => periodKey(y.period)));
		const rows: PreviewRow[] = [
			...preview.result.records.map((p): PreviewRow => ({
				row: p.row,
				label: periodLabel(p.record.period),
				status: existing.has(periodKey(p.record.period))
					? overwrite
						? '덮어씀'
						: '건너뜀'
					: '신규',
				inputs: p.record.inputs,
				notes: p.warnings
			})),
			...preview.result.errors.map((e): PreviewRow => ({
				row: e.row,
				label: e.period ? periodLabel(e.period) : null,
				status: '오류',
				inputs: null,
				notes: e.messages
			}))
		];
		return rows.sort((a, b) => a.row - b.row);
	});
	/** 파일 산정 기준이 현재 설정과 (값으로) 다를 때만 물어본다 */
	const basisChange = $derived<HeadcountBasis | null>(
		preview?.basis && !sameHeadcountBasis(preview.basis, workspace.headcountBasis)
			? preview.basis
			: null
	);
	/** 파일 조직명이 현재 제목과 달라 물어볼 필요가 있을 때만 값을 갖는다 */
	const orgNameChange = $derived(
		preview && preview.orgName !== null && preview.orgName !== workspace.orgName.trim()
			? preview.orgName
			: null
	);
	const canApply = $derived(
		!!preview &&
			!preview.result.headerError &&
			preview.result.records.length > 0 &&
			(preview.result.errors.length === 0 || skipErrors)
	);
	function applyImport() {
		if (!preview || !canApply) return;
		workspace.takeSnapshot();
		const r = mergeRecords($state.snapshot(workspace.records), preview.result.records, {
			overwrite,
			newId
		});
		workspace.replaceRecords(r.records);
		const parts = [`${r.added}개 기간 추가`, `${r.updated}개 덮어씀`];
		// $derived 는 상태를 바꾸는 순간 다시 계산되므로 반영 전에 값을 잡아 둔다
		const newOrgName = orgNameChange;
		const newBasis = basisChange;
		if (newOrgName !== null && applyOrgName) {
			workspace.orgName = newOrgName;
			parts.push(newOrgName ? `제목 "${newOrgName}"` : '제목 기본값으로');
		}
		if (newBasis !== null && applyBasisFromFile) {
			workspace.setHeadcountBasis(newBasis);
			parts.push(`인원 산정 기준 "${headcountBasisLabel(newBasis)}"`);
		}
		if (r.skipped) parts.push(`${r.skipped}개 건너뜀(기존 기간 유지)`);
		if (preview.result.errors.length) parts.push(`오류 ${preview.result.errors.length}행 제외`);
		ioMessage = `${preview.fileName} 반영: ${parts.join(', ')}. 잘못 반영했으면 "되돌리기" 를 누르세요.`;
		preview = null;
		selectedId = null;
	}
	function undoImport() {
		if (workspace.restoreSnapshot()) {
			ioMessage = '가져오기 전 상태로 되돌렸습니다.';
			selectedId = null;
		} else {
			ioMessage = '되돌릴 스냅샷이 없습니다.';
		}
	}

	function resetSample() {
		if (confirm('현재 데이터를 모두 지우고 샘플 데이터로 되돌릴까요?')) {
			workspace.resetToSample();
			selectedId = null;
		}
	}
	function clearAll() {
		if (
			confirm(
				'모든 기간 데이터를 삭제할까요? (되돌릴 수 없습니다)\n\n먼저 설정 → 백업 파일 저장을 권합니다.'
			)
		) {
			workspace.clearAll();
			selectedId = null;
		}
	}
	/**
	 * 표에 그릴 줄 — 레코드 + "합산 없음" 안내 줄(검증 오류인 하위 기간 때문에 만들지 못한 상위 기간).
	 * 조용히 작아진 합계를 내보내지 않는 대신, 그 자리가 비어 있는 이유를 한 줄로 알린다.
	 */
	type TableRow = { key: string; rec: PeriodRecord } | { key: string; blocked: BlockedRollup };
	const tableRows = $derived.by((): TableRow[] => {
		const rows: TableRow[] = [
			...workspace.effective.map((r) => ({ key: `r:${r.id}`, rec: r })),
			...workspace.blocked.map((b) => ({ key: `b:${periodKey(b.period)}`, blocked: b }))
		];
		const at = (row: TableRow) => ('rec' in row ? row.rec.period : row.blocked.period);
		return rows.sort((a, b) => comparePeriods(at(a), at(b)));
	});
	/** 표가 가로로 더 스크롤될 수 있는지 (끝에 닿으면 안내를 숨긴다) */
	let tableScroll = $state<HTMLElement | null>(null);
	let canScrollRight = $state(false);
	function updateScrollHint() {
		const el = tableScroll;
		canScrollRight = !!el && el.scrollWidth - el.clientWidth - el.scrollLeft > 4;
	}
	$effect(() => {
		// 표 내용·표시 단위가 바뀌면 다시 잰다
		void tableRows;
		void colUnit;
		updateScrollHint();
	});

	const sharePct = REFERENCE_DEFAULTS.breakdownSharePct;
</script>

<svelte:head><title>{workspace.pageTitle('데이터')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-ink">데이터</h1>
		<p class="mt-1 text-[15px] text-ink-2">
			기간별(연간·반기·분기·월) 재무·HR 데이터를 입력합니다. 잘게 넣으면 상위 기간(분기 → 반기 →
			연간)은 자동으로 합산됩니다. 총 인건비는 6개 항목으로, 임직원 수는 4개 구분으로 나눠 관리할 수
			있습니다.
		</p>
		<p class="mt-3 text-sm text-ink-2">
			표시 단위 {amountUnitLabel(workspace.amountUnit)} · 임직원 수 {headcountBasisLabel(
				workspace.headcountBasis
			)} —
			<a href={resolve('/settings')} class="font-medium text-brand-ink hover:underline"
				>설정에서 바꾸기</a
			>
		</p>
	</div>
	<div id="excel" class="flex scroll-mt-24 flex-wrap items-center gap-2">
		<button type="button" class="btn btn-primary" onclick={exportExcel} disabled={busy}
			>엑셀 내보내기</button
		>
		<button type="button" class="btn btn-secondary" onclick={downloadTemplate} disabled={busy}
			>엑셀 템플릿</button
		>
		<label class="btn btn-secondary" class:opacity-50={busy}>
			엑셀 가져오기
			<input
				type="file"
				accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
				class="sr-only"
				disabled={busy}
				onchange={importExcel}
			/>
		</label>
		<button
			id="pdf"
			type="button"
			class="btn scroll-mt-24 btn-secondary"
			aria-pressed={pdfOpen}
			onclick={() => (pdfOpen = !pdfOpen)}
			disabled={busy}>결산서 PDF 가져오기</button
		>
		{#if workspace.undoAvailable}
			<button type="button" class="btn btn-ghost" onclick={undoImport}>되돌리기</button>
		{/if}
		<span class="mx-1 hidden h-6 w-px bg-line sm:inline-block" aria-hidden="true"></span>
		<button type="button" class="btn btn-ghost" onclick={resetSample}>샘플로 초기화</button>
		<button type="button" class="btn btn-ghost text-status-critical-ink" onclick={clearAll}
			>전체 삭제</button
		>
		<details class="relative">
			<summary class="btn list-none text-sm btn-ghost text-muted">고급 (JSON)</summary>
			<div
				class="absolute right-0 z-10 mt-1 flex w-max flex-col gap-1 rounded-lg border border-line bg-surface p-2 shadow-md"
			>
				<button
					type="button"
					class="btn justify-start py-1.5 text-sm btn-ghost"
					onclick={exportJson}>JSON 내보내기</button
				>
				<label class="btn justify-start py-1.5 text-sm btn-ghost">
					JSON 가져오기
					<input
						type="file"
						accept="application/json,.json"
						class="sr-only"
						bind:this={fileInput}
						onchange={importJson}
					/>
				</label>
				<p class="max-w-56 px-2 pb-1 text-xs text-muted">
					JSON 은 개발·백업용 원본 형식입니다. 공유·편집은 엑셀을 쓰세요.
				</p>
			</div>
		</details>
	</div>
</div>
{#if ioMessage}
	<p
		class="mb-4 rounded-md border border-line bg-surface px-4 py-2 text-sm text-ink-2"
		role="status"
	>
		{ioMessage}
	</p>
{/if}

{#if pdfOpen}
	<PdfImport onpreview={fromPdf} onclose={() => (pdfOpen = false)} />
{/if}

{#if preview}
	{@const res = preview.result}
	<section class="card mb-6 px-5 py-5" aria-labelledby="preview-h">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 id="preview-h" class="text-lg font-semibold text-ink">가져오기 미리보기</h2>
				<p class="text-sm text-muted">
					{preview.fileName} — 정상 {res.records.length}행 · 오류 {res.errors.length}행. 아직
					반영되지 않았습니다.
					{#if preview.unit.scale !== 1}
						금액은 <strong class="text-ink">{preview.unit.label}</strong> 단위로 읽어 ×{preview.unit.scale.toLocaleString()}
						했습니다.
					{/if}
					{#if preview.cumulative}<strong class="text-ink">누계</strong> 입력이라 앞 순번을 빼서 기간
						실적으로 만들었습니다.{/if}
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<label class="flex items-center gap-2 text-sm text-ink-2">
					<input
						type="checkbox"
						class="rounded border-line-2 text-brand"
						bind:checked={overwrite}
					/>
					기존 기간 덮어쓰기
				</label>
				{#if res.errors.length}
					<label class="flex items-center gap-2 text-sm text-ink-2">
						<input
							type="checkbox"
							class="rounded border-line-2 text-brand"
							bind:checked={skipErrors}
						/>
						오류 행 건너뛰고 반영
					</label>
				{/if}
				{#if basisChange !== null}
					<label class="flex items-center gap-2 text-sm text-ink-2">
						<input
							type="checkbox"
							class="rounded border-line-2 text-brand"
							bind:checked={applyBasisFromFile}
						/>
						<span class="whitespace-nowrap"
							>임직원 수 산정 기준도 "{headcountBasisLabel(basisChange)}" 으로</span
						>
					</label>
				{/if}
				{#if orgNameChange !== null}
					<label class="flex items-center gap-2 text-sm text-ink-2">
						<input
							type="checkbox"
							class="rounded border-line-2 text-brand"
							bind:checked={applyOrgName}
						/>
						<span class="whitespace-nowrap">
							대시보드 제목도 {orgNameChange ? `"${orgNameChange}"` : '기본값'} 으로
						</span>
					</label>
				{/if}
				<button type="button" class="btn btn-ghost" onclick={() => (preview = null)}>취소</button>
				<button type="button" class="btn btn-primary" onclick={applyImport} disabled={!canApply}
					>반영</button
				>
			</div>
		</div>
		{#if res.headerError}
			<p
				class="rounded-md border border-status-critical/40 bg-status-critical-bg px-4 py-3 text-sm text-status-critical-ink"
			>
				{res.headerError}
			</p>
		{:else}
			<div class="relative overflow-x-auto">
				<table class="w-full min-w-[720px] text-sm">
					<thead>
						<tr class="border-y border-line bg-surface-2 text-ink-2">
							<th scope="col" class="px-3 py-2 text-center font-semibold">행</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">기간</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">상태</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">매출액{colUnit}</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">영업이익{colUnit}</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">총 인건비{colUnit}</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">인원</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">비고</th>
						</tr>
					</thead>
					<tbody>
						{#each previewRows as r (r.row)}
							<tr
								class="border-b border-line last:border-0 {r.status === '오류'
									? 'bg-status-critical-bg/60'
									: ''}"
							>
								<td class="tabular px-3 py-2 text-muted">{r.row}</td>
								<td class="px-3 py-2 font-semibold whitespace-nowrap">{r.label ?? '—'}</td>
								<td class="px-3 py-2">
									<span
										class="rounded px-1.5 py-0.5 text-xs font-semibold {r.status === '오류'
											? 'bg-status-critical-bg text-status-critical-ink'
											: r.status === '신규'
												? 'bg-status-good-bg text-status-good-ink'
												: r.status === '덮어씀'
													? 'bg-status-warning-bg text-status-warning-ink'
													: 'bg-surface-2 text-muted'}">{r.status}</span
									>
								</td>
								<td class="tabular px-3 py-2 text-right"
									>{r.inputs ? won(r.inputs.revenue) : '—'}</td
								>
								<td class="tabular px-3 py-2 text-right"
									>{r.inputs ? won(r.inputs.revenue - r.inputs.operatingCost) : '—'}</td
								>
								<td class="tabular px-3 py-2 text-right">{r.inputs ? won(r.inputs.hcCost) : '—'}</td
								>
								<td class="tabular px-3 py-2 text-right"
									>{r.inputs ? formatHeadcount(r.inputs.headcount) : '—'}</td
								>
								<td
									class="px-3 py-2 text-xs {r.status === '오류'
										? 'text-status-critical-ink'
										: 'text-muted'}">{r.notes.join(' ')}</td
								>
							</tr>
						{:else}
							<tr
								><td colspan="8" class="px-4 py-6 text-center text-muted"
									>데이터 행이 없습니다. 3행부터 값을 입력했는지 확인하세요.</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
			{#if res.errors.length && !skipErrors}
				<p class="mt-3 text-sm text-status-critical-ink">
					오류 행이 있어 반영할 수 없습니다. 파일을 고쳐 다시 올리거나 "오류 행 건너뛰고 반영" 을
					켜세요.
				</p>
			{/if}
		{/if}
	</section>
{/if}

<div
	class="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]"
>
	<!-- 연도 목록 -->
	<section class="card overflow-hidden" aria-labelledby="years-h">
		<div class="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
			<div>
				<h2 id="years-h" class="text-lg font-semibold text-ink">기간별 데이터</h2>
				<p class="text-xs text-muted">
					행을 클릭하면 오른쪽에서 편집할 수 있습니다. <span class="rounded bg-surface-2 px-1"
						>합산</span
					> 은 하위 기간에서 계산된 기간(저장되지 않음)
				</p>
			</div>
			<form
				class="flex flex-wrap items-center gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					addPeriod();
				}}
			>
				<label class="text-sm font-semibold text-ink-2" for="new-year">기간 추가</label>
				<input
					id="new-year"
					type="number"
					class="field-input w-24 py-1.5"
					min={YEAR_MIN}
					max={YEAR_MAX}
					value={newYear}
					oninput={(e) => (newYearInput = Number((e.currentTarget as HTMLInputElement).value))}
					aria-label="연도"
				/>
				<select
					class="field-input w-auto py-1.5"
					bind:value={newType}
					onchange={() => (newIndex = 1)}
					aria-label="기간 유형"
				>
					{#each PERIOD_TYPES as t (t)}
						<option value={t}>{PERIOD_TYPE_LABELS[t]}</option>
					{/each}
				</select>
				{#if newType !== 'Y'}
					<select class="field-input w-auto py-1.5" bind:value={newIndex} aria-label="기간 순번">
						{#each Array.from({ length: periodIndexCount(newType) }, (_, i) => i + 1) as i (i)}
							<option value={i}>{periodText({ year: newYear, type: newType, index: i })}</option>
						{/each}
					</select>
				{/if}
				<button type="submit" class="btn py-1.5 btn-primary">추가</button>
			</form>
		</div>
		{#if addError}<p class="px-5 pb-2 text-sm text-status-critical-ink">{addError}</p>{/if}
		{#if canScrollRight}
			<p class="px-5 pb-1 text-right text-[11px] whitespace-nowrap text-muted" aria-hidden="true">
				옆으로 넘기기 →
			</p>
		{/if}
		<div class="relative">
			<div class="overflow-x-auto" bind:this={tableScroll} onscroll={updateScrollHint}>
				<table class="w-full min-w-[560px] text-[15px]">
					<thead>
						<tr class="border-y border-line bg-surface-2 text-sm text-ink-2">
							<th scope="col" class="px-4 py-2 text-center font-semibold">기간</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">매출액{colUnit}</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">영업이익{colUnit}</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">총 인건비{colUnit}</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">인원</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">HCROI</th>
							<th scope="col" class="w-12 px-2 py-2"><span class="sr-only">삭제</span></th>
						</tr>
					</thead>
					<tbody>
						{#each tableRows as row (row.key)}
							{#if 'blocked' in row}
								<!-- 하위 기간에 검증 오류가 있어 합산을 만들지 않은 상위 기간 (조용히 작아진 합계를 내보내지 않는다) -->
								<tr class="border-b border-line bg-status-warning-bg/50 last:border-0">
									<th
										scope="row"
										class="px-4 py-2 text-left align-middle font-semibold whitespace-nowrap text-ink-2"
										>{periodLabel(row.blocked.period)}</th
									>
									<td colspan="6" class="px-3 py-2 text-sm text-status-warning-ink">
										합산 없음 — 하위 기간 오류({row.blocked.blockedBy
											.map((p) => periodLabel(p))
											.join(', ')})
									</td>
								</tr>
							{:else}
								{@const y = row.rec}
								{@const m = computeMetrics(y.inputs)}
								{@const invalid = !workspace.isValid(y)}
								<tr
									class="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2 {selected?.id ===
									y.id
										? 'bg-brand-tint/60 hover:bg-brand-tint/60'
										: invalid
											? 'bg-status-critical-bg/40'
											: y.derived
												? 'text-ink-2'
												: ''}"
									aria-selected={selected?.id === y.id}
									onclick={() => selectRecord(y.id)}
								>
									<th
										scope="row"
										class="px-4 py-2 text-left align-middle font-semibold whitespace-nowrap text-ink"
									>
										<button
											type="button"
											class="underline-offset-2 hover:underline"
											onclick={() => selectRecord(y.id)}>{periodLabel(y.period)}</button
										>
										{#if y.derived}<span
												class="ml-1 rounded bg-surface-2 px-1.5 py-0.5 text-xs font-normal whitespace-nowrap text-muted"
												title={derivedLabel(y.derived)}>합산</span
											>{:else if y.id.startsWith('sample-')}<span
												class="ml-1 text-xs font-normal whitespace-nowrap text-muted">샘플</span
											>{/if}
										{#if y.copiedFrom}<span
												class="ml-1 rounded bg-status-warning-bg px-1.5 py-0.5 text-xs font-normal whitespace-nowrap text-status-warning-ink"
												title="{periodLabel(y.copiedFrom)} 값을 복사해 왔습니다 — 실적으로 바꾸세요"
												>복사됨 · 확인 필요</span
											>{/if}
										{#if invalid}<span
												class="ml-1 rounded bg-status-critical-bg px-1.5 py-0.5 text-xs font-normal whitespace-nowrap text-status-critical-ink"
												title="입력 오류 — 지표·추이·리포트에서 제외됩니다">입력 오류</span
											>{/if}
									</th>
									<td class="tabular px-3 py-2 text-right align-middle"
										>{cellWon(y.inputs.revenue)}</td
									>
									<td class="tabular px-3 py-2 text-right align-middle"
										>{cellWon(m.operatingProfit)}</td
									>
									<td class="tabular px-3 py-2 text-right align-middle"
										>{cellWon(y.inputs.hcCost)}</td
									>
									<td class="tabular px-3 py-2 text-right align-middle"
										>{formatHeadcount(y.inputs.headcount)}</td
									>
									<td class="tabular px-3 py-2 text-right align-middle"
										><span class="inline-flex items-center justify-end gap-1.5 whitespace-nowrap"
											><span class="tabular">{invalid ? '—' : formatMultiple(m.hcroi)}</span
											>{#if !invalid}<GradeBadge grade={gradeOf(m.hcroi)} />{/if}</span
										></td
									>
									<td class="px-2 py-2 text-right align-middle">
										{#if !y.derived}
											<button
												type="button"
												class="btn p-1.5 btn-ghost text-status-critical-ink hover:bg-status-critical-bg"
												aria-label="{periodLabel(y.period)} 삭제"
												title="{periodLabel(y.period)} 삭제"
												onclick={(e) => {
													e.stopPropagation();
													removeRecord(y.id, periodLabel(y.period));
												}}
											>
												<svg
													width="16"
													height="16"
													viewBox="0 0 24 24"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													stroke-linecap="round"
													stroke-linejoin="round"
													aria-hidden="true"
													><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" /></svg
												>
											</button>
										{/if}
									</td>
								</tr>
							{/if}
						{:else}
							<tr
								><td colspan="7" class="px-4 py-8 text-center text-muted"
									>데이터가 없습니다. 기간을 추가하거나 샘플로 초기화하세요.</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
			{#if canScrollRight}
				<!-- 그라데이션 대신 오른쪽 끝 1px 선만 (표 내용을 가리지 않는다). 끝까지 밀면 사라진다 -->
				<div
					class="pointer-events-none absolute inset-y-0 right-0 w-px bg-line-2"
					aria-hidden="true"
				></div>
			{/if}
		</div>
	</section>

	<!-- 편집 패널 -->
	<section class="card scroll-mt-24 px-5 py-5" aria-labelledby="edit-h" bind:this={editPanel}>
		{#if selected?.derived}
			{@const m = computeMetrics(selected.inputs)}
			<h2 id="edit-h" class="text-lg font-semibold text-ink">
				{periodLabel(selected.period)}
				<span class="ml-1 text-sm font-normal text-muted">{derivedLabel(selected.derived)}</span>
			</h2>
			<p class="mt-2 text-sm text-ink-2">
				하위 기간에서 계산된 값입니다. 금액은 합계, 임직원 수는 <strong
					>{basisLabel.split(' · ')[0]}</strong
				>
				방식으로 모았습니다. 저장되지 않고 하위 기간이 바뀌면 함께 바뀝니다.
			</p>
			<dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
				<dt class="text-ink-2">매출액</dt>
				<dd class="tabular font-semibold">{won(selected.inputs.revenue)}</dd>
				<dt class="text-ink-2">영업비용 (인건비 포함)</dt>
				<dd class="tabular font-semibold">{won(selected.inputs.operatingCost)}</dd>
				<dt class="text-ink-2">영업이익</dt>
				<dd class="tabular font-semibold">{won(m.operatingProfit)}</dd>
				<dt class="text-ink-2">총 인건비</dt>
				<dd class="tabular font-semibold">
					{won(selected.inputs.hcCost)}{#if !selected.breakdown}<span
							class="ml-1 text-xs text-muted">(세부는 하위 기간이 모두 세부를 쓸 때만)</span
						>{/if}
				</dd>
				<dt class="text-ink-2">총 임직원 수</dt>
				<dd class="tabular font-semibold">
					{formatHeadcount(selected.inputs.headcount)}
					<span class="text-xs font-normal text-muted">· {basisLabel}</span>
				</dd>
				<dt class="text-ink-2">HCROI</dt>
				<dd class="tabular font-semibold">{formatMultiple(m.hcroi)}</dd>
			</dl>
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<button type="button" class="btn py-1.5 text-sm btn-secondary" onclick={editDerived}
					>직접 입력으로 전환</button
				>
				<span class="text-xs text-muted"
					>복사본을 만들어 값을 고칩니다. 이후 이 기간은 직접 입력이 우선됩니다.</span
				>
			</div>
		{:else if selected}
			<div class="mb-4 flex items-center justify-between gap-3">
				<h2 id="edit-h" class="text-lg font-semibold text-ink">
					{periodLabel(selected.period)} 데이터 편집
				</h2>
				<button
					type="button"
					class="btn py-1 text-sm btn-secondary"
					title="표준 기본값(매출 대비 인건비 22%, 영업이익률 8%)으로 되돌립니다. 매출액·인원은 유지"
					onclick={resetYear}>초기화</button
				>
			</div>
			{#if selected.copiedFrom}
				<p
					class="mb-4 rounded-md border border-status-warning/40 bg-status-warning-bg px-4 py-2 text-sm text-status-warning-ink"
				>
					<strong>복사됨 · 확인 필요</strong> — {periodLabel(selected.copiedFrom)} 값을 그대로 복사해
					왔습니다. 실적으로 바꾸면 이 표시가 사라집니다.
				</p>
			{/if}
			{#if errors.length}
				<!-- 오류는 패널 맨 위에 — 아래 입력 칸은 붉은 테두리(aria-invalid)로 어디가 문제인지 알린다 -->
				<div
					class="mb-4 rounded-md border border-status-critical/40 bg-status-critical-bg px-4 py-3 text-sm text-status-critical-ink"
					role="alert"
				>
					<p class="font-semibold">
						입력 오류 — 이 기간은 지표·추이·시나리오·리포트에서 제외됩니다
					</p>
					<ul class="mt-1 space-y-1">
						{#each errors as e (e)}<li>{e}</li>{/each}
					</ul>
				</div>
			{/if}
			<div class="space-y-4">
				<NumberField
					{hintUnit}
					label="매출액"
					bind:value={() => selected.inputs.revenue, (v) => setInput('revenue', v)}
					min={0}
					invalid={fieldInvalid.revenue}
				/>
				<NumberField
					{hintUnit}
					label="영업비용 (인건비 포함)"
					bind:value={() => selected.inputs.operatingCost, (v) => setInput('operatingCost', v)}
					min={0}
					invalid={fieldInvalid.operatingCost}
					help="영업이익 = {won(selected.inputs.revenue - selected.inputs.operatingCost)}"
				/>
				<div class="rounded-lg border border-line bg-surface-2 p-4">
					<div class="mb-3 flex items-center justify-between gap-3">
						<h3 class="text-sm font-semibold text-ink-2">총 임직원 수</h3>
						<label class="flex items-center gap-2 text-sm text-ink-2">
							<input
								type="checkbox"
								class="rounded border-line-2 text-brand focus:ring-brand/30"
								checked={!!selected.headcountBreakdown}
								onchange={toggleHeadcountBreakdown}
							/>
							인원 구분으로 입력
						</label>
					</div>
					{#if selected.headcountBreakdown}
						<div class="grid gap-3 sm:grid-cols-2">
							{#each HEADCOUNT_KEYS as k (k)}
								<NumberField
									{hintUnit}
									label={HEADCOUNT_LABELS[k] + (k === 'regular' ? ' (항상 포함)' : '')}
									bind:value={() => selected.headcountBreakdown![k], (v) => setHeadField(k, v)}
									unit="명"
									min={0}
									invalid={fieldInvalid.headcountBreakdown}
									help={k === 'regular' || workspace.headcountBasis.include[k]
										? undefined
										: '지금 기준에서는 총원에 넣지 않습니다'}
								/>
							{/each}
						</div>
						<div class="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-sm">
							<span class="text-ink-2">총 임직원 수</span>
							<strong class="tabular text-ink">{formatHeadcount(selected.inputs.headcount)}</strong>
							<span class="text-muted">· {basisLabel}</span>
						</div>
						{#if workspace.headcountBasis.include.dispatched && selected.headcountBreakdown.dispatched > 0}
							<p class="mt-2 text-xs text-status-warning-ink">
								파견·도급 인원은 인건비가 아니라 지급수수료로 잡히는 경우가 많습니다. 총원에만
								더하면 인당 지표(HCVA·인당 인건비)가 실제보다 낮게 나옵니다.
							</p>
						{/if}
						<p class="mt-2 text-xs text-muted">
							총원은 위 구분 중 <strong>산정 기준에서 포함하기로 한 것</strong>만 더해 자동으로
							계산됩니다. 기준은 화면 위쪽에서 바꿉니다.
						</p>
					{:else}
						<NumberField
							{hintUnit}
							label="총 임직원 수"
							bind:value={() => selected.inputs.headcount, (v) => setInput('headcount', v)}
							unit="명"
							min={1}
							invalid={fieldInvalid.headcount}
							help={basisLabel}
						/>
					{/if}
				</div>

				<div class="rounded-lg border border-line bg-surface-2 p-4">
					<div class="mb-3 flex items-center justify-between gap-3">
						<h3 class="text-sm font-semibold text-ink-2">총 인건비</h3>
						<label class="flex items-center gap-2 text-sm text-ink-2">
							<input
								type="checkbox"
								class="rounded border-line-2 text-brand focus:ring-brand/30"
								checked={!!selected.breakdown}
								onchange={toggleBreakdown}
							/>
							세부 내역으로 입력
						</label>
					</div>
					{#if selected.breakdown}
						<div class="grid gap-3 sm:grid-cols-2">
							{#each HC_COST_KEYS as k (k)}
								<NumberField
									{hintUnit}
									label="{HC_COST_LABELS[k]} ({sharePct[k]}%)"
									bind:value={() => selected.breakdown![k], (v) => setBreakdownField(k, v)}
									min={0}
								/>
							{/each}
						</div>
						<div class="mt-3 border-t border-line pt-3">
							<NumberField
								{hintUnit}
								label="총 인건비 (총액)"
								bind:value={() => selected.inputs.hcCost, (v) => setInput('hcCost', v)}
								min={0}
								invalid={fieldInvalid.hcCost}
							/>
							<div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
								<div class="text-ink-2">
									세부 합계 <strong class="tabular text-ink">{formatWon(breakdownSum ?? 0)}</strong>
									{#if unclassified !== null && unclassified > 0}
										<span class="text-muted">·</span> 미분류
										<strong class="tabular text-ink">{formatWon(unclassified)}</strong>
									{:else if unclassified !== null && unclassified < 0}
										<span class="text-status-critical-ink"
											>· 세부 합계가 총액보다 {formatWon(-unclassified)} 많습니다</span
										>
									{/if}
								</div>
								<div class="flex flex-wrap gap-2">
									{#if unclassified !== null && unclassified !== 0}
										<button
											type="button"
											class="btn py-1 text-sm btn-ghost"
											onclick={matchTotalToSum}>총액을 합계로</button
										>
									{/if}
									<button type="button" class="btn py-1 text-sm btn-ghost" onclick={redistribute}
										>기본 구성비로 재분배</button
									>
								</div>
							</div>
						</div>
						<p class="mt-2 text-xs text-muted">
							6항목을 다 쓰지 않아도 됩니다 — 세부 합계가 총액보다 적으면 차액은 <strong
								>미분류</strong
							>
							로 남고, 지표는 <strong>총 인건비</strong> 기준으로 계산됩니다. 괄호 안 % 는 표준 레퍼런스
							구성비(기본급 62 · 성과급/수당 14 · 퇴직급여 8 · 법정후생비 9 · 기타 복리후생 5 · 교육훈련
							2)입니다.
						</p>
					{:else}
						<NumberField
							{hintUnit}
							label="총 인건비 (총액)"
							bind:value={() => selected.inputs.hcCost, (v) => setInput('hcCost', v)}
							min={0}
							invalid={fieldInvalid.hcCost}
							help="기본급+성과급/수당+퇴직급여+법정후생비+기타 복리후생비+교육훈련비"
						/>
					{/if}
				</div>

				<label class="block">
					<span class="text-sm font-semibold text-ink-2">메모</span>
					<input
						class="mt-1 field-input"
						bind:value={selected.memo}
						oninput={() => selected && workspace.markEdited(selected.id)}
						placeholder="예: 2025년 결산 확정치"
					/>
				</label>

				{#if mismatch.length}
					<div
						class="rounded-md border border-status-warning/40 bg-status-warning-bg px-4 py-3 text-sm text-status-warning-ink"
					>
						<p class="font-semibold">하위 기간 합산과 다릅니다 — 직접 입력한 값을 씁니다</p>
						<ul class="mt-1 space-y-0.5">
							{#each mismatch as mm (mm.field)}
								<li>
									{mm.label}: 입력 {mm.field === 'headcount'
										? formatHeadcount(mm.manual)
										: won(mm.manual)}
									· 합산 {mm.field === 'headcount' ? formatHeadcount(mm.derived) : won(mm.derived)}
								</li>
							{/each}
						</ul>
						<p class="mt-1 text-xs">
							결산 조정으로 확정치가 다르면 그대로 두고, 입력 실수면 이 기간을 삭제해 합산값을
							쓰세요.
						</p>
					</div>
				{/if}
				{#if !errors.length}
					<p class="text-sm text-status-good-ink">
						입력값이 유효합니다. 변경 사항은 자동 저장됩니다.
					</p>
				{/if}
			</div>
		{:else}
			<p class="py-10 text-center text-muted">
				왼쪽 표에서 기간 행을 클릭하거나 새 기간을 추가하세요.
			</p>
		{/if}
	</section>
</div>
