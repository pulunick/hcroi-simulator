import { error } from '@sveltejs/kit';
import { SITE_ENABLED } from '$lib/site-config';

// 사내 배포(main, SITE_ENABLED=false)에는 소개 페이지가 없다 — 공개판(product/commercial)에서만 렌더.
export function load() {
	if (!SITE_ENABLED) error(404, '이 화면은 공개판에서만 제공됩니다');
}
