<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import './layout.css';
	import { building } from '$app/environment';
	import wordmark from '$lib/assets/headroom-wordmark.svg';
	import wordmarkLight from '$lib/assets/headroom-wordmark-light.svg';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { workspace } from '$lib/state/workspace.svelte';
	import {
		SITE_DESCRIPTION,
		SITE_ENABLED,
		SITE_INTRO_TITLE,
		SITE_OG_IMAGE,
		SITE_OG_IMAGE_ALT,
		SITE_OG_IMAGE_HEIGHT,
		SITE_OG_IMAGE_WIDTH,
		PRODUCT_NAME,
		sitePageMeta
	} from '$lib/site-config';
	import {
		CF_BEACON_TOKEN,
		CONTACT_EMAIL,
		DONATE_URL,
		GOOGLE_SITE_VERIFICATION,
		INDEXABLE,
		NAVER_SITE_VERIFICATION,
		SITE_ORIGIN,
		UMAMI_WEBSITE_ID
	} from '$lib/site/env';

	let { children } = $props();

	onMount(() => {
		workspace.load();
		return workspace.startClock();
	});
	// 인원 구분을 쓴 기간의 총 임직원 수는 언제나 "산정 기준을 적용한 합계" — 기준·구분이 어디서 바뀌든 여기서 맞춘다
	$effect(() => {
		workspace.applyHeadcountBasis();
	});
	// 상태가 바뀔 때마다 localStorage 에 저장 (로드 전에는 save() 가 무시)
	$effect(() => {
		workspace.save();
	});
	// 화면 테마를 <html data-theme> 에 반영한다. 'system' 이면 속성을 지워 기기 설정(prefers-color-scheme)에 맡긴다.
	// 첫 렌더 전 세팅은 app.html 의 인라인 스크립트가 하고, 여기서는 설정 변경만 따라간다.
	$effect(() => {
		const t = workspace.theme;
		if (t === 'system') delete document.documentElement.dataset.theme;
		else document.documentElement.dataset.theme = t;
	});

	const nav = [
		{ href: resolve('/'), label: '대시보드' },
		{ href: resolve('/simulator'), label: '시뮬레이터' },
		{ href: resolve('/data'), label: '데이터' },
		{ href: resolve('/peers'), label: '동종업계' },
		{ href: resolve('/report'), label: '리포트' },
		{ href: resolve('/settings'), label: '설정' },
		{ href: resolve('/guide'), label: '가이드' }
	];
	const isActive = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	// 헤더 로고 자리의 이름 편집 — 회사/조직 이름은 `workspace.orgName` 한 곳에 저장되어
	// 대시보드 제목·브라우저 탭·엑셀 파일명·조직 정보 시트가 모두 따라간다 (서버 전송 없음)
	let editingBrand = $state(false);
	let brandInput = $state<HTMLInputElement | null>(null);
	function startEdit() {
		editingBrand = true;
		queueMicrotask(() => brandInput?.focus());
	}

	// 소개(랜딩) 페이지는 자기 헤더·푸터를 직접 그린다 — 앱 크롬을 씌우지 않는다.
	// 사내 배포(SITE_ENABLED=false)에는 /intro 자체가 없으니(404) 앱 헤더를 항상 쓴다.
	const isSite = $derived(SITE_ENABLED && page.url.pathname.startsWith('/intro'));

	// ───────────────── 브라우저 탭 제목 · 링크 공유 메타 · 검색 색인 ─────────────────
	// 제목은 이 한 곳에서만 낸다(각 화면의 +page.svelte 에는 <title> 이 없다 — 두 번 나오면 안 된다).
	// 화면 이름은 메뉴 이름과 같게 하되 설명서만 메뉴("가이드") 아래 화면이라 따로 적는다.
	const SECTIONS: Record<string, string | undefined> = {
		'/': undefined,
		'/simulator': '시뮬레이터',
		'/data': '데이터',
		'/peers': '동종업계',
		'/report': '리포트',
		'/settings': '설정',
		'/guide': '가이드',
		'/guide/manual': '사용 설명서',
		'/privacy': '개인정보 안내'
	};
	// 검색에 내보내는 화면(소개·가이드·설명서·개인정보)은 site-config 의 표에 적힌 제목·설명이 이긴다.
	// 사내 배포에서는 표를 쓰지 않고 지금까지의 화면 제목 규칙을 그대로 둔다.
	const pageMeta = $derived(SITE_ENABLED ? sitePageMeta(page.url.pathname) : null);
	const metaTitle = $derived(
		isSite
			? SITE_INTRO_TITLE
			: (pageMeta?.title ?? workspace.pageTitle(SECTIONS[page.url.pathname]))
	);
	const metaDescription = $derived(pageMeta?.description ?? SITE_DESCRIPTION);
	// 절대 URL 이라야 링크 미리보기가 이미지를 가져간다. `asset()` 은 설정에 따라 상대 경로
	// (`./hero-dashboard.jpg`)를 돌려주므로 정식 주소(없으면 지금 주소) 기준으로 풀어서 절대 URL 로 만든다.
	// 쿼리(?start=…)는 canonical 에서 뺀다.
	// 정적 생성(building=true) 중에는 page.url.origin 이 자리표시자(sveltekit-prerender)라
	// 정식 주소가 없으면 아예 비워 둔다 — 결과 HTML 에 가짜 주소가 박히는 대신 브라우저에서
	// 하이드레이션 후(빌드 중이 아닐 때) 실제 주소로 다시 채워진다. 그동안은 이 화면이 noindex 라 문제 없다.
	const origin = $derived(SITE_ORIGIN || (building ? '' : page.url.origin));
	const ogImage = $derived(origin ? new URL(asset(SITE_OG_IMAGE), origin + '/').href : '');
	// 앱 주소 `/` 는 검색에서 소개 페이지로 모은다 — 앱은 `/` 에 그대로 두되 대표 주소만 소개로.
	const canonical = $derived(
		origin
			? origin + (SITE_ENABLED && page.url.pathname === '/' ? '/intro' : page.url.pathname)
			: ''
	);
	// 오류 화면(404 등)은 공유·색인 대상이 아니다 — 메타 대신 noindex 만 낸다
	const isErrorPage = $derived(page.error !== null);
	// 색인을 허용하는 배포(공개판 + 정식 주소)의 색인 대상 화면만 열어 둔다. 나머지는 전부 noindex —
	// 앱 화면·미리보기 주소·사내 배포·개발 서버가 검색 결과에 남지 않게.
	const indexThisPage = $derived(INDEXABLE && sitePageMeta(page.url.pathname) !== null);
	// 소개 페이지에만 붙이는 구조화 데이터 — 검색 결과에 "무료 웹 도구" 로 표시되게 한다
	const jsonLd = $derived(
		INDEXABLE && page.url.pathname === '/intro'
			? JSON.stringify({
					'@context': 'https://schema.org',
					'@type': 'SoftwareApplication',
					name: PRODUCT_NAME,
					applicationCategory: 'BusinessApplication',
					operatingSystem: 'Web',
					inLanguage: 'ko',
					url: SITE_ORIGIN + '/intro',
					description: SITE_DESCRIPTION,
					offers: { '@type': 'Offer', price: 0, priceCurrency: 'KRW' }
				}).replaceAll('<', '\\u003c')
			: null
	);
	// 스크립트 태그째로 만들어 둔다 — 마크업 안에 <script> 문자열을 두면 파서가 헷갈린다
	const jsonLdTag = $derived(
		jsonLd === null ? '' : '<script type="application/ld+json">' + jsonLd + '<' + '/script>'
	);

	// ───────────────── 백업 권장 알림 ─────────────────
	// 직접 입력한 데이터가 있는데(샘플만이면 알리지 않는다) 백업 파일을 한 번도 저장하지 않았거나
	// 마지막 저장이 7일을 넘었으면 헤더에서 설정 화면으로 한 번 찔러 준다. 저장은 이 PC 브라우저뿐이라
	// 캐시를 지우면 그대로 사라지기 때문이다. 문구는 title 속성으로 이유까지 밝힌다.
	const BACKUP_STALE_DAYS = 7;
	const backupNudgeReason = $derived.by(() => {
		if (!workspace.loaded) return null;
		if (workspace.records.length === 0 || workspace.isSampleOnly()) return null;
		const last = workspace.lastBackupAt;
		if (last === null) return '백업 파일을 저장한 적이 없습니다';
		// 며칠 지났는지는 백업 시각이 바뀔 때만 다시 센다 (헤더 시계와 달리 분 단위 갱신이 필요 없다)
		const days = Math.floor((Date.now() - last) / 86_400_000);
		return days > BACKUP_STALE_DAYS ? `마지막 백업 ${days}일 전` : null;
	});
