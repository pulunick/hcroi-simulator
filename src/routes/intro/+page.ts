import { error } from '@sveltejs/kit';
import { SITE_ENABLED } from '$lib/site-config';

/**
 * 소개 페이지만 서버 렌더한다 — 루트 레이아웃(`+layout.ts`)의 `ssr = false` 를 이 페이지에서만 덮는다.
 * 링크 미리보기(카카오톡·슬랙·X) 크롤러는 JS 를 돌리지 않으므로, 서버가 그린 HTML 에
 * `<svelte:head>` 의 og/twitter 태그가 들어 있어야 공유 카드가 뜬다.
 * 앱 화면들은 localStorage 로만 사는 상태라 `ssr = false` 그대로 둔다(브라우저 전용).
 * SITE_ENABLED=false(사내 배포)에서는 아래 load 가 서버에서 404 를 내고 `+error.svelte` 가 렌더된다.
 */
export const ssr = true;

// 사내 배포(main, SITE_ENABLED=false)에는 소개 페이지가 없다 — 공개판(product/commercial)에서만 렌더.
export function load() {
	if (!SITE_ENABLED) error(404, '이 화면은 공개판에서만 제공됩니다');
}
