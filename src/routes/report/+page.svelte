<script lang="ts">
	/**
	 * 경영진 리포트 — 인쇄용 A4 한 장.
	 *
	 * 화면에는 도구 줄(기간·작성자·인쇄 버튼)이 위에 붙고, 그 아래 종이가 원본 크기(794px)로 놓인다.
	 * 인쇄(`window.print()`)하면 앱 헤더·탭·도구 줄이 빠지고 종이만 A4 한 장으로 나간다 — PDF 생성 라이브러리를 쓰지 않는다.
	 * 종이 자체는 다크모드에서도 흰색이다(`ReportPaper.svelte`).
	 */
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { workspace } from '$lib/state/workspace.svelte';
	import { periodLabel } from '$lib/hcroi/period';
	import ReportPaper from '$lib/components/report/ReportPaper.svelte';
	import { reportBlocker, todayText } from '$lib/report/data';

	/** 조회 기간 — 대시보드와 같은 규칙(합산 포함 목록에서 고르고, 기본은 시뮬레이터 기준 기간) */
	let selectedId = $state<string | null>(null);
	const rec = $derived(workspace.effective.find((r) => r.id === selectedId) ?? workspace.base);
	const prev = $derived(rec ? workspace.previousOf(rec) : null);
	/**
	 * 리포트 재료 — `workspace.loaded` 전에는 판단하지 않는다. 로드 전 상태는 아직 localStorage 를
	 * 읽지 않은 초기 샘플이라, 그대로 그리면 지운 데이터가 인쇄될 수 있다(2026-09-15).
	 */
	const blocker = $derived(workspace.loaded ? reportBlocker(rec) : { kind: 'no-data' as const });
	const today = todayText();
	/** 회사 이름이 비어 있으면 머리글이 빈 채로 인쇄된다 — 막지는 않고 알리기만 한다 */
	const missingOrgName = $derived(workspace.orgName.trim() === '');

	// 인쇄 규칙(헤더·탭·도구 줄 숨김)은 이 화면에서만 켠다 — 다른 화면 인쇄에 영향을 주지 않도록 클래스로 가둔다
	onMount(() => {
		document.documentElement.classList.add('report-print');
		return () => document.documentElement.classList.remove('report-print');
	});
</script>

<svelte:head><title>{workspace.pageTitle('리포트')}</title></svelte:head>

