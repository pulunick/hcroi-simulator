<script lang="ts">
	/**
	 * 결산서 PDF 에서 입력 값 뽑기 (docs/plans/pdf-to-excel.md §2).
	 * 파일마다 카드 하나 — 감지한 기간·회사명·표, 입력 칸별 후보 값과 출처, 직접 입력, 검증 경고.
	 * 확인이 끝나면 기존 엑셀 가져오기 미리보기로 넘긴다(자동 반영 없음). PDF 는 브라우저 메모리에서만 다룬다.
	 */
	import { workspace } from '$lib/state/workspace.svelte';
	import type { ParsedRecord } from '$lib/hcroi/excel/fromRows';
	import { validateRecord } from '$lib/hcroi/formulas';
	import { formatAmount, formatHeadcount, formatInt } from '$lib/hcroi/format';
	import { periodIndexCount, periodLabel } from '$lib/hcroi/period';
	import { PERIOD_TYPES, PERIOD_TYPE_LABELS, type Period, type PeriodType } from '$lib/hcroi/types';
	import type { DocScan } from '$lib/hcroi/pdf/locate';
	import {
		DEFAULT_HC_INCLUDE,
		FIELD_LABELS,
		HC_ITEM_KEYS,
		mapFields,
		periodForColumn,
		type Candidate,
		type FieldKey,
		type FieldMatch,
		type HcItemKey,
		type MapOptions,
		type PdfPrefs
	} from '$lib/hcroi/pdf/map';
	import { buildRecord, type BuildResult } from '$lib/hcroi/pdf/toRecord';

	interface Props {
		/** 확인이 끝난 값을 가져오기 미리보기로 넘긴다 */
		onpreview: (fileName: string, records: ParsedRecord[], companyName: string | null) => void;
		onclose: () => void;
	}
	let { onpreview, onclose }: Props = $props();

	interface FileState {
		id: number;
		name: string;
		status: 'reading' | 'ready' | 'error';
		progress: string;
		error: string | null;
		scan: DocScan | null;
		options: MapOptions;
		period: Period;
		/** 입력 칸별 고른 후보 순번 (기본 0 = 선호 후보) */
		chosen: Partial<Record<FieldKey, number>>;
		/** 직접 입력(원) — 후보 대신 쓴다 */
		manual: Partial<Record<FieldKey, number>>;
		/** 총 임직원 수 직접 입력 (명) */
		manualHeadcount: number | null;
		include: Record<HcItemKey, boolean>;
		/** 회사명으로 기억된 설정을 적용했음 */
		remembered: boolean;
	}

	let files = $state<FileState[]>([]);
	let seq = 0;
	const PL_KEYS: FieldKey[] = ['revenue', 'operatingCost', 'operatingProfit', 'cogs', 'sga'];
	const REPORT_KIND: Record<string, string> = {
		annual: '사업보고서',
		half: '반기보고서',
		quarter: '분기보고서'
	};

	const won = (v: number | null | undefined) => formatAmount(v, workspace.amountUnit);

	async function onFiles(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const list = Array.from(input.files ?? []);
		input.value = '';
		for (const f of list) await readOne(f);
	}

	async function readOne(f: File) {
		files.push({
			id: ++seq,
			name: f.name,
			status: 'reading',
			progress: '읽는 중…',
			error: null,
			scan: null,
			options: { consolidated: false, column: 'period' },
			period: { year: new Date().getFullYear(), type: 'Q', index: 1 },
			chosen: {},
			manual: {},
			manualHeadcount: null,
			include: { ...DEFAULT_HC_INCLUDE },
			remembered: false
		});
		const st = files[files.length - 1];
		try {
			const { extractPages } = await import('$lib/hcroi/pdf/extract');
			const { scanDocument } = await import('$lib/hcroi/pdf/locate');
			const pages = await extractPages(await f.arrayBuffer(), {
				onProgress: (d, t) => (st.progress = `${d}/${t}쪽 읽는 중…`)
			});
			const scan = scanDocument(pages);
			st.scan = scan;
			const pref = scan.cover.companyName ? workspace.pdfPrefs[scan.cover.companyName] : undefined;
			if (pref) {
				st.options = { consolidated: pref.consolidated, column: pref.column };
				st.include = { ...pref.include };
				st.remembered = true;
			}
			const p = periodForColumn(scan.cover, st.options.column);
			if (p) st.period = p;
			st.status = 'ready';
		} catch (err) {
			st.status = 'error';
			st.error = (err as Error).message;
		}
	}

	function fieldsOf(st: FileState): FieldMatch[] {
		return st.scan ? mapFields(st.scan, st.options) : [];
	}
	function candidateOf(st: FileState, fields: FieldMatch[], key: FieldKey): Candidate | undefined {
		const fm = fields.find((f) => f.key === key);
		return fm?.candidates[st.chosen[key] ?? 0];
	}
	function valueOf(st: FileState, fields: FieldMatch[], key: FieldKey): number | undefined {
		return st.manual[key] ?? candidateOf(st, fields, key)?.value;
	}
	function buildOf(st: FileState, fields: FieldMatch[]): BuildResult {
		const values: Partial<Record<FieldKey, number>> = {};
		for (const fm of fields) {
			const v = valueOf(st, fields, fm.key);
			if (v !== undefined) values[fm.key] = v;
		}
		const built = buildRecord({
			period: st.period,
			values,
			include: st.include,
			employees: st.scan?.employees[0] ?? null,
			basis: $state.snapshot(workspace.headcountBasis),
			payrollMonths: st.scan?.cover.spanMonths ?? null,
			memo: `PDF ${st.name} (${st.options.consolidated ? '연결' : '별도'} · ${st.options.column === 'period' ? '3개월' : '누적'} 열)`
		});
		if (st.manualHeadcount !== null) {
			built.record.inputs.headcount = st.manualHeadcount;
			built.record.headcountBreakdown = null;
			built.missing = built.missing.filter((m) => m !== '총 임직원 수');
		}
		return built;
	}
	function problemsOf(built: BuildResult): string[] {
		return built.missing.length
			? built.missing.map((m) => `${m} 값을 찾지 못했습니다 — 직접 입력하세요.`)
			: validateRecord(built.record);
	}

	function setColumn(st: FileState, column: MapOptions['column']) {
		st.options.column = column;
		const p = st.scan ? periodForColumn(st.scan.cover, column) : null;
		if (p) st.period = p;
	}
	function setPeriodType(st: FileState, type: PeriodType) {
		st.period = { year: st.period.year, type, index: 1 };
	}
	function sourceText(c: Candidate): string {
		const parts = [`${c.page}쪽`, c.rowLabel];
		if (c.column) parts.push(c.column);
		if (c.consolidated !== null) parts.push(c.consolidated ? '연결' : '별도');
		if (c.unitAssumed) parts.push('단위 문구 없음 → 원으로 가정');
		return parts.join(' · ');
	}
	function parseManual(raw: string): number | null {
		const cleaned = raw.replace(/[^\d.-]/g, '');
		if (!cleaned || cleaned === '-') return null;
		const n = Number(cleaned);
		return Number.isFinite(n) ? Math.round(n) : null;
	}
	function onManual(st: FileState, key: FieldKey, e: Event) {
		const n = parseManual((e.currentTarget as HTMLInputElement).value);
		if (n === null) delete st.manual[key];
		else st.manual[key] = n;
	}
	function onManualHeadcount(st: FileState, e: Event) {
		st.manualHeadcount = parseManual((e.currentTarget as HTMLInputElement).value);
	}

	function toParsed(st: FileState, row: number): ParsedRecord {
		const b = buildOf(st, fieldsOf(st));
		return { row, record: b.record, warnings: b.warnings };
	}
	/** 이 회사의 선택(연결/별도 · 열 · 인건비 항목)을 기억해 다음 파일부터 자동 적용 */
	function remember(st: FileState) {
		const name = st.scan?.cover.companyName;
		if (!name) return;
		const prefs: PdfPrefs = {
			consolidated: st.options.consolidated,
			column: st.options.column,
			include: { ...st.include }
		};
		workspace.pdfPrefs[name] = prefs;
	}
	function send(st: FileState) {
		remember(st);
		onpreview(st.name, [toParsed(st, 1)], st.scan?.cover.companyName ?? null);
		files = files.filter((x) => x.id !== st.id);
	}
	function sendAll() {
		const ready = files.filter(
			(f) => f.status === 'ready' && problemsOf(buildOf(f, fieldsOf(f))).length === 0
		);
		if (ready.length === 0) return;
		ready.forEach(remember);
		const names = new Set(ready.map((f) => f.scan?.cover.companyName ?? null));
		onpreview(
			ready.length === 1 ? ready[0].name : `결산서 PDF ${ready.length}건`,
			ready.map((f, i) => toParsed(f, i + 1)),
			names.size === 1 ? [...names][0] : null
		);
		files = files.filter((x) => !ready.includes(x));
	}
	function remove(st: FileState) {
		files = files.filter((x) => x.id !== st.id);
	}
