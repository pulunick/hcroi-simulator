import { error } from '@sveltejs/kit';
import { SITE_ENABLED } from '$lib/site-config';

/**
 * 개인정보 안내 — 공개판에만 있는 화면(사내 배포에서는 404). 소개 페이지와 같은 모양이다.
 * 프리렌더 여부를 `SITE_ENABLED` 에 맞춰 두어야 사내 배포 빌드가 404 를 구우려다 실패하지 않는다.
 */
export const ssr = true;
export const prerender = SITE_ENABLED;

export function load() {
	if (!SITE_ENABLED) error(404, '이 화면은 공개판에서만 제공됩니다');
}
