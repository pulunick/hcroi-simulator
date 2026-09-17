/**
 * 사용 설명서는 저장소 문서 하나를 그대로 렌더하므로 상태에 기대지 않는다 — 빌드할 때 HTML 로
 * 구워 둔다(프리렌더). 검색에서 가장 긴 본문을 가진 화면이다.
 */
export const ssr = true;
export const prerender = true;
