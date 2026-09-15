/** 공개판(Headroom 사이트) 요소 on/off. main = false(사내 도구: 워드마크·소개 페이지 없음), product/commercial = true. 이 파일 한 줄만 브랜치 간에 다르다 — main 에서는 절대 바꾸지 말 것(docs/plans/branch-strategy.md §1). */
export const SITE_ENABLED = true;

/**
 * 제품명 — 회사/조직 이름을 넣지 않았을 때 쓰는 기본 이름(브라우저 탭 제목·엑셀 파일명 등).
 * 공개판(product/commercial)은 `Headroom`, 사내 도구(main)는 `HCROI 시뮬레이터`.
 * 이름이 두 곳 이상에 박히지 않게 여기 한 줄에서만 정한다.
 */
export const PRODUCT_NAME = SITE_ENABLED ? 'Headroom' : 'HCROI 시뮬레이터';
