/**
 * 방문 분석 — **이름 하나만** 보낸다.
 *
 * 입력한 숫자·파일 이름·회사 이름은 어떤 경우에도 나가지 않는다. 그래서 `track` 은 인자로
 * 정해진 이름만 받는다(값을 실을 자리 자체가 없다). 페이지 조회는 도구 스크립트가 알아서 센다.
 * 공개판이고 Umami 사이트 ID 가 들어와 있을 때만 전송하고, 그 밖에는(사내 배포·미리보기·개발 서버)
 * 아무 일도 하지 않는다.
 */
import { SITE_ENABLED } from '$lib/site-config';
import { UMAMI_WEBSITE_ID } from './env';

/** 재는 것 다섯 가지 — 계획 docs/plans/public-deploy.md §5.3 */
export type EventName =
	'start_pdf' | 'start_sample' | 'pdf_applied' | 'excel_import' | 'report_print';

interface UmamiWindow {
	umami?: { track?: (name: string) => void };
}

export function track(name: EventName): void {
	if (!SITE_ENABLED || UMAMI_WEBSITE_ID === '') return;
	if (typeof window === 'undefined') return;
	try {
		(window as unknown as UmamiWindow).umami?.track?.(name);
	} catch {
		// 분석이 실패해도 화면은 계속 동작해야 한다
	}
}