<div class="tools mb-5">
	<div class="mb-4 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-ink">경영진 리포트</h1>
			<p class="mt-1 text-[15px] text-ink-2">
				A4 한 장으로 인쇄합니다. 회사 이름은 상단의 회사 이름을 눌러 바꿉니다.
			</p>
		</div>
		<div class="flex flex-col items-end gap-1">
			<button
				type="button"
				class="btn btn-primary"
				disabled={!!blocker}
				onclick={() => window.print()}>인쇄 / PDF 저장</button
			>
			<span class="text-xs text-muted">
				{blocker
					? '데이터를 입력하면 인쇄할 수 있습니다'
					: "브라우저 인쇄 대화상자에서 'PDF 로 저장'을 고르세요"}
			</span>
		</div>
	</div>

	{#if missingOrgName && !blocker}
		<p
			class="mb-3 rounded-md border border-status-warning/40 bg-status-warning-bg px-4 py-2 text-sm text-status-warning-ink"
			role="status"
		>
			회사 이름이 비어 있습니다 — 상단에서 입력하세요. (비워 둔 채로도 인쇄는 됩니다)
		</p>
	{/if}

	<div class="card flex flex-wrap items-end gap-4 px-4 py-3">
		{#if workspace.effective.length}
			<label class="flex flex-col gap-1 text-sm font-semibold text-ink-2">
				조회 기간
				<select
					class="field-input w-auto py-1.5"
					value={rec?.id ?? ''}
					onchange={(e) => (selectedId = (e.currentTarget as HTMLSelectElement).value || null)}
				>
					{#each workspace.effective as r (r.id)}
						<option value={r.id}>{periodLabel(r.period)}{r.derived ? ' · 합산' : ''}</option>
					{/each}
				</select>
			</label>
		{/if}
		<label class="flex flex-col gap-1 text-sm font-semibold text-ink-2">
			작성자
			<input
				class="field-input w-40 py-1.5"
				placeholder="이름"
				bind:value={workspace.reportAuthor}
			/>
		</label>
		<label class="flex flex-col gap-1 text-sm font-semibold text-ink-2">
			소속
			<input
				class="field-input w-40 py-1.5"
				placeholder="인사팀"
				bind:value={workspace.reportOrg}
			/>
		</label>
		<p class="text-xs text-muted">
			작성자·소속은 이 PC 에 기억됩니다 (리포트 머리글에만 쓰입니다).
		</p>
	</div>
</div>

{#if blocker}
	<div class="card px-6 py-12 text-center">
		{#if blocker.kind === 'invalid'}
			<p class="text-ink">이 기간의 입력값에 오류가 있어 리포트를 만들 수 없습니다.</p>
			<ul class="mt-2 space-y-1 text-sm text-status-critical-ink">
				{#each blocker.errors as e (e)}<li>{e}</li>{/each}
			</ul>
		{:else if blocker.kind === 'no-metrics'}
			<p class="text-ink">총 인건비가 0이어서 HCROI 를 계산할 수 없습니다.</p>
		{:else}
			<p class="text-ink">아직 입력된 데이터가 없습니다.</p>
		{/if}
		<div class="mt-4 flex justify-center gap-2">
			<a href={resolve('/data')} class="btn btn-primary">데이터 화면에서 기간을 입력하세요</a>
			{#if blocker.kind === 'no-data'}
				<button type="button" class="btn btn-secondary" onclick={() => workspace.resetToSample()}
					>샘플 데이터로 시작</button
				>
			{/if}
		</div>
	</div>
{:else if rec}
	<!-- 모바일에서도 종이는 794px 원본 폭을 지킨다 (인쇄물이라 축소하지 않는다) — 가로 스크롤로 본다 -->
	<div class="paper-scroll">
		<ReportPaper
			record={rec}
			{prev}
			effective={workspace.validEffective}
			scenarios={workspace.scenarios}
			basis={workspace.headcountBasis}
			amountUnit={workspace.amountUnit}
			orgName={workspace.orgName}
			author={workspace.reportAuthor}
			authorOrg={workspace.reportOrg}
			{today}
		/>
	</div>
{/if}

<style>
	.paper-scroll {
		overflow-x: auto;
		padding-bottom: 8px;
		display: flex;
		justify-content: flex-start;
	}
	@media (min-width: 900px) {
		.paper-scroll {
			justify-content: center;
		}
	}

	@media print {
		/*
		 * 종이만 남긴다 — 앱 헤더·탭·푸터·도구 줄은 인쇄하지 않는다.
		 * 리포트 종이 안에도 <header class="head">·<footer class="foot"> 가 있으므로 그 둘은 제외한다.
		 */
		:global(html.report-print header:not(.head)),
		:global(html.report-print footer:not(.foot)),
		.tools {
			display: none !important;
		}
		:global(html.report-print main) {
			max-width: none !important;
			padding: 0 !important;
			margin: 0 !important;
		}
		:global(html.report-print),
		:global(html.report-print body) {
			background: #ffffff !important;
		}
		.paper-scroll {
			overflow: visible;
			padding: 0;
			display: block;
		}
		/*
		 * 이름 있는 페이지로 A4 규칙을 리포트 종이(.paper, `page: report` 지정)에만 건다.
		 * 이름 없는 `@page { size: A4 }` 는 이 스타일시트가 로드된 모든 경로의 인쇄에 적용돼 버린다
		 * (Chrome 에서 @page 규칙은 스코프되지 않는다) — 그래서 `/` 인쇄 미리보기까지 A4 로 바뀌는 문제가 있었다.
		 *
		 * margin 은 여기서 0 으로 둔다 — 이름 있는 `@page` 의 margin 은 Chrome 에서 실제로 적용되지
		 * 않는 경우가 있어(size 만 적용) 그걸 유일한 여백 근거로 삼으면 글자가 종이 가장자리에
		 * 붙어버린다(신고된 버그). 여백은 대신 `ReportPaper.svelte` 의 `.paper` padding 이 낸다 —
		 * 여기 margin 을 0 으로 둬야 그 padding 과 브라우저 기본 여백이 이중으로 겹치지 않고,
		 * 종이가 A4 페이지 박스(210×297mm)를 정확히 채운다.
		 */
		@page report {
			size: A4;
			margin: 0;
		}
	}
</style>
