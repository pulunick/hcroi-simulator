/**
 * `docs/user-guide.md` 를 앱 안에서 보여 주기 위한 마크다운 렌더러.
 *
 * 원본은 **md 하나뿐**이다 — 화면용으로 svelte 에 다시 옮겨 적지 않는다(두 벌이 되면 반드시 어긋난다).
 * GitHub 에서도 그대로 읽혀야 하므로 md 안의 링크는 GitHub 기준(상대 경로·GitHub 앵커)으로 두고,
 * 앱에서 보여 줄 때만 여기서 링크를 바꿔 준다.
 *
 * 헤딩 id 는 `slug.ts`(GitHub 규칙)로 붙인다 — marked 최신 버전은 headerIds 를 붙이지 않는다.
 */
import { Marked, Renderer, type Tokens } from 'marked';
import { createSlugger } from './slug';

/** 상대 링크(`spec.md`, `plans/…`)가 가리킬 GitHub 문서 폴더 */
export const DOCS_BASE_URL = 'https://github.com/pulunick/hcroi-simulator/blob/main/docs/';

/** md 의 상대 경로 → 사이트 정적 파일 경로. 첨부 파일은 GitHub 대신 이 사이트에서 바로 받게 한다 */
export const SITE_FILES: Record<string, string> = {
	'samples/hcroi-sample-3y-quarterly.xlsx': '/samples/hcroi-sample-3y-quarterly.xlsx'
};

export interface ResolvedLink {
	href: string;
	/** 바깥 사이트(GitHub 등)로 나가는 링크 — `rel="noreferrer"` 를 붙인다(새 창은 열지 않는다) */
	external: boolean;
}

/** md 안의 링크 주소를 앱에서 쓸 주소로 바꾼다. 순수 함수 */
export function resolveDocLink(href: string): ResolvedLink {
	const raw = href.trim();
	// 문서 안 앵커(#8-…)는 그대로 — slug.ts 가 GitHub 과 같은 id 를 붙여 두었다
	if (raw.startsWith('#')) return { href: raw, external: false };
	// 이미 절대 주소(http/https/mailto/프로토콜 상대)면 그대로
	if (/^(https?:)?\/\//i.test(raw) || /^[a-z][a-z0-9+.-]*:/i.test(raw))
		return { href: raw, external: true };
	// 사이트가 직접 서빙하는 첨부 파일(샘플 엑셀)
	const [path, hash] = splitHash(raw);
	const site = SITE_FILES[path];
	if (site) return { href: site + hash, external: false };
	// 나머지 상대 경로는 docs/ 안의 문서 — GitHub 에서 읽게 한다
	return { href: DOCS_BASE_URL + raw, external: true };
}

function splitHash(href: string): [string, string] {
	const i = href.indexOf('#');
	return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i)];
}

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export interface TocEntry {
	id: string;
	text: string;
}

export interface RenderedMarkdown {
	/** md 첫 줄의 h1 (있으면). 본문 HTML 에서는 빠지고 페이지 제목으로 쓴다 */
	title: string;
	html: string;
	/** h2 목록 — 화면 목차 */
	toc: TocEntry[];
}

class ManualRenderer extends Renderer {
	private readonly slug = createSlugger();
	readonly toc: TocEntry[] = [];
	title = '';

	override heading(token: Tokens.Heading): string {
		const html = this.parser.parseInline(token.tokens);
		const plain = this.parser.parseInline(token.tokens, this.parser.textRenderer);
		const id = this.slug(plain);
		if (token.depth === 1) {
			// h1 은 페이지 제목으로 쓰고 본문에서는 뺀다 (화면 h1 과 중복 방지)
			this.title = plain;
			return '';
		}
		if (token.depth === 2) this.toc.push({ id, text: plain });
		return `<h${token.depth} id="${escapeAttr(id)}">${html}</h${token.depth}>\n`;
	}

	override link(token: Tokens.Link): string {
		const { href, external } = resolveDocLink(token.href);
		const text = this.parser.parseInline(token.tokens);
		const title = token.title ? ` title="${escapeAttr(token.title)}"` : '';
		// 새 창(target=_blank)은 열지 않는다 — 문서 안 이동과 같은 느낌을 유지
		const rel = external ? ' rel="noreferrer"' : '';
		return `<a href="${escapeAttr(href)}"${title}${rel}>${text}</a>`;
	}

	override table(token: Tokens.Table): string {
		// 표는 좁은 화면에서 자기 상자 안에서만 가로 스크롤한다(문서 전체가 가로로 넘치지 않게)
		return `<div class="table-wrap">${super.table(token)}</div>\n`;
	}
}

/**
 * 마크다운 → HTML + 목차. 렌더 결과는 `{@html}` 로 꽂는다.
 * XSS 우려 없음 — 입력은 저장소 안의 우리 문서(`docs/user-guide.md`) 하나뿐이고 사용자 입력이 아니다.
 */
export function renderMarkdown(md: string): RenderedMarkdown {
	const renderer = new ManualRenderer();
	const html = new Marked().parse(md, { renderer, gfm: true, async: false });
	return { title: renderer.title, html, toc: renderer.toc };
}
