<script lang="ts">
	import { GRADE_LABEL } from '$lib/hcroi/formulas';
	import type { HcroiGrade } from '$lib/hcroi/types';

	interface Props {
		grade: HcroiGrade | null;
		size?: 'sm' | 'lg';
	}
	let { grade, size = 'sm' }: Props = $props();

	// 사각 칩(2px 모서리, 1px 테두리) — 우수는 옅은 초록 배경+진한 초록 글자, 보통은 중립 테두리, 위험은 위험색 테두리+글자.
	// 우수를 예전처럼 bg-status-good(원색)+text-on-brand 로 채우면 라이트 테마에서 3.08:1 밖에 안 나와
	// (스크래치패드 fix2/contrast.cjs 로 확인, WCAG AA 4.5:1 미달) 다른 화면의 상태 배지와 같은
	// "옅은 배경(-bg) + 진한 글자(-ink)" 조합으로 바꿨다 — 이 조합은 라이트 6.62:1 · 다크 7.62:1.
	const styles: Record<HcroiGrade, string> = {
		excellent: 'border-status-good bg-status-good-bg text-status-good-ink',
		warning: 'border-line-2 text-ink',
		critical: 'border-status-critical text-status-critical-ink'
	};
</script>

{#if grade}
	<span
		class="inline-flex items-center justify-center rounded-[2px] border font-bold whitespace-nowrap {styles[
			grade
		]} {size === 'lg' ? 'h-7 px-3 text-sm' : 'h-6 px-2.5 text-[13px]'}"
	>
		{GRADE_LABEL[grade]}
	</span>
{:else}
	<span
		class="inline-flex h-6 items-center justify-center rounded-[2px] border border-line px-2.5 text-[13px] font-bold whitespace-nowrap text-muted"
		>산출 불가</span
	>
{/if}
