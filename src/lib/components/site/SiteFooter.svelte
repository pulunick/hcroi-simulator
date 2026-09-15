<script lang="ts">
	import { resolve } from '$app/paths';

	// 소개 페이지 전용 푸터. 공개 저장소 위생 — 이메일·회사명은 넣지 않는다.
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
			</div>
		</div>
	</div>
</footer>
