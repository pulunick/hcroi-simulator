/**
 * 배포 환경에서 주입하는 공개 설정값 — **이 파일 한 곳에서만** `$env/dynamic/public` 을 읽는다.
 *
 * - 공개 저장소이므로 주소·이메일·토큰의 실제 값은 코드·문서에 적지 않는다. 전부 환경변수(`PUBLIC_*`)로
 *   받고, 값이 없으면 해당 기능이 조용히 꺼진다(사내 배포·미리보기·개발 서버가 그렇다).
 * - `$env/static/public` 은 변수가 하나라도 없으면 빌드가 깨지므로 쓰지 않는다.
 * - 계산 코어(`src/lib/hcroi/**`)와 `site-config.ts` 에는 `$env/*` 를 넣지 않는다(단위 테스트가 그대로 import 한다).
 */
import { env } from '$env/dynamic/public';
import { SITE_ENABLED } from '$lib/site-config';

/** 공개판의 정식 주소 (예: https://example.com). 끝 슬래시는 떼어 둔다 — 없으면 빈 문자열 */
export const SITE_ORIGIN = (env.PUBLIC_SITE_ORIGIN ?? '').replace(/\/+$/, '');

/** 문의를 받는 메일 주소. 없으면 문의 링크를 내보내지 않는다 */
export const CONTACT_EMAIL = env.PUBLIC_CONTACT_EMAIL ?? '';

/** 후원(커피 한 잔) 링크 주소. 없으면 후원 링크를 내보내지 않는다 */
export const DONATE_URL = env.PUBLIC_DONATE_URL ?? '';

/** Cloudflare Web Analytics 비컨 토큰. 없으면 비컨을 넣지 않는다 */
export const CF_BEACON_TOKEN = env.PUBLIC_CF_BEACON_TOKEN ?? '';

/** Umami 사이트 ID. 없으면 스크립트도 이벤트 전송도 하지 않는다 */
export const UMAMI_WEBSITE_ID = env.PUBLIC_UMAMI_WEBSITE_ID ?? '';

/** 구글 서치 콘솔 소유 확인 값 */
export const GOOGLE_SITE_VERIFICATION = env.PUBLIC_GOOGLE_SITE_VERIFICATION ?? '';

/** 네이버 서치어드바이저 소유 확인 값 */
export const NAVER_SITE_VERIFICATION = env.PUBLIC_NAVER_SITE_VERIFICATION ?? '';

/**
 * 검색 색인을 허용해도 되는 배포인가 — 공개판이면서 정식 주소가 정해져 있을 때만 참.
 * 사내 배포·미리보기 주소·개발 서버는 자동으로 거짓이 되어 모든 화면이 색인 제외된다.
 */
export const INDEXABLE = SITE_ENABLED && SITE_ORIGIN !== '';
