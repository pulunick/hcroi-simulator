<script lang="ts">
	/**
	 * 가이드 화면 두 장(`/guide` 산식·가정 · `/guide/manual` 사용 설명서)을 오가는 탭 바.
	 * 활성 표시는 헤더 주 메뉴와 같은 규칙(`aria-current="page"` + `bg-brand-tint text-brand-ink`).
	 */
	import { resolve } from '$app/paths';
	import { page } from '$app/state';

	const tabs = [
		{ href: resolve('/guide'), label: '산식·가정', exact: true },
		{ href: resolve('/guide/manual'), label: '사용 설명서', exact: false }
	];

	// 끝의 `/` 는 무시하고 비교한다 (라우트 설정이 바뀌어도 활성 표시가 어긋나지 않게)
	const path = $derived(page.url.pathname.replace(/\/+$/, '') || '/');
	const isActive = (t: (typeof tabs)[number]) =>
		t.exact ? path === t.href : path.startsWith(t.href);
</script>

<nav aria-label="가이드 화면" class="mb-5 flex flex-wrap items-center gap-1">
	{#each tabs as t (t.href)}
		<a
			href={t.href}
			aria-current={isActive(t) ? 'page' : undefined}
			class="rounded-md px-3 py-1.5 text-[15px] font-medium whitespace-nowrap transition-colors {isActive(
				t
			)
				? 'bg-brand-tint text-brand-ink'
				: 'text-ink-2 hover:bg-surface-2 hover:text-ink'}">{t.label}</a
		>
	{/each}
</nav>
