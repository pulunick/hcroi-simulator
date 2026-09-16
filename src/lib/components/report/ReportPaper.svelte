<script lang="ts">
	/**
	 * 경영진 리포트 A4 한 장 (794×1123px).
	 *
	 * - **항상 밝은 테마**다. 인쇄물이므로 화면이 어둡든 종이는 흰색·먹색으로 고정한다
	 *   (`color-scheme: light` + 아래 `--r-*` 지역 변수. 앱 토큰을 쓰지 않는다).
	 * - 흑백 인쇄에서도 읽혀야 하므로 색으로만 구분하지 않는다 — 선·굵기·값 라벨로 읽힌다.
	 * - 값은 전부 코어(`src/lib/hcroi/**`)가 계산하고, 배치·문장 엮기는 `src/lib/report/data.ts` 가 한다.
	 */
	import wordmark from '$lib/assets/headroom-wordmark.svg';
	import { PRODUCT_NAME, SITE_ENABLED } from '$lib/site-config';
	import ReportTrendChart from './ReportTrendChart.svelte';
	import { periodLabel, periodShortLabel } from '$lib/hcroi/period';
	import {
		columnUnitSuffix,
		formatAmount,
		formatCellAmount,
		formatInt,
		formatPct,
		formatSigned,
		headcountBasisLabel,
		multipleToPct,
		type AmountUnit
	} from '$lib/hcroi/format';
	import type { HeadcountBasis, PeriodRecord, Scenario } from '$lib/hcroi/types';
	import {
		MODEL_CAVEAT,
		efficiencySentence,
		gapSentence,
		gradeRangeText,
		hcroiPerWon,
		reportHeadline,
		reportInsights,
		reportKpis,
		reportScenarioRows,
		reportTrendRows,
		sameTypeUpTo,
		scenarioHeading,
		splitMultiple,
		trendHeading,
		variableCostCaution,
		verdictTail,
		TREND_COUNT
	} from '$lib/report/data';

	let {
		record,
		prev,
		effective,
		scenarios,
		basis,
		amountUnit,
		orgName,
		author,
		authorOrg,
		today
	}: {
		record: PeriodRecord;
		prev: PeriodRecord | null;
		effective: PeriodRecord[];
		scenarios: Scenario[];
		basis: HeadcountBasis;
		amountUnit: AmountUnit;
		orgName: string;
		author: string;
		authorOrg: string;
		today: string;
	} = $props();

	const cellWon = (v: number | null | undefined) => formatCellAmount(v, amountUnit);
	const colUnit = $derived(columnUnitSuffix(amountUnit));

	const head = $derived(reportHeadline(record, prev));
	const hcroiBox = $derived(splitMultiple(head.hcroi));
	const tail = $derived(verdictTail(head));
	const efficiency = $derived(efficiencySentence(record, prev));
	const gap = $derived(gapSentence(record.inputs, amountUnit));
	const kpis = $derived(reportKpis(record, prev, headcountBasisLabel(basis)));

	const trendRows = $derived(reportTrendRows(effective, record.period, TREND_COUNT));
	const trendPoints = $derived(
		trendRows.map((r) => ({
			label: periodShortLabel(r.record.period),
			value: r.metrics.hcroi,
			reference: r.reference
		}))
	);
	const trendTitle = $derived(trendHeading(record.period.type, trendRows.length));

	const scenarioRows = $derived(reportScenarioRows(record, scenarios));
	const caution = $derived(variableCostCaution(record.inputs, scenarios, amountUnit));
	const footnote = $derived(['※', caution, MODEL_CAVEAT].filter(Boolean).join(' '));
	/** 추이 인사이트는 같은 유형·보고 기간까지만 넘긴다 (유형이 섞이면 분기와 연간을 비교하게 된다) */
	const trendRecords = $derived(sameTypeUpTo(effective, record.period));
	const insights = $derived(reportInsights(record, trendRecords, scenarios, amountUnit, 3));

	const title = $derived(
		orgName.trim()
			? `${orgName.trim()} · ${periodLabel(record.period)}`
			: periodLabel(record.period)
	);
	const byline = $derived([author.trim(), authorOrg.trim()].filter(Boolean).join(' · '));
	const gradeScale = $derived(
		`등급 ${gradeRangeText('critical')} 위험 · ${gradeRangeText('warning')} 보통 · ${gradeRangeText('excellent')} 우수`
	);

	/**
	 * 내용이 한 장을 넘치면 압축한다 (인쇄는 1장이 원칙) — 두 단계.
	 *  1단계(compact): 글자를 한 단계 줄인다.
	 *  2단계(compact2): 글자를 한 번 더 줄이고 추이 표(칸)를 생략한다(꺾은선 차트는 남긴다).
	 * 실제 넘침 여부는 `.content`(부모 `.paper` 의 overflow:hidden·고정 높이와 무관하게 내용 그대로의
	 * 자연 높이를 갖는 감싸개)를 ResizeObserver 로 관찰해 판단한다 — 회사명·문장·수치 중 무엇이 바뀌어도
	 * 실제 렌더 크기 변화로 잡아낸다. (예전엔 특정 값(레코드 id·행 수 등)만 골라 만든 "신호"가 바뀔 때만
	 * 다시 쟀는데, 그 목록에 회사명이 빠져 있어 회사명이 아무리 길어져도 재측정이 안 됐다.)
	 * 폰트가 아직 안 실렸을 때 재면 실제보다 짧게 잡히므로 `document.fonts.ready` 이후에도 다시 잰다.
	 */
	let paperEl = $state<HTMLElement | null>(null);
	let contentEl = $state<HTMLElement | null>(null);
	let level = $state<0 | 1 | 2>(0);
	const compact = $derived(level >= 1);
	const compact2 = $derived(level >= 2);

	function measure() {
		const paper = paperEl;
		const content = contentEl;
		if (!paper || !content) return;
		if (content.scrollHeight > paper.clientHeight + 1 && level < 2) {
			level = (level + 1) as 0 | 1 | 2;
		}
	}

	// 표시할 데이터 자체가 바뀌면 압축 단계부터 다시 잰다 — 짧아진 내용까지 계속 압축돼 있지 않도록.
	// (아래 ResizeObserver 가 실제 넘침을 잡아내는 본체이고, 이 신호는 "새로 잴 시점"을 알리는 역할일 뿐이라
	// 예전과 달리 여기 목록이 불완전해도 안전망이 잡아낸다)
	const signature = $derived(
		[
			record.id,
			trendRows.length,
			scenarioRows.length,
			insights.length,
			amountUnit,
			orgName,
			byline
		].join('|')
	);
	$effect(() => {
		void signature;
		level = 0;
		let cancelled = false;
		const remeasure = () => {
			if (cancelled) return;
			requestAnimationFrame(() => {
				if (!cancelled) measure();
			});
		};
		if (typeof document !== 'undefined' && document.fonts?.ready) {
			document.fonts.ready.then(remeasure);
		} else {
			remeasure();
		}
		return () => {
			cancelled = true;
		};
	});

	// 안전망 — 위 신호가 놓친 변화까지 `.content` 의 실제 렌더 크기 변화로 잡아낸다.
	// 압축 단계를 낮추지는 않고(깜빡임 방지) 넘칠 때만 올린다.
	$effect(() => {
		const content = contentEl;
		if (!content || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => measure());
		ro.observe(content);
		return () => ro.disconnect();
	});
