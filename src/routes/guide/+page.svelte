<script lang="ts">
	import { REFERENCE_DEFAULTS } from '$lib/hcroi/defaults';
	import { HC_COST_KEYS, HC_COST_LABELS } from '$lib/hcroi/types';
	import { formatAmount, headcountBasisLabel } from '$lib/hcroi/format';
	import { workspace } from '$lib/state/workspace.svelte';
	import GuideTabs from '$lib/guide/GuideTabs.svelte';

	/** 금액 표기 — 작업공간의 표시 단위 설정을 따른다 (저장값은 언제나 원 단위 정수) */
	const won = (v: number | null | undefined, suffix = '원') =>
		formatAmount(v, workspace.amountUnit, suffix);
	const basisLabel = $derived(headcountBasisLabel(workspace.headcountBasis));
</script>

<GuideTabs />

<h1 class="mb-2 text-2xl font-bold text-ink">가이드</h1>
<p class="mb-8 text-[15px] text-ink-2">
	화면의 모든 숫자는 아래 식으로 계산합니다. 어디서나 같은 식입니다. 시뮬레이션 가정과 기본값도 함께
	정리했습니다.
</p>

<div class="grid items-start gap-6 lg:grid-cols-2">
	<section id="formula" class="card scroll-mt-24 px-6 py-5" aria-labelledby="f-h">
		<h2 id="f-h" class="mb-4 text-lg font-semibold text-ink">핵심 수식</h2>
		<dl class="space-y-4 text-[15px]">
			<div>
				<dt class="font-semibold text-ink">1. 인건비를 쓰기 전, 회사가 실제로 번 돈</dt>
				<dd class="mt-1 rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-keep text-ink-2">
					영업이익 + 총 인건비 = 매출액 − (영업비용 − 총 인건비)
				</dd>
				<dd class="mt-1 text-xs text-muted">
					인적자본 투입 전 이익 (Operating Profit before Human Capital)
				</dd>
			</div>
			<div>
				<dt class="font-semibold text-ink">2. 인건비 1원을 써서 얼마를 벌어오나</dt>
				<dd class="mt-1 rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-keep text-ink-2">
					(영업이익 + 총 인건비) ÷ 총 인건비 = HCROI
				</dd>
				<dd class="mt-1 text-sm text-ink-2">
					예: 인건비 100억, 영업이익 35억이면 (35억+100억)÷100억 = 1.35배
				</dd>
				<dd class="mt-1 text-xs text-muted">HCROI (Human Capital Return on Investment)</dd>
			</div>
			<div>
				<dt class="font-semibold text-ink">3. 직원 한 명이 벌어들이는 돈</dt>
				<dd class="mt-1 rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-keep text-ink-2">
					(영업이익 + 총 인건비) ÷ 총 임직원 수 (원/인)
				</dd>
				<dd class="mt-1 text-xs text-muted">HCVA (Human Capital Value Added, 인적자본 부가가치)</dd>
			</div>
			<div>
				<dt class="font-semibold text-ink">4. 인당 지표를 나눌 때 쓰는 총 인원</dt>
				<dd class="mt-1 text-sm text-ink-2">
					현재 기준: <strong class="text-ink">{basisLabel}</strong>
				</dd>
				<dd class="mt-1 text-sm text-ink-2">
					계약직·파견·등기임원을 포함할지는 설정 화면에서 정합니다.
				</dd>
				<dd class="mt-1 text-xs text-muted">
					기준을 바꾸면 HCVA·인당 매출·인당 인건비도 다시 계산됩니다.
				</dd>
			</div>
			<div>
				<dt class="font-semibold text-ink">5. 인건비에 포함되는 6가지 항목</dt>
				<dd class="mt-1 rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-keep text-ink-2">
					기본급 + 성과급/수당 + 퇴직급여 + 법정후생비 + 기타 복리후생비 + 교육훈련비
				</dd>
				<dd class="mt-1 text-xs text-muted">총 인건비 (Total Human Capital Cost)</dd>
			</div>
			<div>
				<dt class="font-semibold text-ink">그 밖에 참고하는 보조 지표</dt>
				<dd class="mt-1 text-sm text-ink-2">
					인당 매출액 = 매출액 ÷ 임직원 수 · 인당 인건비 = 총 인건비 ÷ 임직원 수
				</dd>
				<dd class="mt-1 text-sm text-ink-2">
					영업이익률 = 영업이익 ÷ 매출액 · 인건비율 = 총 인건비 ÷ 매출액
				</dd>
			</div>
		</dl>
	</section>

	<section class="card px-6 py-5" aria-labelledby="g-h">
		<h2 id="g-h" class="mb-1 text-lg font-semibold text-ink">이 HCROI, 안전한 수준인가요</h2>
		<p class="mb-4 text-sm text-ink-2">이 표는 HCROI 값이 어느 정도면 안전한지 보여줍니다.</p>
		<table class="w-full text-[15px]">
			<thead>
				<tr class="border-b border-line text-left text-sm text-ink-2"
					><th class="py-2 font-semibold">HCROI</th><th class="py-2 font-semibold">등급</th><th
						class="py-2 font-semibold">해석</th
					></tr
				>
			</thead>
			<tbody class="divide-y divide-line">
				<tr
					><td class="tabular py-2">1.0배 미만</td><td
						class="py-2 font-semibold text-status-critical-ink">위험</td
					><td class="py-2 text-ink-2">인건비조차 회수하지 못함 (영업손실)</td></tr
				>
				<tr
					><td class="tabular py-2">1.0 ~ 1.5배</td><td
						class="py-2 font-semibold text-status-warning-ink">보통</td
					><td class="py-2 text-ink-2">인건비는 회수하지만 남는 돈이 적음 — 목표는 1.5배</td></tr
				>
				<tr
					><td class="tabular py-2">1.5배 이상</td><td
						class="py-2 font-semibold text-status-good-ink">우수</td
					><td class="py-2 text-ink-2">투자한 인건비 대비 잘 벌고 있음</td></tr
				>
			</tbody>
		</table>
		<p class="mt-3 text-sm text-muted">
			업종마다 적정 수준이 다릅니다. 동종업계 평균과 함께 보세요.
		</p>
	</section>

	<section class="card px-6 py-5" aria-labelledby="s-h">
		<h2 id="s-h" class="mb-1 text-lg font-semibold text-ink">시나리오를 넣으면 무엇이 바뀌나요</h2>
		<p class="mb-4 text-sm text-ink-2">
			이 표는 입력값을 바꾸면 어떤 순서로 결과가 바뀌는지 보여줍니다.
		</p>
		<ol class="list-decimal space-y-3 pl-5 text-[15px] text-ink-2">
			<li>
				<p class="text-ink">인원 변동률(또는 변동 인원수)을 넣으면 → 인원'이 정해집니다.</p>
				<p class="mt-0.5 text-sm">인원' = 기준 인원 × (1 + 인원 변동률), 정수 반올림·최소 0명</p>
			</li>
			<li>
				<p class="text-ink">평균 임금 인상률을 넣으면 → 총 인건비'가 정해집니다.</p>
				<p class="mt-0.5 text-sm">총 인건비' = 인원' × 기준 인당 인건비 × (1 + 임금 인상률)</p>
			</li>
			<li>
				<p class="text-ink">인당 생산성 변화율을 넣으면 → 매출액'이 정해집니다.</p>
				<p class="mt-0.5 text-sm">매출액' = 인원' × 기준 인당 매출 × (1 + 생산성 변화율)</p>
			</li>
			<li>
				<p class="text-ink">변동비 비율을 넣으면 → 비인건비 영업비용'이 정해집니다.</p>
				<p class="mt-0.5 text-sm">
					비인건비' = 고정비 + 변동비 × (매출액' ÷ 매출액). "고급 가정"에서 조정하며 기본은 0%(전액
					고정비)
				</p>
			</li>
			<li>
				<p class="text-ink">위 값이 모이면 → 영업이익'과 HCROI'·HCVA'가 다시 계산됩니다.</p>
				<p class="mt-0.5 text-sm">영업이익' = 매출액' − 비인건비' − 총 인건비'</p>
			</li>
			<li>
				<p class="text-ink">
					지금 HCROI 를 그대로 지키려면 → 생산성을 얼마나 올려야 하는지, 임금은 최대 얼마나 올릴 수
					있는지 함께 알려줍니다.
				</p>
			</li>
		</ol>
		<p class="mt-3 text-sm text-muted">
			새 직원의 적응 기간, 채용·퇴직에 드는 일회성 비용, 세금·금융비용은 계산에 넣지 않습니다.
		</p>
	</section>

	<section class="card px-6 py-5" aria-labelledby="d-h">
		<h2 id="d-h" class="mb-1 text-lg font-semibold text-ink">데이터가 없을 때 쓰는 기본값</h2>
		<p class="mb-4 text-sm text-ink-2">이 표는 일부 값을 아직 안 넣었을 때 대신 쓰는 수치입니다.</p>
		<dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-[15px]">
			<dt class="text-ink-2">매출 대비 총 인건비 비율</dt>
			<dd class="tabular font-semibold">{REFERENCE_DEFAULTS.hcCostToRevenuePct}%</dd>
			<dt class="text-ink-2">영업이익률</dt>
			<dd class="tabular font-semibold">{REFERENCE_DEFAULTS.operatingMarginPct}%</dd>
			<dt class="text-ink-2">인당 매출액</dt>
			<dd class="tabular font-semibold">
				{won(REFERENCE_DEFAULTS.revenuePerHead)}/인
			</dd>
		</dl>
		<h3 class="mt-4 mb-2 text-sm font-semibold text-ink-2">
			총 인건비만 알 때, 항목별로 나누는 비율
		</h3>
		<ul class="grid grid-cols-2 gap-x-6 gap-y-1 text-[15px] sm:grid-cols-3">
			{#each HC_COST_KEYS as k (k)}
				<li class="flex justify-between border-b border-line py-1">
					<span class="text-ink-2">{HC_COST_LABELS[k]}</span><span class="tabular font-semibold"
						>{REFERENCE_DEFAULTS.breakdownSharePct[k]}%</span
					>
				</li>
			{/each}
		</ul>
		<p class="mt-3 text-sm text-muted">
			국내 중견 서비스업 사례를 참고한 값입니다. 법정후생비는 4대보험 회사 부담분(약 9~10%),
			퇴직급여는 월급의 약 8.3%를 기준으로 합니다. 반드시 자사 실적으로 바꿔 쓰세요.
		</p>
	</section>
</div>

<p class="mt-6 text-xs text-muted">계산 결과는 참고용이며 회계·법률 판단을 대신하지 않습니다.</p>
