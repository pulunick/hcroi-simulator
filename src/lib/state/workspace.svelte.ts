import { normalizePdfPrefs, type PdfPrefs } from '$lib/hcroi/pdf/map';
import { browser } from '$app/environment';
import { sampleRecords } from '$lib/hcroi/defaults';
import { DEFAULT_SCENARIO_PARAMS } from '$lib/hcroi/scenario';
import type {
	HcCostBreakdown,
	HeadcountBasis,
	HeadcountBreakdown,
	Scenario,
	Period,
	PeriodRecord,
	PeriodType,
	ScenarioParams
} from '$lib/hcroi/types';
import {
	comparePeriods,
	isValidPeriod,
	previousPeriod,
	samePeriod,
	yearAgoPeriod
} from '$lib/hcroi/period';
import { PERIODS_PER_YEAR, PERIOD_TYPES } from '$lib/hcroi/types';
import { DEFAULT_HEADCOUNT_BASIS } from '$lib/hcroi/types';
import { sumHcCost, sumHeadcount } from '$lib/hcroi/formulas';
import { rollup, rollupMismatch, type RollupMismatch } from '$lib/hcroi/rollup';
import { DEFAULT_AMOUNT_UNIT, isAmountUnit, type AmountUnit } from '$lib/hcroi/format';

/**
 * 프로토타입 단계의 작업공간 상태.
 * - 저장소: localStorage (브라우저 단일 사용자). DB 연동 시 이 모듈만 교체한다 (supabase/README.md 참조)
 * - 스키마 버전을 키에 포함해 구조 변경 시 안전하게 폐기한다.
 * - `records` 는 **직접 입력한** 기간만 담는다. 상위 기간(분기→반기→연간)은 `effective` 가 읽을 때 계산한다
 *   (`rollup.ts`) — 계산 레코드는 저장하지 않는다.
 */
const STORAGE_KEY = 'hcroi:workspace:v1';
/** 이 도구가 쓰는 localStorage 키의 공통 앞머리 — 설정 화면의 저장소 사용량 계산용 */
const STORAGE_PREFIX = 'hcroi:';
/** 엑셀 가져오기 반영 직전 상태 (되돌리기 1회분) */
const UNDO_KEY = 'hcroi:workspace:v1:undo';
/**
 * 화면 테마만 따로 담는 작은 키.
 * `app.html` 의 인라인 스크립트가 **첫 렌더 전에** 읽어야 하는데(밝게→어둡게 깜빡임 방지),
 * 작업공간 본문은 레코드가 전부 든 큰 JSON 이라 그 자리에서 파싱하기에 무겁고 손상 시 예외 위험도 있다.
 * 그래서 값 하나짜리 키를 따로 둔다 — 저장은 `save()` 에서 본문과 함께 이뤄지므로 둘은 항상 같은 값이다.
 */
const THEME_KEY = 'hcroi:theme';

/** 화면 테마 — 기본은 기기 설정 따라감 */
export type ThemePref = 'system' | 'light' | 'dark';
const THEME_PREFS: ThemePref[] = ['system', 'light', 'dark'];
export function isThemePref(v: unknown): v is ThemePref {
	return typeof v === 'string' && (THEME_PREFS as string[]).includes(v);
}

