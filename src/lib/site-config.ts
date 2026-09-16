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

/** 링크 공유 미리보기 이미지(static/) 와 그 실제 픽셀 크기 — og:image:width/height 에 그대로 쓴다 */
export const SITE_OG_IMAGE = '/hero-dashboard.jpg';
export const SITE_OG_IMAGE_WIDTH = 1100;
export const SITE_OG_IMAGE_HEIGHT = 764;
export const SITE_OG_IMAGE_ALT = 'HCROI 대시보드 화면 — 지표 타일과 추이 차트';
