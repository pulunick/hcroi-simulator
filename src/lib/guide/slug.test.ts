import { describe, expect, it } from 'vitest';
import { createSlugger, slugify } from './slug';

describe('slugify — GitHub 앵커 규칙', () => {
	it('마침표·공백: `8. 결산서 PDF 에서 값 가져오기` → GitHub 앵커', () => {
		// docs/user-guide.md 안의 [8장](#8-결산서-pdf-에서-값-가져오기) 가 이 값을 가리킨다
		expect(slugify('8. 결산서 PDF 에서 값 가져오기')).toBe('8-결산서-pdf-에서-값-가져오기');
	});

	it('코드·괄호·슬래시는 지우고 앞 공백만 하이픈으로: `9. 경영진 리포트 (`/report`)`', () => {
		expect(slugify('9. 경영진 리포트 (/report)')).toBe('9-경영진-리포트-report');
	});

	it('지워진 자리의 공백은 남는다 — `2. 대시보드 (/)` 는 끝에 하이픈', () => {
		expect(slugify('2. 대시보드 (/)')).toBe('2-대시보드-');
	});

	it('연속 공백은 연속 하이픈: `7. 지금 되는 것 / 안 되는 것`', () => {
		expect(slugify('7. 지금 되는 것 / 안 되는 것')).toBe('7-지금-되는-것--안-되는-것');
	});

	it('영문은 소문자로, `-`·`_` 는 남긴다', () => {
		expect(slugify('Read_me — Quick Start!')).toBe('read_me--quick-start');
	});
});

describe('createSlugger — 중복 처리', () => {
	it('같은 제목이 반복되면 -1, -2 를 붙인다', () => {
		const slug = createSlugger();
		expect(slug('가정')).toBe('가정');
		expect(slug('가정')).toBe('가정-1');
		expect(slug('가정')).toBe('가정-2');
	});

	it('다른 제목끼리는 서로 영향이 없다', () => {
		const slug = createSlugger();
		expect(slug('1. 개요')).toBe('1-개요');
		expect(slug('2. 개요')).toBe('2-개요');
	});
});
