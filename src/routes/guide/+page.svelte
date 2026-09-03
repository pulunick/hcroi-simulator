<script lang="ts">
	import { REFERENCE_DEFAULTS } from '$lib/hcroi/defaults';
	import { HC_COST_KEYS, HC_COST_LABELS } from '$lib/hcroi/types';
	import { formatKrwCompact } from '$lib/hcroi/format';
</script>

<svelte:head><title>산식·가이드 — HCROI</title></svelte:head>

<h1 class="mb-2 text-2xl font-bold text-ink">산식 · 가이드</h1>
<p class="mb-8 text-[15px] text-ink-2">
	이 도구의 모든 계산은 아래 정의를 엄격히 따릅니다. 시뮬레이션 가정과 기본값도 함께 명시합니다.
</p>

<div class="grid gap-6 lg:grid-cols-2">
	<section class="card px-6 py-5" aria-labelledby="f-h">
		<h2 id="f-h" class="mb-4 text-lg font-semibold text-ink">핵심 수식</h2>
		<dl class="space-y-4 text-[15px]">
			<div>
				<dt class="font-semibold text-ink">
					1. 인적자본 투입 전 이익 (Operating Profit before Human Capital)
				</dt>
				<dd class="mt-1 rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-keep text-ink-2">
					영업이익 + 총 인건비 = 매출액 − (영업비용 − 총 인건비)
				</dd>
			</div>
			<div>
				<dt class="font-semibold text-ink">2. HCROI (Human Capital Return on Investment)</dt>
				<dd class="mt-1 rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-keep text-ink-2">
					[매출액 − (영업비용 − 총 인건비)] ÷ 총 인건비 = (영업이익 + 총 인건비) ÷ 총 인건비
				</dd>
				<dd class="mt-1 text-sm text-ink-2">
					의미: 인건비 1원 투입당 창출된 (영업이익 + 인건비) 회수율. 1.0배 = 인건비만 회수(영업이익
					0), 1.0 미만 = 영업손실.
				</dd>
			</div>
			<div>
				<dt class="font-semibold text-ink">
					3. HCVA (Human Capital Value Added, 인적자본 부가가치)
				</dt>
				<dd class="mt-1 rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-keep text-ink-2">
					[매출액 − (영업비용 − 총 인건비)] ÷ 총 임직원 수 (원/인)
				</dd>
			</div>
			<div>
				<dt class="font-semibold text-ink">4. 총 인건비 (Total Human Capital Cost)</dt>
				<dd class="mt-1 rounded-md bg-surface-2 px-3 py-2 font-mono text-sm break-keep text-ink-2">
					기본급 + 성과급/수당 + 퇴직급여 + 법정후생비 + 기타 복리후생비 + 교육훈련비
				</dd>
			</div>
			<div>
				<dt class="font-semibold text-ink">보조 지표</dt>
				<dd class="mt-1 text-sm text-ink-2">
					인당 매출액 = 매출액 ÷ 임직원 수 · 인당 인건비 = 총 인건비 ÷ 임직원 수 · 영업이익률 =
					영업이익 ÷ 매출액 · 인건비율 = 총 인건비 ÷ 매출액
				</dd>
			</div>
		</dl>
	</section>

	<section class="card px-6 py-5" aria-labelledby="g-h">
		<h2 id="g-h" class="mb-4 text-lg font-semibold text-ink">HCROI 정상성 진단 기준</h2>
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
					><td class="py-2 text-ink-2">인건비는 회수하나 잉여가 얇음 — 1.5배(우수) 진입이 목표</td
					></tr
				>
				<tr
					><td class="tabular py-2">1.5배 이상</td><td
						class="py-2 font-semibold text-status-good-ink">우수</td
					><td class="py-2 text-ink-2">인적자본 투자효율 우수</td></tr
				>
			</tbody>
		</table>
		<p class="mt-3 text-sm text-muted">
			업종·사업모델에 따라 적정 수준이 다릅니다(자본집약 제조업은 인건비 비중이 낮아 HCROI 가 높게
			나오는 경향). 동종업계 비교치와 함께 해석하세요.
		</p>
	</section>

	<section class="card px-6 py-5" aria-labelledby="s-h">
		<h2 id="s-h" class="mb-4 text-lg font-semibold text-ink">시뮬레이션 가정</h2>
		<ol class="list-decimal space-y-2 pl-5 text-[15px] text-ink-2">
			<li>
				<strong class="text-ink">인원'</strong> = 기준 인원 × (1 + 인원 변동율) 또는 기준 인원 ± 변동
				인원수 (정수 반올림, 최소 0명)
			</li>
			<li>
				<strong class="text-ink">총 인건비'</strong> = 인원' × 기준 인당 인건비 × (1 + 평균 임금 인상률)
			</li>
			<li>
				<strong class="text-ink">매출액'</strong> = 인원' × 기준 인당 매출 × (1 + 인당 생산성 변화율)
			</li>
			<li>
				<strong class="text-ink">비인건비 영업비용'</strong> = 고정비 + 변동비 × (매출액' ÷ 매출액). 변동비
				비율은 "고급 가정"에서 조정(기본 0% = 전액 고정비)
			</li>
			<li>
				<strong class="text-ink">영업이익'</strong> = 매출액' − 비인건비' − 총 인건비'. 이후 HCROI'·HCVA'
				는 핵심 수식으로 재계산
			</li>
			<li>
				<strong class="text-ink">HCROI 유지 조건</strong>: 기준 HCROI 를 만드는 인당 생산성
				변화율(손익분기 생산성)과 최대 임금 인상률을 닫힌 식으로 역산해 함께 표시
			</li>
		</ol>
		<p class="mt-3 text-sm text-muted">
			신규 인원의 램프업(초기 생산성 저하), 채용·퇴직 일회성 비용, 세금·금융비용은 모델에 포함하지
			않습니다.
		</p>
	</section>

	<section class="card px-6 py-5" aria-labelledby="d-h">
		<h2 id="d-h" class="mb-4 text-lg font-semibold text-ink">
			표준 레퍼런스 기본값 (데이터 누락 시)
		</h2>
		<dl class="grid grid-cols-2 gap-x-6 gap-y-2 text-[15px]">
			<dt class="text-ink-2">매출 대비 총 인건비 비율</dt>
			<dd class="tabular font-semibold">{REFERENCE_DEFAULTS.hcCostToRevenuePct}%</dd>
			<dt class="text-ink-2">영업이익률</dt>
			<dd class="tabular font-semibold">{REFERENCE_DEFAULTS.operatingMarginPct}%</dd>
			<dt class="text-ink-2">인당 매출액</dt>
			<dd class="tabular font-semibold">
				{formatKrwCompact(REFERENCE_DEFAULTS.revenuePerHead)}/인
			</dd>
		</dl>
		<h3 class="mt-4 mb-2 text-sm font-semibold text-ink-2">총 인건비 구성비 (총액만 알 때 분배)</h3>
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
			국내 중견 서비스업 일반 사례를 바탕으로 한 안내용 가정치입니다. 법정후생비는 4대보험
			사업자부담분(약 9~10%), 퇴직급여는 연간 급여의 1/12(약 8.3%)을 근거로 합니다. 반드시 자사
			실적으로 교체하세요.
		</p>
	</section>
</div>