</script>

<div class="paper" class:compact class:compact2 bind:this={paperEl}>
	<div class="content" bind:this={contentEl}>
		<header class="head">
			<div class="head-title">
				<span class="label">인적자본 투자효율 보고 · HCROI</span>
				<h1>{title}</h1>
			</div>
			<div class="head-meta">
				작성 {today}{#if byline}<br />작성자 {byline}{/if}
			</div>
		</header>

		<section class="judgment">
			<div class="judgment-text">
				<p class="verdict">
					인건비 1원당 {hcroiPerWon(head.hcroi)}을 벌었습니다. 등급은
					<span class="grade">{head.gradeLabel}</span>{tail}
				</p>
				{#if efficiency || gap}
					<p class="sub">{[efficiency, gap].filter(Boolean).join(' ')}</p>
				{/if}
			</div>
			<div class="hcroi-box">
				<span class="label">HCROI</span>
				<div class="hcroi-value mono">
					{hcroiBox.value}<span class="hcroi-unit">{hcroiBox.unit}</span>
				</div>
				<div class="hcroi-note">
					= {multipleToPct(head.hcroi)} · {head.gradeLabel} ({head.gradeRange})
				</div>
			</div>
		</section>

		<section class="kpis">
			{#each kpis as k (k.label)}
				<div class="kpi">
					<div class="kpi-label">
						{k.label}{#if k.note}<span class="kpi-note"> ({k.note})</span>{/if}
					</div>
					<div class="kpi-value mono">
						{k.kind === 'headcount' ? `${formatInt(k.value)}명` : formatAmount(k.value, amountUnit)}
					</div>
					<div class="kpi-delta" class:kpi-delta-neutral={k.kind === 'headcount'}>
						{#if k.kind === 'headcount'}
							{k.deltaCount === null
								? `${head.prevWord} 자료 없음`
								: `${head.prevWord} ${formatSigned(k.deltaCount, (n) => `${n}명`)}`}
						{:else}
							{k.deltaPct === null
								? `${head.prevWord} 자료 없음`
								: `${head.prevWord} ${formatSigned(k.deltaPct, (n) => formatPct(n))}`}
						{/if}
					</div>
				</div>
			{/each}
		</section>

		<section class="block">
			<h2>1. {trendTitle}</h2>
			<div class="trend">
				<ReportTrendChart points={trendPoints} ariaLabel="{trendTitle} HCROI 꺾은선" />
				{#if !compact2}
					<table>
						<thead>
							<tr>
								<th>기간</th>
								<th class="num">영업이익{colUnit}</th>
								<th class="num">총 인건비{colUnit}</th>
								<th class="num">임직원 (명)</th>
								<th class="num">HCROI (배)</th>
							</tr>
						</thead>
						<tbody>
							{#each trendRows as r (r.record.id)}
								<tr>
									<td
										>{periodLabel(r.record.period)}{#if r.reference}<span class="tag"
												>연간 참조</span
											>{:else if r.record.derived}<span class="tag">합산</span>{/if}</td
									>
									<td class="num">{cellWon(r.metrics.operatingProfit)}</td>
									<td class="num">{cellWon(r.record.inputs.hcCost)}</td>
									<td class="num">{formatInt(r.record.inputs.headcount)}</td>
									<td class="num">{splitMultiple(r.metrics.hcroi).value}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<!-- 2단계 압축 — 한 장에 맞추려고 추이 표는 생략하고 차트만 남긴다 -->
					<p class="note">표는 한 장 인쇄를 위해 생략했습니다. 값은 화면 데이터에서 확인하세요.</p>
				{/if}
			</div>
		</section>

		<section class="block">
			<h2>2. {scenarioHeading(record.period)}</h2>
			<table>
				<thead>
					<tr>
						<th>시나리오</th>
						<th>가정</th>
						<th class="num">임직원 (명)</th>
						<th class="num">총 인건비{colUnit}</th>
						<th class="num">영업이익{colUnit}</th>
						<th class="num">HCROI (배)</th>
						<th>등급</th>
					</tr>
				</thead>
				<tbody>
					{#each scenarioRows as row (row.key)}
						<tr>
							<td class="strong">{row.name}</td>
							<td class="wrap">{row.assumption}</td>
							<td class="num">{formatInt(row.inputs.headcount)}</td>
							<td class="num">{cellWon(row.inputs.hcCost)}</td>
							<td class="num">{cellWon(row.metrics.operatingProfit)}</td>
							<td class="num">{splitMultiple(row.metrics.hcroi).value}</td>
							<td class={row.grade === 'excellent' ? 'strong' : ''}>{row.gradeLabel}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="note">{footnote}</p>
		</section>

		<section class="block">
			<h2>3. 판단과 제안</h2>
			{#if insights.length}
				<ol class="insights">
					{#each insights as i (i.title + i.body)}
						<li><strong>{i.title}</strong> — {i.body}</li>
					{/each}
				</ol>
			{:else}
				<p class="note">
					같은 유형의 기간이 2개 이상 있고 시나리오가 설정되면 판단과 제안이 채워집니다.
				</p>
			{/if}
		</section>

		<footer class="foot">
			<p>
				HCROI = (영업이익 + 총 인건비) ÷ 총 인건비 · HCVA = (영업이익 + 총 인건비) ÷ 총 임직원 수 ·
				총 인건비 = 기본급 + 성과급/수당 + 퇴직급여 + 법정후생비 + 기타 복리후생비 + 교육훈련비.
				{gradeScale}.
			</p>
			<div class="foot-row">
				<span>{PRODUCT_NAME} 으로 작성 · 수치는 회사가 입력한 결산 자료 기준</span>
				<span class="foot-mark">
					<!-- 워드마크는 공개판 표식 — 사내 도구(SITE_ENABLED=false)에서는 쪽 번호만 -->
					{#if SITE_ENABLED}<img src={wordmark} alt="Headroom" />{/if}
					<span class="mono">1 / 1</span>
				</span>
			</div>
		</footer>
	</div>
</div>

<style>
	/*
	 * 종이 팔레트 — 앱 토큰(--color-*)을 쓰지 않고 여기서 고정한다.
	 * 다크모드에서도 리포트는 흰 종이·먹색 글자여야 하고, 인쇄에서는 배경색이 빠져도 읽혀야 한다.
	 */
	.paper {
		--r-paper: #ffffff;
		--r-ink: #1a1917;
		--r-ink-2: #4a4741;
		--r-muted: #7d786f;
		--r-line: #d9d4c9;
		color-scheme: light;

		width: 794px;
		height: 1123px;
		flex-shrink: 0;
		box-sizing: border-box;
		padding: 48px 56px;
		background: var(--r-paper);
		color: var(--r-ink);
		font-family: var(--font-sans);
		font-size: 16px;
		line-height: 1.55;
		overflow: hidden;
	}
	/*
	 * 실제 내용 높이를 재는 감싸개. `.paper` 는 화면용으로 고정 크기 + overflow:hidden 이라
	 * 넘친 내용이 잘려 보이지만, 잘리지 않은 "내용 그대로"의 자연 높이가 필요하다 — 이 div 는
	 * 스스로 높이를 정하지 않으므로(overflow 도 없음) `scrollHeight` 가 곧 실제 필요한 높이가 된다.
	 * ReportPaper 스크립트가 여기를 ResizeObserver 로 관찰해 `.paper` 의 clientHeight 와 비교한다.
	 */
	.content {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}
	/* 한 장을 넘칠 때의 1단계 축소 */
	.paper.compact {
		font-size: 14px;
	}
	.paper.compact .content {
		gap: 12px;
	}
	.paper.compact .verdict {
		font-size: 18px;
	}
	.paper.compact td,
	.paper.compact .insights {
		font-size: 12px;
	}
	/* 그래도 넘칠 때의 2단계 축소 — 글자를 한 번 더 줄인다. 추이 표 생략은 템플릿(compact2)에서 처리 */
	.paper.compact2 {
		font-size: 12px;
	}
	.paper.compact2 .content {
		gap: 8px;
	}
	.paper.compact2 .verdict {
		font-size: 16px;
	}
	.paper.compact2 td,
	.paper.compact2 .insights {
		font-size: 11px;
	}

	.mono {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.label {
		font-family: var(--font-mono);
		font-size: 12px;
		letter-spacing: 0.08em;
		color: var(--r-muted);
	}

	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 24px;
		border-bottom: 2px solid var(--r-ink);
		padding-bottom: 14px;
	}
	.head-title {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
	}
	.paper h1 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 22px;
		letter-spacing: -0.01em;
		line-height: 1.3;
	}
	.head-meta {
		text-align: right;
		font-size: 12px;
		color: var(--r-ink-2);
		line-height: 1.5;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.judgment {
		display: flex;
		gap: 20px;
		align-items: stretch;
	}
	.judgment-text {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.paper p {
		margin: 0;
	}
	.verdict {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 21px;
		line-height: 1.4;
		text-wrap: pretty;
	}
	.grade {
		border-bottom: 2px solid var(--r-ink);
	}
	.sub {
		font-size: 14px;
		color: var(--r-ink-2);
		line-height: 1.6;
		text-wrap: pretty;
	}
	.hcroi-box {
		width: 170px;
		flex-shrink: 0;
		border: 1px solid var(--r-ink);
		border-radius: 2px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: center;
		justify-content: center;
	}
	.hcroi-value {
		font-size: 40px;
		font-weight: 500;
		letter-spacing: -0.02em;
		line-height: 1;
	}
	.hcroi-unit {
		font-size: 18px;
		font-weight: 500;
	}
	.hcroi-note {
		font-size: 12px;
		color: var(--r-muted);
		text-align: center;
	}

	.kpis {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
	}
	.kpi {
		border-top: 1px solid var(--r-ink);
		padding-top: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.kpi-label {
		font-size: 12px;
		color: var(--r-muted);
		line-height: 1.35;
	}
	.kpi-note {
		white-space: nowrap;
	}
	.kpi-value {
		font-size: 18px;
		font-weight: 500;
	}
	.kpi-delta {
		font-size: 12px;
		color: var(--r-ink-2);
	}
	/* 임직원 수 증감은 좋고 나쁨이 없다 — 한 단계 연한 회색 (2026-09-15 결정) */
	.kpi-delta-neutral {
		color: var(--r-muted);
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: 8px;
		break-inside: avoid;
	}
	.paper h2 {
		margin: 0;
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15px;
		line-height: 1.4;
	}
	.trend {
		display: flex;
		gap: 20px;
		align-items: flex-start;
	}
	.trend table {
		min-width: 0;
	}

	.paper table {
		border-collapse: collapse;
		width: 100%;
	}
	.paper th {
		text-align: left;
		font-weight: 500;
		color: var(--r-muted);
		font-size: 11px;
		line-height: 1.3;
		padding: 6px 8px;
		white-space: nowrap;
		border-bottom: 1px solid var(--r-ink);
		vertical-align: bottom;
	}
	.paper td {
		padding: 7px 8px;
		border-bottom: 1px solid var(--r-line);
		font-size: 13px;
		white-space: nowrap;
		vertical-align: top;
	}
	.paper td.wrap {
		white-space: normal;
		line-height: 1.4;
	}
	.paper td.num,
	.paper th.num {
		text-align: right;
	}
	.paper td.num {
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
	}
	.paper td.strong {
		font-weight: 600;
	}
	.tag {
		margin-left: 4px;
		font-size: 10px;
		color: var(--r-muted);
	}

	.note {
		font-size: 12px;
		color: var(--r-ink-2);
		line-height: 1.5;
		text-wrap: pretty;
	}
	.insights {
		margin: 0;
		padding-left: 20px;
		font-size: 13px;
		line-height: 1.55;
		text-wrap: pretty;
		list-style: decimal;
	}
	.insights li + li {
		margin-top: 3px;
	}

	.foot {
		margin-top: auto;
		border-top: 1px solid var(--r-ink);
		padding-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 11px;
		color: var(--r-muted);
		line-height: 1.5;
	}
	.foot-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.foot-mark {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.foot-mark img {
		height: 11px;
		width: auto;
		display: block;
		opacity: 0.7;
	}

	/*
	 * 인쇄: 화면용 고정 폭·높이(794×1123px)는 풀어야 종이가 실제 A4 물리 페이지에 맞는다.
	 * 여백은 `@page` 의 margin 이 아니라 여기 `.paper` 의 padding 으로 낸다 — 이름 있는 `@page` 의
	 * margin 은 Chrome 에서 안정적으로 먹지 않는 경우가 있어(페이지 크기(size)만 적용되고 margin 은
	 * 무시되는 사례) 그걸 여백의 유일한 근거로 두면 글자가 종이 가장자리에 붙어버린다. 그래서
	 * `@page report` 는 margin:0 으로 두고(브라우저 기본 여백과 이중으로 겹치지 않게), 이 종이가
	 * `page: report` 로 지정된 A4 페이지 박스(210×297mm)를 그대로 채운 뒤 padding 으로 화면과
	 * 같은 비율의 여백을 낸다. 값은 화면 padding(48px 56px ≈ 12.7mm 14.8mm)과 같은 비율.
	 */
	@media print {
		.paper {
			width: auto;
			height: auto;
			min-height: 0;
			padding: 14mm 16mm;
			overflow: visible;
			/* +page.svelte 의 `@page report { size: A4; margin: 0 }` 를 이 종이에만 건다 */
			page: report;
		}
	}
</style>
