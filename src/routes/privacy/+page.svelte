<script lang="ts">
	/**
	 * 개인정보 안내 — 공개판에만 있는 화면. 앱 헤더·푸터 안에서 렌더된다(소개 페이지와 달리 별도 겉면 없음).
	 * 문의처·후원 주소는 저장소에 적지 않고 배포 환경변수로만 들어온다.
	 */
	import { resolve } from '$app/paths';
	import { CONTACT_EMAIL } from '$lib/site/env';
	import { PRODUCT_NAME } from '$lib/site-config';

	const EFFECTIVE_DATE = '2026년 9월 17일';
</script>

<div class="flex max-w-[720px] flex-col gap-2 pb-2">
	<span class="text-xs font-semibold tracking-wide text-muted">개인정보 안내</span>
	<h1 class="text-2xl leading-[1.3] font-bold text-ink">
		무엇이 이 PC 에 남고, 무엇이 밖으로 나가나
	</h1>
	<p class="text-[15px] leading-[1.7] text-ink-2">
		{PRODUCT_NAME} 은 계정도 로그인도 없는 무료 웹 도구입니다. 아래 내용이 전부입니다.
	</p>
</div>

<div class="mt-6 flex max-w-[720px] flex-col gap-4">
	<section class="card px-6 py-5" aria-labelledby="p1">
		<h2 id="p1" class="mb-2 text-lg font-semibold text-ink">1. 입력한 값은 보내지 않습니다</h2>
		<p class="text-[15px] leading-[1.7] text-ink-2">
			매출액·인건비 같은 숫자, 올린 결산서 PDF 와 엑셀 파일, 회사 이름은 서버로 가지 않습니다.
			계산과 파일 읽기가 모두 이 브라우저 안에서 끝나고, 결과는 이 PC 의 브라우저 저장소와 직접
			내보낸 파일에만 남습니다. 지우려면
			<a href={resolve('/settings')} class="underline">설정</a> 에서 데이터를 지우거나 브라우저의 사이트
			데이터를 삭제하면 됩니다.
		</p>
	</section>

	<section class="card px-6 py-5" aria-labelledby="p2">
		<h2 id="p2" class="mb-2 text-lg font-semibold text-ink">2. 방문 통계만 집계합니다</h2>
		<p class="text-[15px] leading-[1.7] text-ink-2">
			몇 명이 어느 화면까지 보는지 알기 위해 방문 기록을 셉니다. 쿠키를 쓰지 않고, 개인을 알아볼 수
			있는 정보도 남기지 않습니다.
		</p>
		<ul class="mt-2 list-disc space-y-1 pl-5 text-[15px] leading-[1.7] text-ink-2">
			<li>
				모으는 것: 본 화면 주소, 어디를 통해 들어왔는지, 기기 종류와 브라우저, 대략의 지역(국가)
			</li>
			<li>모으지 않는 것: 입력한 숫자, 파일 이름과 내용, 회사 이름, 이름·이메일 같은 개인 정보</li>
			<li>쓰는 도구: 클라우드플레어 웹 애널리틱스, 유마미(Umami). 둘 다 쿠키를 쓰지 않습니다</li>
		</ul>
		<p class="mt-2 text-[15px] leading-[1.7] text-ink-2">
			버튼을 눌렀다는 사실도 이름만 셉니다. 어떤 값을 넣었는지는 함께 보내지 않습니다.
		</p>
	</section>

	<section class="card px-6 py-5" aria-labelledby="p3">
		<h2 id="p3" class="mb-2 text-lg font-semibold text-ink">3. 광고는 없습니다</h2>
		<p class="text-[15px] leading-[1.7] text-ink-2">
			지금은 광고를 넣지 않습니다. 넣게 되면 이 안내를 먼저 고치고, 어떤 사업자의 광고인지 밝힙니다.
			숫자를 입력하는 화면과 리포트에는 어떤 경우에도 광고를 넣지 않습니다.
		</p>
	</section>

	<section class="card px-6 py-5" aria-labelledby="p4">
		<h2 id="p4" class="mb-2 text-lg font-semibold text-ink">4. 문의</h2>
		<p class="text-[15px] leading-[1.7] text-ink-2">
			잘못된 계산, 안 되는 화면, 지우고 싶은 내용이 있으면 알려 주세요.
			{#if CONTACT_EMAIL}
				<a href="mailto:{CONTACT_EMAIL}" class="underline">{CONTACT_EMAIL}</a> 으로 보내시면 됩니다.
			{:else}
				<a
					href="https://github.com/pulunick/hcroi-simulator/issues"
					rel="noreferrer"
					class="underline">문제 신고</a
				> 로 남겨 주세요.
			{/if}
		</p>
	</section>

	<section class="card px-6 py-5" aria-labelledby="p5">
		<h2 id="p5" class="mb-2 text-lg font-semibold text-ink">5. 시행일</h2>
		<p class="text-[15px] leading-[1.7] text-ink-2">
			이 안내는 {EFFECTIVE_DATE} 부터 적용합니다. 내용이 바뀌면 이 화면에서 바로 고칩니다.
		</p>
	</section>

	<p class="text-[13px] leading-[1.7] text-muted">
		계산 결과는 참고용이며 회계·법률 판단을 대신하지 않습니다.
	</p>
</div>