</script>

<svelte:head>
	{#if isErrorPage}
		<!-- 제목은 +error.svelte 가 낸다 -->
		<meta name="robots" content="noindex" />
	{:else}
		<title>{metaTitle}</title>
		{#if !indexThisPage}
			<meta name="robots" content="noindex" />
		{/if}
		<meta name="description" content={metaDescription} />
		<meta property="og:type" content="website" />
		<meta property="og:site_name" content={PRODUCT_NAME} />
		<meta property="og:locale" content="ko_KR" />
		<meta property="og:title" content={metaTitle} />
		<meta property="og:description" content={metaDescription} />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:title" content={metaTitle} />
		<meta name="twitter:description" content={metaDescription} />
		{#if origin}
			<!-- 정식 주소가 없으면(빌드 중 자리표시자) 주소가 들어가는 태그는 통째로 뺀다 -->
			<link rel="canonical" href={canonical} />
			<meta property="og:url" content={canonical} />
			<meta property="og:image" content={ogImage} />
			<meta property="og:image:width" content={String(SITE_OG_IMAGE_WIDTH)} />
			<meta property="og:image:height" content={String(SITE_OG_IMAGE_HEIGHT)} />
			<meta property="og:image:alt" content={SITE_OG_IMAGE_ALT} />
			<meta name="twitter:image" content={ogImage} />
			<meta name="twitter:image:alt" content={SITE_OG_IMAGE_ALT} />
		{/if}
		{#if GOOGLE_SITE_VERIFICATION}
			<meta name="google-site-verification" content={GOOGLE_SITE_VERIFICATION} />
		{/if}
		{#if NAVER_SITE_VERIFICATION}
			<meta name="naver-site-verification" content={NAVER_SITE_VERIFICATION} />
		{/if}
		{#if jsonLdTag}
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- 우리가 만든 JSON 문자열만 넣는다 -->
			{@html jsonLdTag}
		{/if}
	{/if}
	<!--
		방문 분석 — 쿠키를 쓰지 않는 도구만, 공개판에서 ID 가 들어왔을 때만 넣는다.
		사내 배포에는 SITE_ENABLED 가 거짓이라 어떤 스크립트도 들어가지 않는다.
	-->
	{#if SITE_ENABLED && CF_BEACON_TOKEN}
		<script
			defer
			src="https://static.cloudflareinsights.com/beacon.min.js"
			data-cf-beacon={JSON.stringify({ token: CF_BEACON_TOKEN })}
		></script>
	{/if}
	{#if SITE_ENABLED && UMAMI_WEBSITE_ID}
		<!-- data-before-send: 회사 이름이 들어간 페이지 제목을 지우는 함수(app.html) -->
		<script
			defer
			src="https://cloud.umami.is/script.js"
			data-website-id={UMAMI_WEBSITE_ID}
			data-before-send="hcroiAnalyticsBeforeSend"
		></script>
	{/if}
</svelte:head>

{#if isSite}
	{@render children()}
{:else}
	<a
		href="#main"
		class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-on-brand"
		>본문으로 건너뛰기</a
	>

	<header class="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
		<!--
			모바일(≤640px)에서는 탭 7개가 한 줄에 들어가지 않는다. 가로 스크롤로 숨기면 리포트·설정·가이드에
			닿을 수 없으므로(QA 7) 줄바꿈(flex-wrap)으로 두 줄에 모두 보이게 한다. 넓은 화면에서는 그대로 한 줄.
		-->
		<div
			class="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 sm:min-h-14 sm:gap-x-6 sm:px-6 sm:py-0"
		>
			<div class="flex shrink-0 items-center gap-2">
				{#if SITE_ENABLED}
					<a
						href={resolve('/intro')}
						aria-label="Headroom 소개"
						title="Headroom 소개"
						class="block"
					>
						<img src={wordmark} alt="Headroom" class="wordmark-light block h-[20px] w-auto" />
						<img src={wordmarkLight} alt="Headroom" class="wordmark-dark h-[20px] w-auto" />
					</a>
					<span class="h-5 w-px shrink-0 bg-line" aria-hidden="true"></span>
				{:else}
					<a
						href={resolve('/')}
						aria-label="대시보드"
						class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-on-brand"
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.4"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"><path d="M3 17l5-6 4 4 8-9" /><path d="M14 6h6v6" /></svg
						>
					</a>
				{/if}
				{#if editingBrand}
					<form
						class="flex items-center gap-1"
						onsubmit={(e) => {
							e.preventDefault();
							editingBrand = false;
						}}
					>
						<input
							bind:this={brandInput}
							class="field-input w-48 py-1 text-sm"
							placeholder="회사/조직 이름 (비우면 기본)"
							aria-label="회사/조직 이름"
							bind:value={workspace.orgName}
							onkeydown={(e) => {
								if (e.key === 'Escape') editingBrand = false;
							}}
							onblur={() => (editingBrand = false)}
						/>
						<button type="submit" class="btn py-1 text-sm btn-primary">확인</button>
					</form>
				{:else}
					<!-- 이름을 아직 넣지 않았으면 도구 이름 대신 흐린 플레이스홀더를 보여 준다 (표시만 — workspace.brand 는 그대로) -->
					<button
						type="button"
						class="rounded-md px-1 py-0.5 text-[15px] whitespace-nowrap hover:bg-surface-2 hover:text-brand {workspace.orgName.trim()
							? 'font-bold text-ink'
							: 'text-muted'}"
						title="회사/조직 이름 넣기 — 대시보드 제목·탭·엑셀 파일명에 반영"
						aria-label={workspace.orgName.trim()
							? `${workspace.orgName.trim()} — 회사 이름 수정`
							: '회사 이름 넣기'}
						onclick={startEdit}>{workspace.orgName.trim() || '회사 이름 넣기'}</button
					>
				{/if}
			</div>
			<nav
				aria-label="주 메뉴"
				class="-mx-1 flex w-full flex-wrap items-center gap-1 sm:mx-0 sm:w-auto sm:flex-1"
			>
				{#each nav as n (n.href)}
					<a
						href={n.href}
						aria-current={isActive(n.href) ? 'page' : undefined}
						class="rounded-md px-3 py-1.5 text-[15px] font-medium whitespace-nowrap transition-colors {isActive(
							n.href
						)
							? 'bg-brand-tint text-brand-ink'
							: 'text-ink-2 hover:bg-surface-2 hover:text-ink'}">{n.label}</a
					>
				{/each}
			</nav>
			{#if workspace.saveError}
				<span class="shrink-0 text-xs font-semibold text-status-critical-ink" role="status"
					>저장 실패 · 변경사항 미저장</span
				>
			{:else}
				<span class="hidden shrink-0 text-xs text-muted lg:inline"
					>이 PC 에만 저장 · {workspace.savedLabel}</span
				>
				<!-- 저장 실패 경고가 떠 있을 때는 그쪽이 먼저다 — 백업 권장은 숨긴다(위 분기).
				     저장 표기(lg:inline)와 달리 이 링크는 좁은 화면에서도 보여 준다. -->
				{#if backupNudgeReason}
					<a
						href={resolve('/settings')}
						title={backupNudgeReason}
						class="shrink-0 text-xs font-semibold text-status-warning-ink underline underline-offset-2 hover:text-brand"
						>백업 권장 →</a
					>
				{/if}
			{/if}
		</div>
	</header>

	<main id="main" class="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8">
		{@render children()}
	</main>

	<footer class="mx-auto max-w-[1240px] px-4 pb-8 text-xs text-muted sm:px-6">
		HCROI = (영업이익 + 총 인건비) ÷ 총 인건비 · HCVA = (영업이익 + 총 인건비) ÷ 총 임직원 수 —
		자세한 산식은
		<a href={resolve('/guide')} class="underline">가이드</a> 참조
		{#if SITE_ENABLED}
			· <a href={resolve('/intro')} class="underline">소개</a>
			· <a href={resolve('/privacy')} class="underline">개인정보</a>
			{#if CONTACT_EMAIL}
				· <a href="mailto:{CONTACT_EMAIL}" class="underline">문의</a>
			{/if}
			{#if DONATE_URL}
				·
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- 배포 환경변수로 받은 외부 주소 -->
				<a href={DONATE_URL} target="_blank" rel="noreferrer" class="underline">커피 한 잔 후원</a>
			{/if}
		{/if}
	</footer>
{/if}
