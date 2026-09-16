/**
 * 헤딩 앵커 슬러그 — GitHub(github-slugger) 방식.
 *
 * `docs/user-guide.md` 원본은 GitHub 에서도 그대로 읽히므로, 문서 안의 `[8장](#8-결산서-pdf-에서-값-가져오기)`
 * 같은 앵커가 **앱에서도 GitHub 과 똑같이** 동작해야 한다. 그래서 규칙을 GitHub 과 맞춘다:
 *
 *   1. 소문자로 (트림은 마크다운 파서가 이미 해 준다)
 *   2. 글자(한글 포함)·숫자·공백·`-`·`_` 외의 문자(구두점)를 **지운다** — 지운 자리의 공백은 남는다
 *   3. 공백을 `-` 로 바꾼다 (연속 공백 → 연속 하이픈, 끝의 공백 → 끝의 하이픈. GitHub 과 같음)
 *
 * 예) `2. 대시보드 (\`/\`)` → `2-대시보드-` (괄호 안이 통째로 지워지고 앞 공백만 하이픈으로 남는다)
 */

/** 글자·숫자·공백·`-`·`_` 를 제외한 모든 문자 */
const PUNCTUATION = /[^\p{L}\p{N}\s_-]/gu;

/** 헤딩 텍스트(마크업이 벗겨진 순수 텍스트) → 앵커 id. 순수 함수 */
export function slugify(text: string): string {
	return text.toLowerCase().replace(PUNCTUATION, '').replace(/\s/g, '-');
}

/**
 * 한 문서 안에서 중복 슬러그에 `-1`, `-2` … 를 붙여 주는 슬러거를 만든다(GitHub 과 같은 방식).
 * 문서 하나당 하나씩 만들어 헤딩 순서대로 호출한다.
 */
export function createSlugger(): (text: string) => string {
	const used = new Map<string, number>();
	return (text: string) => {
		const base = slugify(text);
		const seen = used.get(base) ?? 0;
		used.set(base, seen + 1);
		if (seen === 0) return base;
		// 이미 `foo-1` 이 헤딩으로 존재하는 경우까지 피한다
		let n = seen;
		while (used.has(`${base}-${n}`)) n += 1;
		const unique = `${base}-${n}`;
		used.set(unique, 1);
		return unique;
	};
}
