import { INDEXABLE, SITE_ORIGIN } from '$lib/site/env';

/**
 * 검색 로봇 안내문. 빌드할 때 파일로 구워진다(예전 `static/robots.txt` 를 대신한다).
 * 색인을 허용하는 배포(공개판 + 정식 주소)에서만 문을 열고, 그때도 개인 데이터를 다루는
 * 앱 화면은 전부 막는다. 사내 배포·미리보기 주소·개발 서버는 통째로 막는다.
 */
export const prerender = true;

/** 검색 결과에 남으면 안 되는 앱 화면 (`/` 는 그 주소 하나만 — 아래 화면들이 따로 막힌다) */
const APP_PATHS = ['/$', '/data', '/simulator', '/peers', '/report', '/settings'];

export function GET() {
	const lines = INDEXABLE
		? [
				'User-agent: *',
				'Allow: /',
				...APP_PATHS.map((p) => `Disallow: ${p}`),
				'',
				`Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
				''
			]
		: ['User-agent: *', 'Disallow: /', ''];
	return new Response(lines.join('\n'), {
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
}
