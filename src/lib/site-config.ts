/** 공개판(Headroom 사이트) 요소 on/off. main = false(사내 도구: 워드마크·소개 페이지 없음), product/commercial = true. 이 파일 한 줄만 브랜치 간에 다르다 — main 에서는 절대 바꾸지 말 것(docs/plans/branch-strategy.md §1). */
export const SITE_ENABLED = false;

/**
 * 제품명 — 회사/조직 이름을 넣지 않았을 때 쓰는 기본 이름(브라우저 탭 제목·엑셀 파일명 등).
 * 공개판(product/commercial)은 `Headroom`, 사내 도구(main)는 `HCROI 시뮬레이터`.
 * 이름이 두 곳 이상에 박히지 않게 여기 한 줄에서만 정한다.
 */
export const PRODUCT_NAME = SITE_ENABLED ? 'Headroom' : 'HCROI 시뮬레이터';

/**
 * 대시보드 제목(브라우저 탭·h1) — 공개판(product/commercial)은 "대시보드", 사내 도구(main)는
 * "HCROI 대시보드". main/product 차이는 위 `SITE_ENABLED` 한 줄에서만 파생한다.
 */
export const DASHBOARD_TITLE = SITE_ENABLED ? '대시보드' : 'HCROI 대시보드';

/**
 * 소개(랜딩) 페이지의 브라우저 탭 제목 겸 링크 공유 제목. 공개판에만 `/intro` 가 있으므로
 * 이 문구도 공개판 전용이다 — `+layout.svelte` 가 `/intro` 에서 `<title>`·og:title 로 쓴다
 * (소개 페이지는 자기 `<svelte:head>` 에 제목을 두지 않는다 — 한 곳에서만 정한다).
 */
export const SITE_INTRO_TITLE = 'Headroom — DART 결산서로 HCROI';

/**
 * 링크 공유용 한 줄 설명 (meta description · og:description · twitter:description).
 * 공개판은 소개 페이지에서 쓰던 문구 그대로, 사내 도구는 사내 담당자용 문구.
 * 문구가 두 곳에 박히지 않게 여기 한 곳에서만 정한다.
 */
export const SITE_DESCRIPTION = SITE_ENABLED
	? 'DART 결산서 PDF 한 부로 매출액·영업이익·인건비·임직원 수를 뽑아 HCROI 를 계산하고, 정원·임금 시나리오를 시뮬레이션합니다. 데이터는 브라우저 안에만 남습니다.'
	: 'HCROI 와 인건비·정원 시나리오를 계산하는 인사담당자용 도구. 데이터는 이 PC 브라우저에만 저장됩니다.';

/**
 * 검색에 노출하는 화면과 그 제목·설명. 여기 없는 경로는 전부 색인 제외(`noindex`)다 —
 * 앱 화면은 개인 데이터를 다루므로 검색 결과에 남으면 안 된다.
 * 제목은 "무엇을 알려주는 화면인가 — 제품명" 형식으로 통일한다.
 */
export type SitePagePath = '/intro' | '/guide' | '/guide/manual' | '/privacy';
export const SITE_PAGES: Record<SitePagePath, { title: string; description: string }> = {
	'/intro': { title: SITE_INTRO_TITLE, description: SITE_DESCRIPTION },
	'/guide': {
		title: `HCROI 계산식과 등급 기준 — ${PRODUCT_NAME}`,
		description:
			'HCROI = (영업이익 + 총 인건비) ÷ 총 인건비. HCVA 와 인당 매출·인당 인건비까지 계산식을 그대로 공개합니다. 등급 경계(1.0배·1.5배)와 인건비·정원 시뮬레이션이 쓰는 가정도 함께 정리했습니다.'
	},
	'/guide/manual': {
		title: `사용 설명서 — ${PRODUCT_NAME}`,
		description:
			'DART 결산서 PDF 가져오기, 엑셀 양식 채우기, 인건비·정원 시뮬레이션, 경영진 리포트 인쇄까지 화면별 사용법과 자주 묻는 질문을 한 장에 담았습니다.'
	},
	'/privacy': {
		title: `개인정보 안내 — ${PRODUCT_NAME}`,
		description:
			'입력한 숫자와 결산서 PDF 는 서버로 보내지 않습니다. 쿠키 없이 집계하는 방문 통계 항목과 문의 방법을 안내합니다.'
	}
};

/** 주소가 색인 대상 화면인가 — 맞으면 그 화면의 제목·설명을 돌려준다 */
export function sitePageMeta(pathname: string): { title: string; description: string } | null {
	return SITE_PAGES[pathname as SitePagePath] ?? null;
}

/** 링크 공유 미리보기 이미지(static/) 와 그 실제 픽셀 크기 — og:image:width/height 에 그대로 쓴다 */
export const SITE_OG_IMAGE = '/hero-dashboard.jpg';
export const SITE_OG_IMAGE_WIDTH = 1100;
export const SITE_OG_IMAGE_HEIGHT = 764;
export const SITE_OG_IMAGE_ALT = 'HCROI 대시보드 화면 — 지표 타일과 추이 차트';
