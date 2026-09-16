<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { workspace } from '$lib/state/workspace.svelte';
	import { SITE_ENABLED } from '$lib/site-config';

	// 오류 화면. 루트 레이아웃 안에서 렌더되므로 헤더·푸터는 그대로 남는다
	// (소개 페이지가 404 일 때도 앱 크롬이 붙는다 — isSite 는 실제 /intro 렌더에서만 참).
	const notFound = $derived(page.status === 404);
	const heading = $derived(
		notFound ? '페이지를 찾을 수 없습니다' : `문제가 생겼습니다 (${page.status})`
	);
	// 404 는 경로가, 그 밖에는 서버/앱이 준 메시지가 단서다
	const detail = $derived(page.error?.message ?? '');
</script>

<svelte:head><title>{workspace.pageTitle(heading)}</title></svelte:head>

<section class="card mx-auto max-w-[640px] p-6 sm:p-8">
	<p class="text-xs font-semibold tracking-wide text-muted">오류 {page.status}</p>
	<h1 class="mt-1 text-[22px] font-bold text-ink">{heading}</h1>

	{#if notFound}
		<p class="mt-3 text-[15px] leading-[1.7] text-ink-2">
			주소가 바뀌었거나 없는 화면입니다. 아래 링크로 돌아가세요.
		</p>
		<p class="mt-3 text-[13px] break-all text-muted">
			요청한 주소: <code class="rounded bg-surface-2 px-1.5 py-0.5">{page.url.pathname}</code>
		</p>
	{:else}
		{#if detail}
			<p class="mt-3 text-[15px] leading-[1.7] text-ink-2">{detail}</p>
		{/if}
		<p class="mt-3 text-[15px] leading-[1.7] text-status-warning-ink">
			새로고침해도 반복되면 <a href={resolve('/settings')} class="underline">설정</a>에서 백업
			파일을 저장한 뒤 데이터를 지우고 다시 시작하세요.
		</p>
	{/if}

	<div class="mt-6 flex flex-wrap items-center gap-3">
		<a href={resolve('/')} class="btn btn-primary">대시보드로</a>
		<a href={resolve('/guide')} class="btn btn-secondary">가이드</a>
		{#if SITE_ENABLED}
			<a href={resolve('/intro')} class="text-[15px] text-ink-2 underline hover:text-brand">소개</a>
		{/if}
	</div>
</section>
