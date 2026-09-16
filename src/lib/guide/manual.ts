/**
 * 사용 설명서 본문 — 원본은 저장소의 `docs/user-guide.md` **하나뿐**이다.
 * GitHub 에서 읽히는 그 파일을 `?raw` 로 그대로 가져와 렌더한다(복제본 금지).
 *
 * 파싱은 **모듈 스코프에서 한 번만** 한다 — 페이지를 다시 열어도 다시 파싱하지 않는다.
 */
import raw from '../../../docs/user-guide.md?raw';
import { renderMarkdown } from './markdown';

export const manual = renderMarkdown(raw);
