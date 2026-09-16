<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import SiteHeader from '$lib/components/site/SiteHeader.svelte';
	import SiteFooter from '$lib/components/site/SiteFooter.svelte';

	// 소개(랜딩) 페이지. 시안: docs/design/commercial/Landing.dc.html(1440) · LandingMobile.dc.html(390).
	// 두 시안은 같은 페이지의 두 상태다 — ≥1024 에서 2열, 그 아래 1열, 헤더는 <768 에서 모바일형.
	// 앱 헤더/푸터는 +layout.svelte 가 /intro 에서 렌더하지 않는다.
	const app = resolve('/');
	const dataPage = resolve('/data');
	const settings = resolve('/settings');
	const hero = asset('/hero-dashboard.jpg');
</script>

<!--
	제목·설명·링크 공유 메타(og/twitter/canonical)는 +layout.svelte 가 한 곳에서 낸다
	(문구는 site-config 의 SITE_INTRO_TITLE · SITE_DESCRIPTION). 여기에 다시 두면 태그가 중복된다.
-->

<a
	href="#intro-main"
	class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-brand focus:px-3 focus:py-2 focus:text-on-brand"
	>본문으로 건너뛰기</a
>

<SiteHeader />

<main id="intro-main">
	<!-- ───────────────── 히어로 ───────────────── -->
	<section
		class="mx-auto flex max-w-[1200px] flex-col gap-7 px-5 pt-10 pb-9 sm:px-6 lg:gap-14 lg:pt-[88px] lg:pb-[72px]"
	>
		<div class="flex max-w-[940px] flex-col gap-4 lg:gap-6">
			<span class="label">DART 결산서 → HCROI · 정원/임금 시뮬레이션 · 경영진 리포트 · 무료</span>
			<h1
				class="text-[30px] leading-[1.32] font-bold tracking-[-0.015em] text-pretty break-keep sm:text-[40px] lg:text-[44px] lg:leading-[1.28]"
			>
				DART 결산서를 엑셀에 한 칸씩 옮겨 적던 일, 이제 PDF 한 부로 끝냅니다.
			</h1>
			<p
				class="max-w-[780px] text-[16px] leading-[1.7] text-pretty break-keep text-ink-2 lg:text-[18px]"
			>
				사업·반기·분기보고서를 올리면 손익계산서와 직원 현황을 찾아 매출액·영업이익·인건비·임직원
				수를 뽑고, 그 자리에서 HCROI 를 계산합니다. 사람이 하는 일은 뽑힌 숫자를 확인하는
				것뿐입니다. 전부 이 브라우저 안에서 — 데이터는 서버로 가지 않습니다.
			</p>
			<!-- 모바일에서는 버튼이 한 줄을 가득 채운다 (시안 390) -->
			<div
				class="flex flex-col items-start gap-4 pt-1 sm:flex-row sm:items-center sm:gap-7 lg:pt-2"
			>
				<a href="{resolve('/data')}?start=pdf" class="cta w-full sm:w-auto">결산서 PDF 로 시작</a>
				<a href="{app}?start=sample" class="underlink">가상 회사 샘플 열어 보기 →</a>
			</div>
		</div>
		<div class="flex flex-col gap-2.5 lg:gap-3">
			<!-- 다크에서도 같은 라이트 화면 이미지를 쓰고 먹색 1px 테두리로 구분한다 -->
			<img
				src={hero}
				width="1100"
				height="764"
				alt="Headroom 대시보드 화면 — 가상 회사 샘플의 HCROI·HCVA·인당 지표와 추이 차트"
				class="block h-auto w-full max-w-[1100px] rounded-2xl border border-line shadow-card"
			/>
			<span class="label tight">실제 화면 — 가상 회사 샘플. 화면 속 수치는 예시입니다.</span>
		</div>
	</section>

	<!-- ───────────────── 시작하기 · 세 가지 길 ───────────────── -->
	<section class="border-y border-line bg-panel">
		<div
			class="mx-auto grid max-w-[1200px] gap-5 px-5 py-10 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-16 lg:py-[72px]"
		>
			<div class="flex flex-col gap-2.5 lg:gap-3.5">
				<span class="label">시작하기 · 세 가지 길</span>
				<h2 class="text-[22px] leading-[1.35] font-bold break-keep lg:text-[28px]">
					방법은 셋, 결과는 하나
				</h2>
				<p class="text-[15px] text-pretty break-keep text-ink-2">
					어느 길이든 필요한 값은 다섯 개 — 매출액, 영업비용(또는 영업이익), 총 인건비, 임직원 수,
					기간. 첫 HCROI 까지 5분.
				</p>
			</div>

			<div class="card flex flex-col px-5 sm:px-6">
				<div class="start">
					<span class="num text-brand">01</span>
					<div class="titles">
						<span class="text-[17px] font-semibold lg:text-[18px]">결산서 PDF 올리기</span>
						<span class="label tight">추천 · DART 공시 그대로</span>
					</div>
					<p class="desc">
						사업·반기·분기보고서 PDF. 손익계산서·직원 등 현황 표를 찾아 값을 제안하고, 확인한 것만
						들어갑니다. 연결/별도는 골라 줍니다.
					</p>
					<a href="{resolve('/data')}?start=pdf" class="go underlink sm">PDF 고르기 →</a>
				</div>

				<div class="start">
					<span class="num text-muted">02</span>
					<div class="titles">
						<span class="text-[17px] font-semibold lg:text-[18px]">엑셀 양식 채우기</span>
						<span class="label tight">급여 대장이 엑셀이면</span>
					</div>
					<p class="desc">
						양식을 내려받아 기간별로 채우면 검증 열이 바로 표시됩니다. 연·반기·분기·월 어느 단위든,
						상위 기간은 합산합니다.
					</p>
					<a href="{dataPage}?start=excel" class="go underlink sm">양식 내려받기 →</a>
				</div>

				<div class="start last">
					<span class="num text-muted">03</span>
					<div class="titles">
						<span class="text-[17px] font-semibold lg:text-[18px]">직접 입력</span>
						<span class="label tight">기간 하나, 숫자 다섯</span>
					</div>
					<p class="desc">회의 중에 한 해만 빠르게 볼 때. 샘플 회사를 열어 숫자만 바꿔도 됩니다.</p>
					<a href="{app}?start=sample" class="go underlink sm">샘플 열기 →</a>
				</div>
			</div>
		</div>
	</section>

	<!-- ───────────────── 01 · 산식 ───────────────── -->
	<section id="formula" class="scroll-mt-6 border-b border-line">
		<div
			class="mx-auto grid max-w-[1200px] gap-5 px-5 py-11 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-16 lg:py-20"
		>
			<div class="flex flex-col gap-2.5 lg:gap-3.5">
				<span class="label">01 · 산식</span>
				<h2 class="text-[22px] leading-[1.35] font-bold break-keep lg:text-[28px]">
					공개된 식, 검증된 계산
				</h2>
			</div>
			<div class="flex max-w-[720px] flex-col gap-5 lg:gap-8">
				<div class="card flex flex-col gap-2 px-5 py-[18px] lg:gap-2.5 lg:px-7 lg:py-6">
					<div
						class="tabular text-[17px] leading-[1.5] font-medium break-keep lg:text-[26px] lg:leading-[1.4] lg:tracking-[-0.01em]"
					>
						HCROI = (영업이익 + 총 인건비) ÷ 총 인건비
					</div>
					<div class="tabular text-[13px] leading-[1.5] break-keep text-ink-2 lg:text-[15px]">
						1.25배 → 인건비 1원을 쓸 때마다 1.25원을 회수하고 있다
					</div>
				</div>
				<div class="flex flex-col gap-4 text-[15px] leading-[1.7] lg:gap-[22px] lg:text-[16px]">
					<p class="text-pretty break-keep">
						<strong class="font-semibold">등급은 세 단계.</strong> 1.0배 미만 위험, 1.0–1.5 보통, 1.5
						이상 우수. 경계는 설명서에 적혀 있고 화면마다 다르게 계산되지 않습니다.
					</p>
					<p class="text-pretty break-keep">
						<strong class="font-semibold">시뮬레이션은 가정을 바꾸는 것.</strong> 정원·임금·생산성 변동을
						넣으면 영업이익과 HCROI 가 즉시 다시 계산되고, 등급을 지키는 최대 임금 인상률과 손익분기 인원도
						역산합니다.
					</p>
					<p class="text-pretty break-keep">
						<strong class="font-semibold">인사이트는 규칙 기반.</strong> “인당 인건비가 인당 매출보다
						빠르게 늘고 있다” 같은 문장 하나하나가 어느 수치에서 나왔는지 추적됩니다. 생성형 AI 는 쓰지
						않습니다.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- ───────────────── 02 · 데이터 보관 ───────────────── -->
	<section id="privacy" class="scroll-mt-6">
		<div
			class="mx-auto grid max-w-[1200px] gap-5 px-5 py-11 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-16 lg:py-20"
		>
			<div class="flex flex-col gap-2.5 lg:gap-3.5">
				<span class="label">02 · 데이터 보관</span>
				<h2 class="text-[22px] leading-[1.35] font-bold break-keep lg:text-[28px]">
					귀사 데이터는 귀사 PC 안에만
				</h2>
			</div>
			<div class="flex max-w-[720px] flex-col gap-5 lg:gap-7">
				<p class="text-[15px] leading-[1.7] text-pretty break-keep lg:text-[16px]">
					계산, 결산서 PDF 읽기, 엑셀 변환이 전부 브라우저 안에서 끝납니다. 이 도구에는 데이터를
					받는 서버가 없습니다 — 올릴 곳이 없으니 유출될 곳도 없습니다. 저장은 이 PC 의 브라우저와
					<span class="tabular text-[14px] lg:text-[15px]">.json</span> 파일에만 하고, 그 파일이 곧 백업이자
					동료에게 건네는 수단입니다.
				</p>
				<div class="card flex flex-col px-5 sm:px-6">
					<div class="cell">
						<span class="cell-k">서버로 보내는 것</span>
						<span class="cell-v">없음. 계정도 없습니다.</span>
					</div>
					<div class="cell">
						<span class="cell-k">저장되는 곳</span>
						<span class="cell-v"
							>이 PC 의 브라우저 저장소, 그리고 내보낸
							<span class="tabular text-[14px]">.json</span> · 엑셀 파일</span
						>
					</div>
					<div class="cell">
						<span class="cell-k">지우는 방법</span>
						<span class="cell-v"
							><a href={settings} class="underlink sm">설정 → “이 PC 의 데이터 지우기”</a>, 또는
							브라우저 사이트 데이터 삭제. 그걸로 끝입니다.</span
						>
					</div>
					<div class="cell">
						<span class="cell-k">브라우저</span>
						<span class="cell-v"
							>최신 Chrome · Edge · Safari. 휴대폰에서도 열립니다(표는 가로로 넘겨 봅니다).</span
						>
					</div>
				</div>
			</div>
		</div>
	</section>