</script>

<section class="card mb-6 px-5 py-5" aria-labelledby="pdf-h">
	<div class="mb-3 flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 id="pdf-h" class="text-lg font-semibold text-ink">결산서 PDF 에서 가져오기</h2>
			<p class="text-sm text-muted">
				DART 분기·반기·사업보고서 같은 <strong class="text-ink">텍스트 PDF</strong> 에서 매출액·영업이익·인건비·임직원
				수를 찾아 보여 줍니다. 값은 확인한 뒤 미리보기로 넘어가며, 파일은 브라우저 밖으로 나가지 않습니다.
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<label class="btn btn-primary">
				PDF 선택 (여러 개 가능)
				<input
					type="file"
					accept="application/pdf,.pdf"
					multiple
					class="sr-only"
					onchange={onFiles}
				/>
			</label>
			{#if files.filter((f) => f.status === 'ready').length > 1}
				<button type="button" class="btn btn-secondary" onclick={sendAll}
					>확인된 파일 모두 미리보기로</button
				>
			{/if}
			<button type="button" class="btn btn-ghost" onclick={onclose}>닫기</button>
		</div>
	</div>

	{#if files.length === 0}
		<p class="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
			분기마다 결산서 한 부씩 올리세요. 스캔 이미지(글자를 드래그해 복사할 수 없는 PDF)는 읽지
			못합니다.
		</p>
	{/if}

	{#each files as st (st.id)}
		{@const fields = fieldsOf(st)}
		{@const built = st.status === 'ready' ? buildOf(st, fields) : null}
		{@const problems = built ? problemsOf(built) : []}
		{@const emp = st.scan?.employees[0] ?? null}
		<article class="mb-4 rounded-lg border border-line bg-surface-2/40 p-4" aria-label={st.name}>
			<header class="mb-3 flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<h3 class="truncate font-semibold text-ink">{st.name}</h3>
					{#if st.status === 'reading'}
						<p class="text-sm text-muted">{st.progress}</p>
					{:else if st.status === 'error'}
						<p class="text-sm text-status-critical-ink">{st.error}</p>
					{:else if st.scan}
						<p class="text-sm text-muted">
							{st.scan.cover.companyName ?? '회사명 미확인'}
							{#if st.scan.cover.reportKind}· {REPORT_KIND[st.scan.cover.reportKind]}{/if}
							{#if st.scan.cover.term}· 제 {st.scan.cover.term} 기{/if}
							{#if st.scan.cover.start && st.scan.cover.end}
								· {st.scan.cover.start.y}.{st.scan.cover.start.m}.{st.scan.cover.start.d}~{st.scan
									.cover.end.m}.{st.scan.cover.end.d}
							{/if}
							· 표 {st.scan.tables.length}개 · 직원 현황 {st.scan.employees.length}개
							{#if st.remembered}<span
									class="ml-1 rounded bg-brand/10 px-1.5 py-0.5 text-xs text-brand"
									>이 회사의 저장된 설정 적용</span
								>{/if}
						</p>
					{/if}
				</div>
				<div class="flex flex-wrap items-center gap-2">
					{#if st.status === 'ready'}
						<button
							type="button"
							class="btn btn-primary"
							onclick={() => send(st)}
							disabled={problems.length > 0}>미리보기로 보내기</button
						>
					{/if}
					<button type="button" class="btn btn-ghost" onclick={() => remove(st)}>제거</button>
				</div>
			</header>

			{#if st.status === 'ready' && st.scan}
				<div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2">
					<label class="flex items-center gap-2 whitespace-nowrap">
						재무제표
						<select class="field-input py-1" bind:value={st.options.consolidated}>
							<option value={false}>별도</option>
							<option value={true}>연결</option>
						</select>
					</label>
					<label class="flex items-center gap-2 whitespace-nowrap">
						손익 열
						<select
							class="field-input py-1"
							value={st.options.column}
							onchange={(e) =>
								setColumn(st, (e.currentTarget as HTMLSelectElement).value as MapOptions['column'])}
						>
							<option value="period">3개월(해당 분기)</option>
							<option value="cumulative">누적(연초부터)</option>
						</select>
					</label>
					<div class="flex items-center gap-2 whitespace-nowrap">
						기간
						<input
							type="number"
							class="field-input w-24 py-1"
							bind:value={st.period.year}
							min="1990"
							max="2100"
						/>
						<select
							class="field-input py-1"
							value={st.period.type}
							onchange={(e) =>
								setPeriodType(st, (e.currentTarget as HTMLSelectElement).value as PeriodType)}
						>
							{#each PERIOD_TYPES as t (t)}
								<option value={t}>{PERIOD_TYPE_LABELS[t]}</option>
							{/each}
						</select>
						{#if periodIndexCount(st.period.type) > 1}
							<select class="field-input py-1" bind:value={st.period.index}>
								{#each Array.from({ length: periodIndexCount(st.period.type) }, (_, i) => i + 1) as i (i)}
									<option value={i}>{i}</option>
								{/each}
							</select>
						{/if}
						<span class="text-muted">→ {periodLabel(st.period)}</span>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead class="text-xs text-muted">
							<tr class="border-b border-line">
								<th class="py-1.5 pr-2 text-left font-medium">항목</th>
								<th class="py-1.5 pr-2 text-right font-medium">값</th>
								<th class="py-1.5 pr-2 text-left font-medium">출처 / 다른 후보</th>
								<th class="py-1.5 text-left font-medium">직접 입력(원)</th>
							</tr>
						</thead>
						<tbody>
							{#each PL_KEYS as key (key)}
								{@const fm = fields.find((f) => f.key === key)}
								{#if fm && (fm.candidates.length > 0 || key === 'revenue' || key === 'operatingProfit')}
									{@const c = candidateOf(st, fields, key)}
									<tr class="border-b border-line/60">
										<td class="py-1.5 pr-2 whitespace-nowrap text-ink">{FIELD_LABELS[key]}</td>
										<td
											class="tabular py-1.5 pr-2 text-right whitespace-nowrap"
											class:text-muted={st.manual[key] === undefined && !c}
										>
											{won(valueOf(st, fields, key)) || '—'}
										</td>
										<td class="py-1.5 pr-2 text-xs text-muted">
											{#if st.manual[key] !== undefined}
												직접 입력
											{:else if fm.candidates.length > 1}
												<select
													class="field-input max-w-md py-0.5 text-xs"
													bind:value={st.chosen[key]}
												>
													{#each fm.candidates as cand, i (i)}
														<option value={i}>{formatInt(cand.value)}원 — {sourceText(cand)}</option
														>
													{/each}
												</select>
											{:else if c}
												{sourceText(c)}
											{:else}
												찾지 못함
											{/if}
										</td>
										<td class="py-1.5">
											<input
												type="text"
												inputmode="numeric"
												class="tabular field-input w-40 py-0.5 text-right text-xs"
												placeholder="원 단위"
												value={st.manual[key] !== undefined ? formatInt(st.manual[key]) : ''}
												onchange={(e) => onManual(st, key, e)}
											/>
										</td>
									</tr>
								{/if}
							{/each}
							<tr class="border-b border-line bg-surface-2/60">
								<td colspan="4" class="py-1.5 pr-2 text-xs font-semibold text-ink-2">
									인건비 구성 (체크한 항목의 합 = 총 인건비 {won(built?.record.inputs.hcCost)})
								</td>
							</tr>
							{#each HC_ITEM_KEYS as key (key)}
								{@const fm = fields.find((f) => f.key === key)}
								{@const c = candidateOf(st, fields, key)}
								{#if (fm && fm.candidates.length > 0) || st.manual[key] !== undefined || DEFAULT_HC_INCLUDE[key]}
									<tr class="border-b border-line/60">
										<td class="py-1.5 pr-2 whitespace-nowrap">
											<label class="flex items-center gap-2 text-ink">
												<input
													type="checkbox"
													class="rounded border-line-2 text-brand"
													bind:checked={st.include[key]}
												/>
												{FIELD_LABELS[key]}
											</label>
										</td>
										<td
											class="tabular py-1.5 pr-2 text-right whitespace-nowrap"
											class:text-muted={valueOf(st, fields, key) === undefined}
										>
											{won(valueOf(st, fields, key)) || '—'}
										</td>
										<td class="py-1.5 pr-2 text-xs text-muted">
											{#if st.manual[key] !== undefined}
												직접 입력
											{:else if fm && fm.candidates.length > 1}
												<select
													class="field-input max-w-md py-0.5 text-xs"
													bind:value={st.chosen[key]}
												>
													{#each fm.candidates as cand, i (i)}
														<option value={i}>{formatInt(cand.value)}원 — {sourceText(cand)}</option
														>
													{/each}
												</select>
											{:else if c}
												{sourceText(c)}
											{:else}
												결산서에 없음
											{/if}
										</td>
										<td class="py-1.5">
											<input
												type="text"
												inputmode="numeric"
												class="tabular field-input w-40 py-0.5 text-right text-xs"
												placeholder="원 단위"
												value={st.manual[key] !== undefined ? formatInt(st.manual[key]) : ''}
												onchange={(e) => onManual(st, key, e)}
											/>
										</td>
									</tr>
								{/if}
							{/each}
							<tr class="border-b border-line bg-surface-2/60">
								<td colspan="4" class="py-1.5 pr-2 text-xs font-semibold text-ink-2">임직원 수</td>
							</tr>
							<tr>
								<td class="py-1.5 pr-2 whitespace-nowrap text-ink">총 임직원 수</td>
								<td class="tabular py-1.5 pr-2 text-right whitespace-nowrap">
									{built ? formatHeadcount(built.record.inputs.headcount) : '—'}
								</td>
								<td class="py-1.5 pr-2 text-xs text-muted">
									{#if st.manualHeadcount !== null}
										직접 입력
									{:else if emp}
										{emp.page}쪽 직원 등 현황 합계 · 정규직 {emp.regular ?? '?'} · 기간제 {emp.contract ??
											'?'}
										{#if emp.external !== null}· 소속 외 {emp.external}{/if}
										· 합계 {emp.total ?? '?'} ({emp.asOf ?? '기준일 미확인'} 기말)
										{#if !emp.sumVerified}· 검산 불일치{/if}
									{:else}
										직원 등 현황 표를 찾지 못함
									{/if}
								</td>
								<td class="py-1.5">
									<input
										type="text"
										inputmode="numeric"
										class="tabular field-input w-40 py-0.5 text-right text-xs"
										placeholder="명"
										value={st.manualHeadcount !== null ? formatInt(st.manualHeadcount) : ''}
										onchange={(e) => onManualHeadcount(st, e)}
									/>
								</td>
							</tr>
						</tbody>
					</table>
				</div>

				{#if problems.length}
					<ul
						class="mt-3 space-y-1 rounded-md border border-status-critical/40 bg-status-critical-bg px-4 py-2 text-sm text-status-critical-ink"
					>
						{#each problems as p, i (i)}<li>{p}</li>{/each}
					</ul>
				{/if}
				{#if built && built.warnings.length}
					<ul
						class="mt-3 space-y-1 rounded-md border border-status-warning/40 bg-status-warning-bg px-4 py-2 text-sm text-status-warning-ink"
					>
						{#each built.warnings as w, i (i)}<li>{w.replace(/\*\*/g, '')}</li>{/each}
					</ul>
				{/if}
			{/if}
		</article>
	{/each}
</section>
