<script lang="ts">
	import { resolve } from '$app/paths';
	import { CONTACT_EMAIL, DONATE_URL } from '$lib/site/env';

	// 소개 페이지 전용 푸터. 공개 저장소 위생 — 문의처·후원 주소는 배포 환경변수로만 들어온다.
	const guide = resolve('/guide');
</script>

<footer class="border-t border-line bg-surface">
	<div class="mx-auto max-w-[1200px] px-5 sm:px-6">
		<div
			class="flex flex-col gap-3 pt-6 pb-10 text-[13px] text-muted sm:flex-row sm:items-baseline sm:justify-between sm:pt-8 sm:pb-12"
		>
			<div class="flex items-baseline gap-3 sm:gap-4">
				<span class="text-[15px] font-bold text-ink">헤드룸</span>
				<span>무료 · 개인 프로젝트</span>
			</div>
			<div class="flex flex-wrap gap-4 sm:gap-5">
				<a href={guide} class="hover:text-brand">가이드</a>
				<a href="{resolve('/guide')}#formula" class="hover:text-brand">산식 근거</a>
				<a
					href="https://github.com/pulunick/hcroi-simulator"
					rel="noreferrer"
					class="hover:text-brand">소스 코드</a
				>
				<a
					href="https://github.com/pulunick/hcroi-simulator/issues"
					rel="noreferrer"
					class="hover:text-brand">문제 신고</a
				>
				<a href={resolve('/privacy')} class="hover:text-brand">개인정보</a>
				{#if CONTACT_EMAIL}
					<a href="mailto:{CONTACT_EMAIL}" class="hover:text-brand">문의</a>
				{/if}
				{#if DONATE_URL}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- 배포 환경변수로 받은 외부 주소 -->
					<a href={DONATE_URL} target="_blank" rel="noreferrer" class="hover:text-brand"
						>커피 한 잔 후원</a
					>
				{/if}
			</div>
		</div>
	</div>
</footer>
