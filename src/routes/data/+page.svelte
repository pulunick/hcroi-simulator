<script lang="ts">
	import { newId, workspace } from '$lib/state/workspace.svelte';
	import { mergeYears, parseInputRows, type ParseResult } from '$lib/hcroi/excel/fromRows';
	import { computeMetrics, gradeOf, sumHcCost, validateInputs } from '$lib/hcroi/formulas';
	import { estimateFromRevenue, splitHcCost, REFERENCE_DEFAULTS } from '$lib/hcroi/defaults';
	import { HC_COST_KEYS, HC_COST_LABELS } from '$lib/hcroi/types';
	import { formatHeadcount, formatKrwCompact, formatMultiple, formatWon } from '$lib/hcroi/format';
	import NumberField from '$lib/components/ui/NumberField.svelte';
	import GradeBadge from '$lib/components/ui/GradeBadge.svelte';

	let selectedId = $state<string | null>(null);
	const selected = $derived(
		workspace.years.find((y) => y.id === selectedId) ?? workspace.latestYear
	);
	const errors = $derived(selected ? validateInputs(selected.inputs) : []);

	let newYear = $state((workspace.latestYear?.year ?? new Date().getFullYear() - 1) + 1);
	let addError = $state<string | null>(null);
	function addYear() {
		addError = null;
		if (!Number.isInteger(newYear) || newYear < 1990 || newYear > 2100) {
			addError = '연도는 1990~2100 사이의 정수여야 합니다.';
			return;
		}
		if (workspace.hasYear(newYear)) {
			addError = `${newYear}년 데이터가 이미 있습니다.`;
			return;
		}
		const rec = workspace.addYear(newYear);
		selectedId = rec.id;
		newYear += 1;
	}
	/** 선택 연도의 값을 표준 레퍼런스 기본값으로 되돌린다 (매출액·인원은 유지) */
	function resetYear() {
		if (!selected) return;
		if (!confirm(`${selected.year}년 데이터를 표준 기본값으로 초기화할까요? (매출액·인원은 유지)`))
			return;
		const est = estimateFromRevenue(selected.inputs.revenue, selected.inputs.headcount);
		selected.inputs.operatingCost = est.operatingCost;
		selected.inputs.hcCost = est.hcCost;
		if (selected.breakdown) workspace.setBreakdown(selected.id, splitHcCost(est.hcCost));
	}
	function removeYear(id: string, year: number) {
		if (!confirm(`${year}년 데이터를 삭제할까요?`)) return;
		workspace.removeYear(id);
		if (selectedId === id) selectedId = null;
	}

	// 세부 내역이 있으면 총 인건비를 합계와 동기화
	$effect(() => {
		const y = selected;
		if (y?.breakdown) {
			const total = sumHcCost(y.breakdown);
			if (y.inputs.hcCost !== total) y.inputs.hcCost = total;
		}
	});
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

	// 가져오기 / 내보내기
	let fileInput = $state<HTMLInputElement | null>(null);
	let ioMessage = $state<string | null>(null);
	function exportJson() {
		const blob = new Blob([workspace.exportJson()], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `hcroi-workspace-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
	async function importJson(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const err = workspace.importJson(await file.text());
		ioMessage = err ?? `${file.name} 을(를) 불러왔습니다.`;
		selectedId = null;
		if (fileInput) fileInput.value = '';
	}
	// 엑셀 내보내기 / 템플릿 / 가져오기 (exceljs 는 io.ts 에서 동적 로드)
	let busy = $state(false);
	let preview = $state<{ fileName: string; result: ParseResult } | null>(null);
	let overwrite = $state(true);
	let skipErrors = $state(false);
	const today = () => new Date().toISOString().slice(0, 10);

	async function exportExcel() {
		busy = true;
		try {
			const { buildWorkbookBuffer, downloadBuffer } = await import('$lib/hcroi/excel/io');
			const buf = await buildWorkbookBuffer({
				years: $state.snapshot(workspace.years),
				scenarios: $state.snapshot(workspace.scenarios),
				baseYear: workspace.baseYear ? $state.snapshot(workspace.baseYear) : null
			});
			downloadBuffer(buf, `hcroi-${today()}.xlsx`);
			ioMessage = `엑셀 파일(hcroi-${today()}.xlsx)을 내려받았습니다. 시트: 지표 요약 · 입력 데이터 · 시나리오 비교 · 산식·가정`;
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
				'입력 템플릿(hcroi-template.xlsx)을 내려받았습니다. 샘플 3행을 자사 값으로 바꿔 "엑셀 가져오기" 하세요.';
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
			const { readInputSheet } = await import('$lib/hcroi/excel/io');
			const rows = await readInputSheet(await file.arrayBuffer());
			preview = { fileName: file.name, result: parseInputRows(rows) };
		} catch (err) {
			ioMessage = `엑셀 파일을 읽지 못했습니다: ${(err as Error).message}`;
		} finally {
			busy = false;
			input.value = '';
		}
	}
	type PreviewRow = {
		row: number;
		year: number | null;
		status: '신규' | '덮어씀' | '건너뜀' | '오류';
		inputs: { revenue: number; operatingCost: number; hcCost: number; headcount: number } | null;
		notes: string[];
	};
	const previewRows = $derived.by((): PreviewRow[] => {
		if (!preview) return [];
		const existing = new Set(workspace.years.map((y) => y.year));
		const rows: PreviewRow[] = [
			...preview.result.records.map((p): PreviewRow => ({
				row: p.row,
				year: p.record.year,
				status: existing.has(p.record.year) ? (overwrite ? '덮어씀' : '건너뜀') : '신규',
				inputs: p.record.inputs,
				notes: p.warnings
			})),
			...preview.result.errors.map((e): PreviewRow => ({
				row: e.row,
				year: e.year,
				status: '오류',
				inputs: null,
				notes: e.messages
			}))
		];
		return rows.sort((a, b) => a.row - b.row);
	});
	const canApply = $derived(
		!!preview &&
			!preview.result.headerError &&
			preview.result.records.length > 0 &&
			(preview.result.errors.length === 0 || skipErrors)
	);
	function applyImport() {
		if (!preview || !canApply) return;
		workspace.takeSnapshot();
		const r = mergeYears($state.snapshot(workspace.years), preview.result.records, {
			overwrite,
			newId
		});
		workspace.replaceYears(r.years);
		const parts = [`${r.added}개 연도 추가`, `${r.updated}개 덮어씀`];
		if (r.skipped) parts.push(`${r.skipped}개 건너뜀(기존 연도 유지)`);
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
		if (confirm('모든 연도 데이터를 삭제할까요? (되돌릴 수 없습니다)')) {
			workspace.clearAll();
			selectedId = null;
		}
	}
	const sharePct = REFERENCE_DEFAULTS.breakdownSharePct;
</script>

<svelte:head><title>데이터 관리 — HCROI</title></svelte:head>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl font-bold text-ink">데이터 관리</h1>
		<p class="mt-1 text-[15px] text-ink-2">
			연도별 재무·HR 데이터를 입력합니다. 총 인건비는 6개 항목의 세부 내역으로도 관리할 수 있습니다.
		</p>
	</div>
	<div class="flex flex-wrap items-center gap-2">
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

{#if preview}
	{@const res = preview.result}
	<section class="card mb-6 px-5 py-5" aria-labelledby="preview-h">
		<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
			<div>
				<h2 id="preview-h" class="text-lg font-semibold text-ink">가져오기 미리보기</h2>
				<p class="text-sm text-muted">
					{preview.fileName} — 정상 {res.records.length}행 · 오류 {res.errors.length}행. 아직
					반영되지 않았습니다.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<label class="flex items-center gap-2 text-sm text-ink-2">
					<input
						type="checkbox"
						class="rounded border-line-2 text-brand"
						bind:checked={overwrite}
					/>
					기존 연도 덮어쓰기
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
							<th scope="col" class="px-3 py-2 text-center font-semibold">연도</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">상태</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">매출액</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">영업이익</th>
							<th scope="col" class="px-3 py-2 text-center font-semibold">총 인건비</th>
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
								<td class="tabular px-3 py-2 font-semibold">{r.year ?? '—'}</td>
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
									>{r.inputs ? formatKrwCompact(r.inputs.revenue) : '—'}</td
								>
								<td class="tabular px-3 py-2 text-right"
									>{r.inputs
										? formatKrwCompact(r.inputs.revenue - r.inputs.operatingCost)
										: '—'}</td
								>
								<td class="tabular px-3 py-2 text-right"
									>{r.inputs ? formatKrwCompact(r.inputs.hcCost) : '—'}</td
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

<div class="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
	<!-- 연도 목록 -->
	<section class="card overflow-hidden" aria-labelledby="years-h">
		<div class="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
			<div>
				<h2 id="years-h" class="text-lg font-semibold text-ink">연도별 데이터</h2>
				<p class="text-xs text-muted">행을 클릭하면 오른쪽에서 편집할 수 있습니다</p>
			</div>
			<form
				class="flex items-center gap-2"
				onsubmit={(e) => {
					e.preventDefault();
					addYear();
				}}
			>
				<label class="text-sm font-semibold text-ink-2" for="new-year">연도 추가</label>
				<input
					id="new-year"
					type="number"
					class="field-input w-28 py-1.5"
					min="1990"
					max="2100"
					bind:value={newYear}
				/>
				<button type="submit" class="btn py-1.5 btn-primary">추가</button>
			</form>
		</div>
		{#if addError}<p class="px-5 pb-2 text-sm text-status-critical-ink">{addError}</p>{/if}
		<div class="relative overflow-x-auto">
			<table class="w-full min-w-[640px] text-[15px]">
				<thead>
					<tr class="border-y border-line bg-surface-2 text-sm text-ink-2">
						<th scope="col" class="px-4 py-2 text-center font-semibold">연도</th>
						<th scope="col" class="px-3 py-2 text-center font-semibold">매출액</th>
						<th scope="col" class="px-3 py-2 text-center font-semibold">영업이익</th>
						<th scope="col" class="px-3 py-2 text-center font-semibold">총 인건비</th>
						<th scope="col" class="px-3 py-2 text-center font-semibold">인원</th>
						<th scope="col" class="px-3 py-2 text-center font-semibold"
							><span class="ml-auto block w-36 text-center">HCROI</span></th
						>
						<th scope="col" class="w-12 px-2 py-2"><span class="sr-only">삭제</span></th>
					</tr>
				</thead>
				<tbody>
					{#each workspace.sortedYears as y (y.id)}
						{@const m = computeMetrics(y.inputs)}
						<tr
							class="cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2 {selected?.id ===
							y.id
								? 'bg-brand-tint/60 hover:bg-brand-tint/60'
								: ''}"
							aria-selected={selected?.id === y.id}
							onclick={() => (selectedId = y.id)}
						>
							<th scope="row" class="px-4 py-2 text-left align-middle font-semibold text-ink">
								<button
									type="button"
									class="underline-offset-2 hover:underline"
									onclick={() => (selectedId = y.id)}>{y.year}년</button
								>
								{#if y.id.startsWith('sample-')}<span
										class="ml-1 text-xs font-normal whitespace-nowrap text-muted">샘플</span
									>{/if}
							</th>
							<td class="tabular px-3 py-2 text-right align-middle"
								>{formatKrwCompact(y.inputs.revenue)}</td
							>
							<td class="tabular px-3 py-2 text-right align-middle"
								>{formatKrwCompact(m.operatingProfit)}</td
							>
							<td class="tabular px-3 py-2 text-right align-middle"
								>{formatKrwCompact(y.inputs.hcCost)}</td
							>
							<td class="tabular px-3 py-2 text-right align-middle"
								>{formatHeadcount(y.inputs.headcount)}</td
							>
							<td class="tabular px-3 py-2 text-right align-middle"
								><span class="inline-flex w-36 items-center justify-end gap-2"
									><span class="tabular">{formatMultiple(m.hcroi)}</span><span
										class="inline-flex w-[4.75rem] justify-end"
										><GradeBadge grade={gradeOf(m.hcroi)} /></span
									></span
								></td
							>
							<td class="px-2 py-2 text-right align-middle">
								<button
									type="button"
									class="btn p-1.5 btn-ghost text-status-critical-ink hover:bg-status-critical-bg"
									aria-label="{y.year}년 삭제"
									title="{y.year}년 삭제"
									onclick={(e) => {
										e.stopPropagation();
										removeYear(y.id, y.year);
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
							</td>
						</tr>
					{:else}
						<tr
							><td colspan="7" class="px-4 py-8 text-center text-muted"
								>데이터가 없습니다. 연도를 추가하거나 샘플로 초기화하세요.</td
							></tr
						>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<!-- 편집 패널 -->
	<section class="card px-5 py-5" aria-labelledby="edit-h">
		{#if selected}
			<div class="mb-4 flex items-center justify-between gap-3">
				<h2 id="edit-h" class="text-lg font-semibold text-ink">{selected.year}년 데이터 편집</h2>
				<button
					type="button"
					class="btn py-1 text-sm btn-secondary"
					title="표준 기본값(매출 대비 인건비 22%, 영업이익률 8%)으로 되돌립니다. 매출액·인원은 유지"
					onclick={resetYear}>초기화</button
				>
			</div>
			<div class="space-y-4">
				<NumberField label="매출액" bind:value={selected.inputs.revenue} min={0} />
				<NumberField
					label="영업비용 (인건비 포함)"
					bind:value={selected.inputs.operatingCost}
					min={0}
					help="영업이익 = {formatKrwCompact(
						selected.inputs.revenue - selected.inputs.operatingCost
					)}"
				/>
				<NumberField
					label="총 임직원 수"
					bind:value={selected.inputs.headcount}
					unit="명"
					min={1}
				/>

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
									label="{HC_COST_LABELS[k]} ({sharePct[k]}%)"
									bind:value={selected.breakdown[k]}
									min={0}
								/>
							{/each}
						</div>
						<div
							class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3"
						>
							<div class="text-[15px]">
								합계 <strong class="tabular">{formatWon(selected.inputs.hcCost)}</strong>
								<span class="text-sm text-muted"
									>(= {formatKrwCompact(selected.inputs.hcCost)})</span
								>
							</div>
							<button type="button" class="btn py-1 text-sm btn-ghost" onclick={redistribute}
								>기본 구성비로 재분배</button
							>
						</div>
						<p class="mt-2 text-xs text-muted">
							괄호 안 % 는 표준 레퍼런스 구성비(기본급 62 · 성과급/수당 14 · 퇴직급여 8 · 법정후생비
							9 · 기타 복리후생 5 · 교육훈련 2)입니다. 자사 실적으로 교체하세요.
						</p>
					{:else}
						<NumberField
							label="총 인건비 (총액)"
							bind:value={selected.inputs.hcCost}
							min={0}
							help="기본급+성과급/수당+퇴직급여+법정후생비+기타 복리후생비+교육훈련비"
						/>
					{/if}
				</div>

				<label class="block">
					<span class="text-sm font-semibold text-ink-2">메모</span>
					<input
						class="mt-1 field-input"
						bind:value={selected.memo}
						placeholder="예: 2025년 결산 확정치"
					/>
				</label>

				{#if errors.length}
					<ul
						class="space-y-1 rounded-md border border-status-critical/40 bg-status-critical-bg px-4 py-3 text-sm text-status-critical-ink"
					>
						{#each errors as e (e)}<li>{e}</li>{/each}
					</ul>
				{:else}
					<p class="text-sm text-status-good-ink">
						입력값이 유효합니다. 변경 사항은 자동 저장됩니다.
					</p>
				{/if}
			</div>
		{:else}
			<p class="py-10 text-center text-muted">
				왼쪽 표에서 연도 행을 클릭하거나 새 연도를 추가하세요.
			</p>
		{/if}
	</section>
</div>
