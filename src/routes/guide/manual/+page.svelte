<script lang="ts">
	/**
	 * 사용 설명서 — 저장소 문서 `docs/user-guide.md` 를 그대로 렌더한다.
	 * 원본은 md 하나뿐이고(GitHub 에서도 읽힘), 파싱은 `$lib/guide/manual` 모듈 스코프에서 한 번만 한다.
	 * `{@html}` 로 꽂지만 입력이 우리 저장소 문서 하나뿐이라 XSS 우려는 없다(사용자 입력 아님).
	 */
	import GuideTabs from '$lib/guide/GuideTabs.svelte';
	import { manual } from '$lib/guide/manual';
</script>

<GuideTabs />

<h1 class="mb-2 text-2xl font-bold text-ink">사용 설명서</h1>
<p class="mb-6 text-[15px] text-ink-2">
	화면별 사용법과 자주 묻는 질문입니다. 저장소 문서(<code
		class="rounded bg-surface-2 px-1 py-0.5 text-[13px]">docs/user-guide.md</code
	>)를 그대로 보여 주므로 문서와 화면이 어긋나지 않습니다.
</p>

<div class="items-start gap-8 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)]">
	{#snippet tocLinks()}
		<ol class="space-y-0.5 text-[14px]">
			{#each manual.toc as t (t.id)}
				<li>
					<a
						href="#{t.id}"
						class="block rounded-md px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink"
						>{t.text}</a
					>
				</li>
			{/each}
		</ol>
	{/snippet}

	<!-- 목차 — 좁은 화면에서는 접어 둔 카드, 1024px 이상에서는 왼쪽 고정 -->
	<details class="card mb-5 px-3 py-2 lg:hidden">
		<summary class="px-1 py-1 text-[15px] font-semibold text-ink"
			>목차 ({manual.toc.length}개 절)</summary
		>
		<div class="mt-1">{@render tocLinks()}</div>
	</details>
	<nav
		aria-label="목차"
		class="sticky top-[4.5rem] hidden max-h-[calc(100dvh-6rem)] overflow-y-auto lg:block"
	>
		<p class="mb-1 px-2 text-xs font-semibold tracking-wide text-muted">목차</p>
		{@render tocLinks()}
	</nav>

	<article class="manual card px-5 py-5 sm:px-7 sm:py-6">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- 저장소 안의 우리 문서만 렌더한다 -->
		{@html manual.html}
	</article>
</div>

<style>
	/*
	 * 마크다운 본문 스타일 — Tailwind typography 플러그인이 없으므로 여기서 앱 룩으로 정의한다.
	 * `{@html}` 로 들어온 요소는 Svelte 스코프가 붙지 않아 `:global()` 로 지정한다.
	 * 색은 전부 layout.css 토큰(다크모드는 토큰이 처리).
	 */
	.manual {
		font-size: 15px;
		line-height: 1.75;
		color: var(--color-ink-2);
		word-break: keep-all;
		overflow-wrap: break-word;
	}
	/*
	 * 앱 헤더가 sticky 라 앵커로 이동했을 때 제목이 가리지 않게 띄운다.
	 * 헤더 높이: 390px 폭에서 119px(메뉴가 두 줄로 접힘) · 640px 이상에서 54px.
	 */
	.manual :global(h2),
	.manual :global(h3) {
		scroll-margin-top: 8rem;
		color: var(--color-ink);
		letter-spacing: -0.01em;
	}
	@media (min-width: 640px) {
		.manual :global(h2),
		.manual :global(h3) {
			scroll-margin-top: 5rem;
		}
	}
	.manual :global(h2) {
		margin: 2.25rem 0 0.75rem;
		border-bottom: 1px solid var(--color-line);
		padding-bottom: 0.4rem;
		font-size: 18px;
		font-weight: 700;
	}
	.manual :global(h2:first-child) {
		margin-top: 0;
	}
	.manual :global(h3) {
		margin: 1.5rem 0 0.5rem;
		font-size: 15px;
		font-weight: 600;
	}
	.manual :global(p) {
		margin: 0.7rem 0;
	}
	.manual :global(ul),
	.manual :global(ol) {
		margin: 0.7rem 0;
		padding-left: 1.35rem;
	}
	.manual :global(ul) {
		list-style: disc;
	}
	.manual :global(ol) {
		list-style: decimal;
	}
	.manual :global(li) {
		margin: 0.3rem 0;
	}
	.manual :global(li > ul),
	.manual :global(li > ol),
	.manual :global(li > p) {
		margin: 0.3rem 0;
	}
	.manual :global(strong) {
		font-weight: 700;
		color: var(--color-ink);
	}
	.manual :global(a) {
		color: var(--color-brand-ink);
		text-decoration: underline;
		text-underline-offset: 2px;
	}
	.manual :global(a:hover) {
		color: var(--color-brand);
	}
	.manual :global(code) {
		border-radius: 4px;
		background: var(--color-surface-2);
		padding: 0.08em 0.35em;
		font-family: var(--font-mono, ui-monospace, Consolas, monospace);
		font-size: 0.9em;
		color: var(--color-ink);
	}
	.manual :global(pre) {
		margin: 0.7rem 0;
		overflow-x: auto;
		border-radius: 8px;
		background: var(--color-surface-2);
		padding: 0.75rem 1rem;
	}
	.manual :global(pre code) {
		background: none;
		padding: 0;
	}
	.manual :global(blockquote) {
		margin: 1rem 0;
		border-left: 3px solid var(--color-line-2);
		border-radius: 0 8px 8px 0;
		background: var(--color-surface-2);
		padding: 0.5rem 1rem;
	}
	.manual :global(blockquote > :first-child) {
		margin-top: 0;
	}
	.manual :global(blockquote > :last-child) {
		margin-bottom: 0;
	}
	.manual :global(hr) {
		margin: 2rem 0;
		border: 0;
		border-top: 1px solid var(--color-line);
	}
	/* 표는 자기 상자 안에서만 가로로 넘긴다 — 문서 전체가 가로로 넘치지 않게 (390px 대응) */
	.manual :global(.table-wrap) {
		margin: 0.9rem 0;
		overflow-x: auto;
	}
	.manual :global(table) {
		width: 100%;
		min-width: 30rem;
		border-collapse: collapse;
		font-size: 14px;
	}
	.manual :global(th),
	.manual :global(td) {
		border-bottom: 1px solid var(--color-line);
		padding: 0.45rem 0.7rem;
		text-align: left;
		vertical-align: top;
	}
	.manual :global(th) {
		background: var(--color-surface-2);
		color: var(--color-ink);
		font-weight: 600;
	}
</style>