</main>

<SiteFooter />

<style>
	/* 반복 요소 — 작은 라벨 · 파랑 버튼 · 링크 · 시작하기 행 · 표 행 (앱 화면과 같은 룩) */
	.label {
		font-size: 12px;
		font-weight: 600;
		line-height: 1.6;
		letter-spacing: 0.02em;
		color: var(--color-muted);
	}
	.label.tight {
		letter-spacing: normal;
		font-weight: 500;
	}

	.cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		padding: 0 24px;
		border-radius: 0.5rem;
		background: var(--color-brand);
		color: var(--color-on-brand);
		font-size: 16px;
		font-weight: 600;
	}
	.cta:hover {
		background: var(--color-brand-hover);
	}

	.underlink {
		font-size: 16px;
		font-weight: 600;
		line-height: 1.4;
		color: var(--color-brand);
		border-bottom: 1px solid currentColor;
	}
	.underlink.sm {
		font-size: 15px;
	}
	.underlink:hover {
		color: var(--color-brand-hover);
	}

	/* 시작하기 행 — 모바일: 번호+제목 한 줄 → 설명 → 링크 / 데스크톱: 4열 */
	.start {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px 12px;
		padding: 20px 0;
		border-bottom: 1px solid var(--color-line);
		min-width: 0;
	}
	.start.last {
		border-bottom: 0;
	}
	.start .num {
		font-variant-numeric: tabular-nums;
		font-size: 18px;
		font-weight: 700;
	}
	.start .titles {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px 12px;
		min-width: 0;
	}
	.start .desc {
		flex-basis: 100%;
		font-size: 15px;
		line-height: 1.65;
		color: var(--color-ink-2);
		word-break: keep-all;
		text-wrap: pretty;
	}
	.start .go {
		flex-basis: 100%;
		align-self: flex-start;
		width: fit-content;
	}

	@media (min-width: 1024px) {
		.start {
			display: grid;
			/* 시안은 260px/160px 이지만 그대로 두면 설명 열이 187px 로 좁아져 5줄 넘게 감긴다.
			   제목·링크 열은 실제 내용보다 넉넉했던 폭이라 줄이고 그만큼을 설명 열로 돌린다(2~3줄 목표). */
			grid-template-columns: 56px 180px minmax(0, 1fr) 120px;
			gap: 24px;
			padding: 24px 0;
			align-items: baseline;
		}
		.start .num {
			font-size: 22px;
		}
		.start .titles {
			flex-direction: column;
			gap: 4px;
		}
		.start .go {
			flex-basis: auto;
			align-self: baseline;
			justify-self: end;
		}
	}

	/* 데이터 보관 표 — 모바일: 라벨 위/값 아래 / 데스크톱: 160px 라벨 열 */
	.cell {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px 0;
		border-bottom: 1px solid var(--color-line);
	}
	.cell:last-child {
		border-bottom: 0;
		font-size: 15px;
		line-height: 1.65;
		word-break: keep-all;
	}
	.cell .cell-k {
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--color-muted);
	}
	@media (min-width: 1024px) {
		.cell {
			flex-direction: row;
			gap: 24px;
			padding: 14px 0;
		}
		.cell .cell-k {
			flex: 0 0 160px;
			font-size: 15px;
			font-weight: 500;
			letter-spacing: normal;
		}
		.cell .cell-v {
			min-width: 0;
		}
	}
</style>
