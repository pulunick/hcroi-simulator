import { describe, expect, it } from 'vitest';
import { DOCS_BASE_URL, renderMarkdown, resolveDocLink } from './markdown';

describe('resolveDocLink — md 링크 변환', () => {
	it('문서 안 앵커는 그대로 둔다', () => {
		expect(resolveDocLink('#8-결산서-pdf-에서-값-가져오기')).toEqual({
			href: '#8-결산서-pdf-에서-값-가져오기',
			external: false
		});
	});

	it('md 상대 링크는 GitHub 의 docs/ 로 보낸다', () => {
		expect(resolveDocLink('spec.md')).toEqual({ href: `${DOCS_BASE_URL}spec.md`, external: true });
		expect(resolveDocLink('plans/pdf-to-excel.md').href).toBe(
			`${DOCS_BASE_URL}plans/pdf-to-excel.md`
		);
	});

	it('샘플 엑셀은 사이트 정적 경로로 바꾼다', () => {
		expect(resolveDocLink('samples/hcroi-sample-3y-quarterly.xlsx')).toEqual({
			href: '/samples/hcroi-sample-3y-quarterly.xlsx',
			external: false
		});
	});

	it('절대 주소는 그대로 두고 외부로 표시한다', () => {
		expect(resolveDocLink('https://example.com/a')).toEqual({
			href: 'https://example.com/a',
			external: true
		});
	});
});

describe('renderMarkdown', () => {
	const md = [
		'# 문서 제목',
		'',
		'## 1. 첫 절',
		'',
		'본문에서 [8장](#8-결산서-pdf-에서-값-가져오기) 과 [spec](spec.md) 을 가리킨다.',
		'',
		'## 8. 결산서 PDF 에서 값 가져오기',
		'',
		'| 가 | 나 |',
		'| --- | --- |',
		'| 1 | 2 |'
	].join('\n');
	const out = renderMarkdown(md);

	it('h1 은 제목으로 빼고 본문에는 남기지 않는다', () => {
		expect(out.title).toBe('문서 제목');
		expect(out.html).not.toContain('<h1');
	});

	it('h2 에 GitHub 앵커 id 를 붙이고 목차로 모은다', () => {
		expect(out.toc.map((t) => t.id)).toEqual(['1-첫-절', '8-결산서-pdf-에서-값-가져오기']);
		expect(out.html).toContain('<h2 id="8-결산서-pdf-에서-값-가져오기">');
	});

	it('본문 앵커가 실제 헤딩 id 를 가리킨다', () => {
		expect(out.html).toContain('href="#8-결산서-pdf-에서-값-가져오기"');
	});

	it('상대 md 링크는 GitHub 으로, 외부 링크에는 rel=noreferrer', () => {
		expect(out.html).toContain(`href="${DOCS_BASE_URL}spec.md" rel="noreferrer"`);
	});

	it('표는 가로 스크롤 상자로 감싼다', () => {
		expect(out.html).toContain('<div class="table-wrap"><table>');
	});
});
