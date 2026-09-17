import { SITE_PAGES } from '$lib/site-config';
import { INDEXABLE, SITE_ORIGIN } from '$lib/site/env';

/**
 * 사이트맵 — 검색에 내보내는 화면만 담는다(소개·가이드·설명서·개인정보).
 * 색인을 허용하지 않는 배포(사내 배포·미리보기·개발 서버)에서는 빈 목록을 내보낸다.
 */
export const prerender = true;

export function GET() {
	const lastmod = new Date().toISOString().slice(0, 10);
	const urls = INDEXABLE
		? Object.keys(SITE_PAGES)
				.map(
					(path) =>
						`\t<url>\n\t\t<loc>${SITE_ORIGIN}${path}</loc>\n\t\t<lastmod>${lastmod}</lastmod>\n\t</url>`
				)
				.join('\n')
		: '';
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls ? `\n${urls}\n` : ''}</urlset>\n`;
	return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