/** "방금 · n분 전 · n시간 전 · n일 전" — 헤더의 저장 시각 표기 */
export function relativeSavedLabel(savedAt: number | null, now: number): string {
	if (savedAt === null) return '저장 전';
	const sec = Math.max(0, Math.round((now - savedAt) / 1000));
	if (sec < 60) return '방금';
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}분 전`;
	const hour = Math.floor(min / 60);
	if (hour < 24) return `${hour}시간 전`;
	return `${Math.floor(hour / 24)}일 전`;
}

interface Persisted {
	/** 기간 레코드. 옛 저장값(2026-09-08 이전)은 `years` 키에 `year` 필드만 있는 연간 레코드 — load 에서 이행 */
	records?: PeriodRecord[];
	years?: unknown[];
	scenarios: Scenario[];
	/** 시뮬레이터 기준 기간 id */
	baseId?: string | null;
	/** 옛 키 */
	baseYearId?: string | null;
	/** 대시보드 제목에 붙는 회사/조직 이름 (선택) */
	orgName?: string;
	/** 금액 표시 단위 (선택). 저장값은 언제나 원 단위 정수 — 이건 보기 설정일 뿐이다 */
	amountUnit?: AmountUnit;
	/** 임직원 수 산정 기준 (선택). 없으면 기본값(기간 평균 · 정규직만) */
	headcountBasis?: HeadcountBasis;
	/** 결산서 PDF 읽기 설정 (회사명별, 선택) */
	pdfPrefs?: Record<string, PdfPrefs>;
	/** 경영진 리포트 머리글의 작성자 이름 (선택) */
	reportAuthor?: string;
	/** 경영진 리포트 머리글의 작성자 소속 (선택) */
	reportOrg?: string;
	/** 화면 테마 (선택). 없으면 기기 설정 따라감 */
	theme?: ThemePref;
	/** 마지막 저장 시각 (epoch ms, 선택). 헤더의 "n분 전" 표기용 */
	savedAt?: number;
	/** 마지막으로 백업 파일을 내려받은 시각 (epoch ms, 선택). 설정 화면 표기용 — 백업 파일 자체에는 넣지 않는다 */
	lastBackupAt?: number;
}

/**
 * 이 도구가 localStorage 에 쓰는 모든 키(`hcroi:…`)의 대략적인 바이트 합.
 * 브라우저 할당량은 UTF-16 문자 수를 기준으로 재므로 (키+값) 길이 × 2 로 센다.
 */
export function storageBytes(): number {
	if (!browser) return 0;
	try {
		let bytes = 0;
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
			bytes += (k.length + (localStorage.getItem(k)?.length ?? 0)) * 2;
		}
		return bytes;
	} catch {
		return 0;
	}
}

export function newId(): string {
	return typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `id-${Math.random().toString(36).slice(2)}`;
}

function defaultScenarios(): Scenario[] {
	return [
		{
			id: 'scenario-a',
			name: '시나리오 A',
			params: {
				...DEFAULT_SCENARIO_PARAMS,
				headcountPct: 10,
				wageIncreasePct: 5,
				productivityPct: 3
			}
		},
		{
			id: 'scenario-b',
			name: '시나리오 B',
			params: {
				...DEFAULT_SCENARIO_PARAMS,
				headcountPct: -5,
				wageIncreasePct: 3,
				productivityPct: 6
			}
		}
	];
}

/** 저장값의 산정 기준을 안전하게 읽는다 (없거나 손상되면 기본값) */
function normalizeBasis(v: unknown): HeadcountBasis {
	const d = structuredClone(DEFAULT_HEADCOUNT_BASIS);
	if (!v || typeof v !== 'object') return d;
	const o = v as Partial<HeadcountBasis>;
	if (o.method === 'average' || o.method === 'periodEnd') d.method = o.method;
	if (o.include && typeof o.include === 'object') {
		for (const k of ['contract', 'dispatched', 'executive'] as const) {
			if (typeof o.include[k] === 'boolean') d.include[k] = o.include[k];
		}
	}
	return d;
}

function isPersisted(v: unknown): v is Persisted {
	if (!v || typeof v !== 'object') return false;
	const o = v as Record<string, unknown>;
	return (Array.isArray(o.records) || Array.isArray(o.years)) && Array.isArray(o.scenarios);
}

/**
 * 저장된 레코드 하나를 현재 스키마로 맞춘다.
 * - 옛 연간 레코드(`year` 만 있음) → `period: {year, type:'Y', index:1}`
 * - 기간이 깨졌거나(알 수 없는 유형 포함) id·inputs 가 없으면 null — 호출 쪽이 개수를 세어 알린다
 * - `derived` 표시는 버린다(계산 레코드는 저장 대상이 아니다)
 */
function normalizeRecord(raw: unknown): PeriodRecord | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Partial<PeriodRecord> & { period?: Partial<Period>; year?: number };
	const period: Period = o.period
		? {
				year: Number(o.period.year),
				type: o.period.type as Period['type'],
				index: Number(o.period.index ?? 1)
			}
		: { year: Number(o.year), type: 'Y', index: 1 };
	if (!isValidPeriod(period) || typeof o.id !== 'string' || !o.inputs) return null;
	return {
		id: o.id,
		period,
		inputs: { ...o.inputs },
		breakdown: o.breakdown ?? null,
		headcountBreakdown: o.headcountBreakdown ?? null,
		memo: o.memo
	};
}

interface Migrated {
	records: PeriodRecord[];
	/** 기간을 읽을 수 없어 제외한 레코드 수 */
	dropped: number;
	scenarios: Scenario[];
	baseId: string | null;
	orgName: string;
	amountUnit: AmountUnit | null;
	headcountBasis: HeadcountBasis;
	pdfPrefs: Record<string, PdfPrefs>;
	reportAuthor: string;
	reportOrg: string;
	theme: ThemePref | null;
	savedAt: number | null;
	lastBackupAt: number | null;
}

/** 저장값(localStorage · JSON 파일 · 되돌리기 스냅샷)을 현재 스키마로 한 번에 옮긴다 — load/importJson 공통 */
function migratePersisted(p: Persisted): Migrated {
	const list = p.records ?? p.years ?? [];
	const records = list.map(normalizeRecord).filter((r): r is PeriodRecord => r !== null);
	return {
		records,
		dropped: list.length - records.length,
		scenarios: p.scenarios.length ? p.scenarios : defaultScenarios(),
		baseId: p.baseId ?? p.baseYearId ?? null,
		orgName: typeof p.orgName === 'string' ? p.orgName : '',
		amountUnit: isAmountUnit(p.amountUnit) ? p.amountUnit : null,
		headcountBasis: normalizeBasis(p.headcountBasis),
		pdfPrefs: normalizePdfPrefs(p.pdfPrefs),
		reportAuthor: typeof p.reportAuthor === 'string' ? p.reportAuthor : '',
		reportOrg: typeof p.reportOrg === 'string' ? p.reportOrg : '',
		theme: isThemePref(p.theme) ? p.theme : null,
		savedAt: typeof p.savedAt === 'number' && Number.isFinite(p.savedAt) ? p.savedAt : null,
		lastBackupAt:
			typeof p.lastBackupAt === 'number' && Number.isFinite(p.lastBackupAt) ? p.lastBackupAt : null
	};
}

export type ImportResult = { ok: true; warning: string | null } | { ok: false; error: string };

class Workspace {
	/** 직접 입력한 기간 레코드(연간·반기·분기·월 혼재 가능). 정렬은 `sorted`, 합산 포함 목록은 `effective` */
	records = $state<PeriodRecord[]>(sampleRecords());
	scenarios = $state<Scenario[]>(defaultScenarios());
	/** 시뮬레이터 기준 기간 id (없으면 최신 기간). 합산 레코드의 id(`derived:…`)도 될 수 있다 */
	baseId = $state<string | null>(null);
	/** 대시보드 제목 커스터마이징용 회사/조직 이름 (빈 문자열 = 기본 제목) */
	orgName = $state('');
	/** 화면·표에 금액을 어떤 단위로 보여줄지. 계산·저장에는 영향이 없다 */
	amountUnit = $state<AmountUnit>(DEFAULT_AMOUNT_UNIT);
	/**
	 * 임직원 수 산정 기준. 연도마다 다르면 추이 비교가 무의미해지므로 작업공간 단위로 둔다.
	 * 인원 세부 구성을 입력한 기간은 이 설정에 따라 총 임직원 수가 다시 계산되고,
	 * 산정 방식(기간 평균/기말)은 상위 기간을 합산할 때 인원을 어떻게 모을지 정한다.
	 */
	headcountBasis = $state<HeadcountBasis>(structuredClone(DEFAULT_HEADCOUNT_BASIS));
	/** 결산서 PDF 읽기 설정 — 회사명별(연결/별도 · 3개월/누적 · 인건비 항목). PDF 카드에서 보낼 때 기억된다 */
	pdfPrefs = $state<Record<string, PdfPrefs>>({});
	/**
	 * 경영진 리포트(/report) 머리글에 찍히는 작성자 이름·소속.
	 * 리포트 화면 위 도구 줄에서 입력하며, 다음에 열 때도 그대로 쓰도록 작업공간에 기억한다(서버 전송 없음).
	 */
	reportAuthor = $state('');
	reportOrg = $state('');
	/** 화면 테마 — 기기 설정 따라감(기본) · 밝게 · 어둡게. 레이아웃이 <html data-theme> 에 반영한다 */
	theme = $state<ThemePref>('system');
	/** localStorage 로드 완료 여부 — 로드 전에는 저장하지 않는다 */
	loaded = $state(false);
	/** 되돌릴 수 있는 가져오기 스냅샷이 있는지 */
	undoAvailable = $state(false);
	/** 마지막으로 localStorage 에 저장한 시각 (epoch ms). 헤더가 "n분 전" 으로 보여 준다 */
	savedAt = $state<number | null>(null);
	/** 마지막 저장 시도가 실패했는지 (용량 초과·프라이빗 모드 등). 헤더가 "저장 전" 대신 경고를 보여 준다 */
	saveError = $state(false);
	/**
	 * 마지막으로 백업 파일(.json)을 내려받은 시각 (epoch ms). 설정 화면이 "n일 전" 으로 보여 준다.
	 * 백업 파일 자체(`exportJson`)에는 넣지 않는다 — 파일을 다시 불러와도 "이 PC 의 마지막 백업"은 그대로여야 한다.
	 */
	lastBackupAt = $state<number | null>(null);
	/** 상대 시간 표기를 갱신하기 위한 현재 시각 — `startClock()` 이 1분마다 올린다 */
	private nowTick = $state(Date.now());

	/** 헤더 오른쪽 저장 표기 ("방금" · "3분 전"). 저장 전에는 "저장 전" */
	savedLabel = $derived(relativeSavedLabel(this.savedAt, this.nowTick));

	/** 상대 시간 표기를 1분마다 갱신한다. 레이아웃의 onMount 에서 호출하고 반환된 함수로 정리한다 */
	startClock(): () => void {
		if (!browser) return () => {};
		const id = setInterval(() => (this.nowTick = Date.now()), 30_000);
		return () => clearInterval(id);
	}

	/** 헤더 로고 자리에 보이는 이름 — 회사/조직 이름, 비어 있으면 도구 이름 */
	get brand(): string {
		return this.orgName.trim() || 'HCROI 시뮬레이터';
	}
	/** 브라우저 탭 제목. 대시보드는 "○○ 대시보드"(탭 메뉴 이름과 통일), 나머지는 "화면 — ○○" */
	pageTitle(section?: string): string {
		const org = this.orgName.trim();
		if (!section) return org ? `${org} 대시보드` : '대시보드';
		return `${section} — ${this.brand}`;
	}

	/** 직접 입력한 레코드만 시간순 (한 해의 분기·반기 뒤에 연간). 엑셀 `입력 데이터` 가 이것을 내보낸다 */
	sorted = $derived([...this.records].sort((a, b) => comparePeriods(a.period, b.period)));
	/**
	 * 직접 입력 + 하위 기간에서 계산된 상위 기간(`derived` 표시) — 대시보드·시뮬레이터·표가 쓰는 전체 목록.
	 * 직접 입력 레코드는 같은 객체라 여기서 고쳐도 저장된다. 계산 레코드는 편집 대상이 아니다.
	 */
	effective = $derived(rollup(this.records, this.headcountBasis));
	/** 가장 최근 기간 — 같은 끝 월이면 연간이 뒤에 오므로 연간(합산 포함)이 우선된다 */
	latest = $derived(this.effective.at(-1) ?? null);
	base = $derived(this.effective.find((y) => y.id === this.baseId) ?? this.latest);
	/** 작업공간에 있는 기간 유형들 (Y → H → Q → M 순, 합산으로 생긴 유형 포함) */
	periodTypes = $derived(
		PERIOD_TYPES.filter((t) => this.effective.some((r) => r.period.type === t))
	);

	/** 같은 유형의 레코드만 시간순으로 — 추이 차트·표·인사이트용 (유형을 섞어 비교하지 않는다) */
	ofType(type: PeriodType): PeriodRecord[] {
		return this.effective.filter((r) => r.period.type === type);
	}

	/**
	 * 전기 = 달력상 바로 앞 같은 유형 기간의 레코드 (2025 Q1 → 2024 Q4). 그 기간이 없으면 null —
	 * 목록에서 한 칸 앞 레코드를 "전기"라고 부르면 빠진 분기가 있을 때 엉뚱한 비교가 된다.
	 */
	previousOf(rec: PeriodRecord): PeriodRecord | null {
		return this.findByPeriod(previousPeriod(rec.period)) ?? null;
	}

	/** 전년 동기 레코드 (분기·반기의 계절성 비교용). 연간은 previousOf 와 같다 */
	yearAgoOf(rec: PeriodRecord): PeriodRecord | null {
		return this.findByPeriod(yearAgoPeriod(rec.period)) ?? null;
	}

	/** 합산 레코드까지 포함해 찾는다 */
	findByPeriod(period: Period): PeriodRecord | undefined {
		return this.effective.find((r) => samePeriod(r.period, period));
	}

	/** 직접 입력한 레코드 중 하위 기간 합산과 값이 다른 항목 (경고용). 합산 레코드나 하위 기간이 없으면 빈 배열 */
	mismatchOf(rec: PeriodRecord): RollupMismatch[] {
		if (rec.derived) return [];
		return rollupMismatch(rec, this.records, this.headcountBasis);
	}

	/**
	 * 합산 레코드를 직접 입력 레코드로 복사한다 (값을 손볼 때). 이후 이 기간은 합산 대신 직접 입력이 우선된다.
	 * 이미 직접 입력이면 그대로 돌려준다.
	 */
	materialize(id: string): PeriodRecord | null {
		const src = this.effective.find((r) => r.id === id);
		if (!src) return null;
		if (!src.derived) return src;
		const rec: PeriodRecord = {
			id: newId(),
			period: { ...src.period },
			inputs: { ...src.inputs },
			breakdown: src.breakdown ? { ...src.breakdown } : null,
			headcountBreakdown: src.headcountBreakdown ? { ...src.headcountBreakdown } : null,
			memo: '하위 기간 합산값에서 직접 입력으로 전환'
		};
		this.records.push(rec);
		if (this.baseId === id) this.baseId = rec.id;
		return rec;
	}

	/** 이행된 저장값을 상태에 싣는다. 인원 구분을 쓴 레코드는 실린 기준으로 총원을 다시 맞춘다 */
	private applyMigrated(m: Migrated) {
		this.records = m.records;
		this.scenarios = m.scenarios;
		this.baseId = m.baseId;
		this.orgName = m.orgName;
		this.amountUnit = m.amountUnit ?? this.amountUnit;
		this.headcountBasis = m.headcountBasis;
		this.pdfPrefs = m.pdfPrefs;
		this.reportAuthor = m.reportAuthor;
		this.reportOrg = m.reportOrg;
		if (m.theme) this.theme = m.theme;
		if (m.savedAt !== null) this.savedAt = m.savedAt;
		if (m.lastBackupAt !== null) this.lastBackupAt = m.lastBackupAt;
		this.applyHeadcountBasis();
	}

	load() {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed: unknown = JSON.parse(raw);
				if (isPersisted(parsed)) this.applyMigrated(migratePersisted(parsed));
			}
		} catch {
			/* 손상된 저장값은 무시하고 샘플로 시작 */
		}
		try {
			// 테마 전용 키가 최종 기준 — app.html 의 인라인 스크립트가 읽는 값과 화면 상태를 일치시킨다
			const t = localStorage.getItem(THEME_KEY);
			if (isThemePref(t)) this.theme = t;
		} catch {
			/* 저장소 접근 불가 — 기기 설정 따라감 */
		}
		try {
			this.undoAvailable = localStorage.getItem(UNDO_KEY) !== null;
		} catch {
			this.undoAvailable = false;
		}
		this.loaded = true;
	}

	save() {
		if (!browser || !this.loaded) return;
		// savedAt 을 읽지 않고 새 시각을 만들어 쓴다 — 저장 $effect 안에서 자기 자신을 읽으면 루프가 된다
		const ts = Date.now();
		const data: Persisted = {
			records: $state.snapshot(this.records),
			scenarios: $state.snapshot(this.scenarios),
			baseId: this.baseId,
			orgName: this.orgName,
			amountUnit: this.amountUnit,
			headcountBasis: $state.snapshot(this.headcountBasis),
			pdfPrefs: $state.snapshot(this.pdfPrefs),
			reportAuthor: this.reportAuthor,
			reportOrg: this.reportOrg,
			theme: this.theme,
			savedAt: ts,
			lastBackupAt: this.lastBackupAt ?? undefined
		};
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
			// 첫 렌더 전에 읽히는 테마 전용 키도 같이 갱신
			localStorage.setItem(THEME_KEY, this.theme);
			this.savedAt = ts;
			this.saveError = false;
		} catch {
			// 저장 실패(용량 초과·프라이빗 모드) — 헤더가 "저장 전" 대신 경고를 보여 주도록 표시만 하고 삼키지 않는다
			this.saveError = true;
		}
	}

	resetToSample() {
		this.records = sampleRecords();
		this.scenarios = defaultScenarios();
		this.baseId = null;
	}

	/**
	 * 레코드가 전부 샘플(id 접두어 `sample-`, `defaults.ts` 참조)이거나 0개면 true.
	 * 소개 페이지("결산서 PDF 로 시작" · "샘플 열어 보기") 시작 경로가 샘플을 비울지 그대로 둘지 가를 때 쓴다.
	 * 하나라도 직접 입력한(샘플이 아닌) 레코드가 있으면 false — 사용자 데이터를 함부로 지우지 않는다.
	 */
	isSampleOnly(): boolean {
		return this.records.every((r) => r.id.startsWith('sample-'));
	}

	/**
	 * 소개 페이지 "결산서 PDF 로 시작" 진입점 — 샘플이 섞이지 않은 빈 작업공간으로 만든다.
	 * `wipeAll()`(설정 화면의 "이 PC 의 데이터 지우기")과 달리 샘플로 되돌리지 않고 레코드 0개로 두며,
	 * 화면 표시 설정(테마·금액 단위·인원 산정 기준)·PDF 읽기 설정·리포트 작성자 정보는 그대로 유지한다.
	 */
	startFresh() {
		this.records = [];
		this.scenarios = defaultScenarios();
		this.baseId = null;
		this.orgName = '';
		this.saveError = false;
		if (browser) {
			try {
				localStorage.removeItem(UNDO_KEY);
			} catch {
				/* 저장소 접근 불가 — undoAvailable 만 내려서 표시라도 맞춘다 */
			}
		}
		this.undoAvailable = false;
		this.save();
	}

	clearAll() {
		this.records = [];
		this.scenarios = defaultScenarios();
		this.baseId = null;
	}

	/**
	 * 설정 화면의 "이 PC 의 데이터 지우기" — `resetToSample()` 과 달리 레코드·시나리오뿐 아니라
	 * 회사/조직 이름·리포트 작성자·소속·PDF 읽기 설정·마지막 백업 시각·되돌리기(가져오기 되돌리기) 저장분까지
	 * 전부 지우고 샘플로 되돌린다. 화면 테마(`hcroi:theme`)는 회사 데이터가 아니라 이 브라우저의 개인 표시
	 * 설정이라 지우지 않는다(지워도 다음 로드 때 `app.html` 인라인 스크립트가 다시 기기 설정으로 채워 의미가 없다).
	 */
	wipeAll() {
		this.records = sampleRecords();
		this.scenarios = defaultScenarios();
		this.baseId = null;
		this.orgName = '';
		this.amountUnit = DEFAULT_AMOUNT_UNIT;
		this.headcountBasis = structuredClone(DEFAULT_HEADCOUNT_BASIS);
		this.pdfPrefs = {};
		this.reportAuthor = '';
		this.reportOrg = '';
		this.lastBackupAt = null;
		this.saveError = false;
		this.undoAvailable = false;
		if (browser) {
			try {
				const toRemove: string[] = [];
				for (let i = 0; i < localStorage.length; i++) {
					const k = localStorage.key(i);
					if (k && k.startsWith(STORAGE_PREFIX) && k !== THEME_KEY) toRemove.push(k);
				}
				for (const k of toRemove) localStorage.removeItem(k);
			} catch {
				/* 저장소 접근 불가 — 아래 save() 가 새 상태로 다시 시도한다 */
			}
		}
		// 지운 직후 바로 새 상태로 저장해 둔다 (레이아웃의 저장 $effect 를 기다리지 않는다)
		this.save();
	}

	/**
	 * 기간을 추가한다. 같은 유형의 가장 최근 레코드(합산 포함) 값을 복사해 시작한다
	 * (분기를 추가하는데 연간 값을 복사하면 4배가 되어 버린다).
	 * 합산으로만 있던 기간을 추가하면 그 기간은 직접 입력이 우선된다.
	 */
	addPeriod(period: Period): PeriodRecord {
		// 같은 유형이 없으면 가장 최근 레코드를 기간 길이에 맞춰 환산해 시작한다(연간 → 분기는 ÷4).
		// 빈 레코드로 시작하면 곧바로 대시보드·시뮬레이터의 기본 기간이 되어 "—" 만 보인다.
		const same = this.ofType(period.type).at(-1) ?? null;
		const src = same ?? this.latest;
		const k = src ? PERIODS_PER_YEAR[src.period.type] / PERIODS_PER_YEAR[period.type] : 1;
		const scale = (v: number) => Math.round(v * k);
		const rec: PeriodRecord = {
			id: newId(),
			period,
			inputs: src
				? {
						revenue: scale(src.inputs.revenue),
						operatingCost: scale(src.inputs.operatingCost),
						hcCost: scale(src.inputs.hcCost),
						headcount: src.inputs.headcount
					}
				: { revenue: 0, operatingCost: 0, hcCost: 0, headcount: 1 },
			breakdown: src?.breakdown
				? (Object.fromEntries(
						Object.entries(src.breakdown).map(([key, v]) => [key, scale(v)])
					) as unknown as HcCostBreakdown)
				: null,
			headcountBreakdown: src?.headcountBreakdown ? { ...src.headcountBreakdown } : null
		};
		this.records.push(rec);
		return rec;
	}

	removeRecord(id: string) {
		this.records = this.records.filter((y) => y.id !== id);
		if (this.baseId === id) this.baseId = null;
	}

	/** 직접 입력한 레코드만 (편집용). 합산 레코드는 `effective` 에서 */
	getRecord(id: string): PeriodRecord | undefined {
		return this.records.find((y) => y.id === id);
	}

	/** 세부 내역이 있으면 총 인건비를 합계로 동기화 */
	setBreakdown(id: string, breakdown: HcCostBreakdown | null) {
		const y = this.getRecord(id);
		if (!y) return;
		y.breakdown = breakdown;
		if (breakdown) y.inputs.hcCost = sumHcCost(breakdown);
	}

	setHeadcountBreakdown(id: string, breakdown: HeadcountBreakdown | null) {
		const y = this.getRecord(id);
		if (!y) return;
		y.headcountBreakdown = breakdown;
		if (breakdown) y.inputs.headcount = sumHeadcount(breakdown, this.headcountBasis);
	}

	/** 산정 기준을 통째로 바꾼다 (엑셀 가져오기 등). 인원 구분을 쓴 기간의 총원이 함께 다시 계산된다 */
	setHeadcountBasis(basis: HeadcountBasis) {
		this.headcountBasis = structuredClone(basis);
		this.applyHeadcountBasis();
	}

	/**
	 * 인원 구분을 입력한 기간의 총 임직원 수 = 산정 기준을 적용한 합계.
	 * 레이아웃의 $effect 가 항상 호출하므로 기준·구분이 어디서 바뀌든 유지된다.
	 */
	applyHeadcountBasis() {
		for (const y of this.records) {
			if (y.headcountBreakdown) {
				y.inputs.headcount = sumHeadcount(y.headcountBreakdown, this.headcountBasis);
			}
		}
	}

	/** 직접 입력한 기간인지 (합산으로만 있는 기간은 false — 추가하면 직접 입력이 된다) */
	hasPeriod(period: Period): boolean {
		return this.records.some((r) => samePeriod(r.period, period));
	}

	updateScenarioParams(id: string, patch: Partial<ScenarioParams>) {
		const s = this.scenarios.find((x) => x.id === id);
		if (s) Object.assign(s.params, patch);
	}

	renameScenario(id: string, name: string) {
		const s = this.scenarios.find((x) => x.id === id);
		if (s) s.name = name;
	}

	resetScenario(id: string) {
		const s = this.scenarios.find((x) => x.id === id);
		if (s) s.params = { ...DEFAULT_SCENARIO_PARAMS };
	}

	/** 레코드 목록을 통째로 교체 (엑셀 가져오기 병합 결과 반영) */
	replaceRecords(records: PeriodRecord[]) {
		this.records = records;
		if (this.baseId && !this.effective.some((y) => y.id === this.baseId)) this.baseId = null;
		// 가져온 행은 파일의 기준으로 합계가 났을 수 있다 — 지금 기준으로 다시 맞춘다
		this.applyHeadcountBasis();
	}

	/** 가져오기 반영 전 현재 상태를 보관한다 (1회분, 새로고침 후에도 유지) */
	takeSnapshot() {
		if (!browser) return;
		try {
			localStorage.setItem(UNDO_KEY, this.exportJson());
			this.undoAvailable = true;
		} catch {
			this.undoAvailable = false;
		}
	}

	/** 보관된 스냅샷으로 되돌린다. 성공 시 true */
	restoreSnapshot(): boolean {
		if (!browser) return false;
		try {
			const raw = localStorage.getItem(UNDO_KEY);
			if (!raw || !this.importJson(raw).ok) return false;
			localStorage.removeItem(UNDO_KEY);
			this.undoAvailable = false;
			return true;
		} catch {
			return false;
		}
	}

	/** 백업 파일을 내려받은 직후 호출 — 시각을 기록하고 저장 $effect 가 localStorage 에 남긴다 */
	markBackedUp() {
		this.lastBackupAt = Date.now();
	}

	exportJson(): string {
		const data: Persisted = {
			records: $state.snapshot(this.records),
			scenarios: $state.snapshot(this.scenarios),
			baseId: this.baseId,
			orgName: this.orgName,
			amountUnit: this.amountUnit,
			headcountBasis: $state.snapshot(this.headcountBasis),
			pdfPrefs: $state.snapshot(this.pdfPrefs),
			reportAuthor: this.reportAuthor,
			reportOrg: this.reportOrg,
			theme: this.theme
		};
		return JSON.stringify(data, null, 2);
	}

	/** JSON 문자열을 불러온다. 기간을 읽을 수 없는 레코드는 제외하되 개수를 경고로 알린다 */
	importJson(text: string): ImportResult {
		try {
			const parsed: unknown = JSON.parse(text);
			if (!isPersisted(parsed))
				return { ok: false, error: '형식이 올바르지 않습니다 (records, scenarios 배열 필요).' };
			const m = migratePersisted(parsed);
			this.applyMigrated(m);
			return {
				ok: true,
				warning: m.dropped
					? `${m.dropped}개 레코드는 기간(연도·유형·순번)을 읽을 수 없어 제외했습니다.`
					: null
			};
		} catch (e) {
			return { ok: false, error: `JSON 파싱 실패: ${(e as Error).message}` };
		}
	}
}

export const workspace = new Workspace();
