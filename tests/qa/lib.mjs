// tests/qa/lib.mjs — 공통 유틸(BASE·OUT·브라우저 실행·결과 표). 각 QA 스크립트가 import 한다.
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

/** dev 서버 주소. `BASE=http://... npm run qa` 로 바꿀 수 있다. */
export const BASE = process.env.BASE || 'http://127.0.0.1:5173';

/** 스크린샷·산출물 저장 위치. 기본은 `tests/qa/out/`(.gitignore 처리됨). */
export const OUT = process.env.OUT || 'tests/qa/out';

/** OUT 디렉터리를 만들고 경로를 돌려준다. */
export function ensureOutDir(dir = OUT) {
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

/** OUT 아래 파일 경로를 만든다(디렉터리 자동 생성). */
export function outPath(name, dir = OUT) {
	ensureOutDir(dir);
	return path.join(dir, name);
}

/**
 * 로컬에 설치된 Chrome 으로 브라우저를 띄운다(플레이라이트 번들 브라우저 다운로드 없음).
 * Chrome 이 없으면 안내 메시지를 찍고 프로세스를 종료한다.
 */
export async function launchChrome(opts = {}) {
	try {
		return await chromium.launch({ channel: 'chrome', ...opts });
	} catch (e) {
		console.error('로컬 Google Chrome 을 찾을 수 없습니다. Chrome 을 설치한 뒤 다시 실행하세요.');
		console.error(String(e?.message || e));
		process.exit(1);
	}
}

/**
 * `src/lib/site-config.ts` 의 `SITE_ENABLED` 값을 읽는다(파일을 파싱하지 않고 정규식으로만 추출 —
 * 이 파일은 순수 상수 한 줄이라 이 방식으로 충분하다). main/product 어느 트리에서 실행하든
 * 그 트리의 실제 값을 따라간다.
 */
export function readSiteEnabled(repoRoot = process.cwd()) {
	const file = path.join(repoRoot, 'src', 'lib', 'site-config.ts');
	const src = fs.readFileSync(file, 'utf8');
	const m = src.match(/export const SITE_ENABLED\s*=\s*(true|false)/);
	if (!m) throw new Error(`SITE_ENABLED 를 ${file} 에서 찾지 못했습니다`);
	return m[1] === 'true';
}

/**
 * SITE_ENABLED 로부터 파생되는 기대값 묶음(제품명·대시보드 제목 등) — `site-config.ts` 의
 * 파생 로직과 반드시 같은 값을 내야 하므로 그 파일의 주석·규칙을 그대로 옮긴다.
 */
export function siteExpectations(repoRoot = process.cwd()) {
	const enabled = readSiteEnabled(repoRoot);
	return {
		enabled,
		productName: enabled ? 'Headroom' : 'HCROI 시뮬레이터',
		dashboardTitle: enabled ? '대시보드' : 'HCROI 대시보드'
	};
}

/**
 * 앱과 무관한 브라우저 노이즈(favicon.ico 404 등) — 콘솔/HTTP 오류 집계에서 제외한다.
 * Chrome 이 `<link rel="icon">` 와 별개로 `/favicon.ico` 를 자체 요청하는 경우가 있어 항상 뜬다.
 */
export const IGNORABLE_LOG_RE = /favicon\.ico/;

/**
 * 콘솔 메시지가 무시해도 되는 브라우저 노이즈인지 판단한다. 리소스 로드 실패 메시지는 본문
 * 텍스트에 URL 이 없고 `location().url` 에만 있으므로 텍스트와 위치를 함께 본다.
 */
export function isIgnorableConsoleMessage(m) {
	if (IGNORABLE_LOG_RE.test(m.text())) return true;
	try {
		const loc = m.location?.();
		if (loc?.url && IGNORABLE_LOG_RE.test(loc.url)) return true;
	} catch {
		// location() 이 없는 메시지 타입은 무시하고 계속 진행
	}
	return false;
}

/** PASS/FAIL 을 즉시 출력하고 모아 두었다가 끝에 표로 정리하는 결과 수집기. */
export class Results {
	constructor(title = 'QA') {
		this.title = title;
		this.rows = [];
	}

	/** 판정 하나를 기록하고 바로 한 줄 출력한다. ok 가 falsy 면 FAIL. */
	add(label, ok, note = '') {
		console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${note ? ' — ' + note : ''}`);
		this.rows.push({ label, ok: !!ok });
		return !!ok;
	}

	/** 마지막에 PASS/FAIL 표를 찍고, 하나라도 FAIL 이면 process.exitCode = 1 로 설정한다. */
	finish() {
		const total = this.rows.length;
		const passed = this.rows.filter((r) => r.ok).length;
		console.log(`\n=== ${this.title}: ${passed}/${total} PASS ===`);
		for (const r of this.rows) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.label}`);
		if (passed < total) process.exitCode = 1;
		return passed === total;
	}
}

/** env 값이 없거나 파일이 없으면 안내를 찍고 프로세스를 정상 종료(exit 0)한다. */
export function skipIfMissingFile(envValue, label) {
	if (!envValue || !fs.existsSync(envValue)) {
		console.log(`${label} 없음 — 건너뜀`);
		return true;
	}
	return false;
}
