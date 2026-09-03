import { browser } from '$app/environment';
import { sampleYears } from '$lib/hcroi/defaults';
import { DEFAULT_SCENARIO_PARAMS } from '$lib/hcroi/scenario';
import type { HcCostBreakdown, Scenario, ScenarioParams, YearRecord } from '$lib/hcroi/types';
import { sumHcCost } from '$lib/hcroi/formulas';

/**
 * 프로토타입 단계의 작업공간 상태.
 * - 저장소: localStorage (브라우저 단일 사용자). DB 연동 시 이 모듈만 교체한다 (supabase/README.md 참조)
 * - 스키마 버전을 키에 포함해 구조 변경 시 안전하게 폐기한다.
 */
const STORAGE_KEY = 'hcroi:workspace:v1';
/** 엑셀 가져오기 반영 직전 상태 (되돌리기 1회분) */
const UNDO_KEY = 'hcroi:workspace:v1:undo';

interface Persisted {
	years: YearRecord[];
	scenarios: Scenario[];
	baseYearId: string | null;
	/** 대시보드 제목에 붙는 회사/조직 이름 (선택) */
	orgName?: string;
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

function isPersisted(v: unknown): v is Persisted {
	if (!v || typeof v !== 'object') return false;
	const o = v as Record<string, unknown>;
	return Array.isArray(o.years) && Array.isArray(o.scenarios);
}

class Workspace {
	years = $state<YearRecord[]>(sampleYears());
	scenarios = $state<Scenario[]>(defaultScenarios());
	baseYearId = $state<string | null>(null);
	/** 대시보드 제목 커스터마이징용 회사/조직 이름 (빈 문자열 = 기본 제목) */
	orgName = $state('');
	/** localStorage 로드 완료 여부 — 로드 전에는 저장하지 않는다 */
	loaded = $state(false);
	/** 되돌릴 수 있는 가져오기 스냅샷이 있는지 */
	undoAvailable = $state(false);

	sortedYears = $derived([...this.years].sort((a, b) => a.year - b.year));
	latestYear = $derived(this.sortedYears.at(-1) ?? null);
	baseYear = $derived(this.years.find((y) => y.id === this.baseYearId) ?? this.latestYear);

	load() {
		if (!browser) return;
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed: unknown = JSON.parse(raw);
				if (isPersisted(parsed)) {
					this.years = parsed.years;
					this.scenarios = parsed.scenarios.length ? parsed.scenarios : defaultScenarios();
					this.baseYearId = parsed.baseYearId ?? null;
					this.orgName = typeof parsed.orgName === 'string' ? parsed.orgName : '';
				}
			}
		} catch {
			/* 손상된 저장값은 무시하고 샘플로 시작 */
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
		const data: Persisted = {
			years: $state.snapshot(this.years),
			scenarios: $state.snapshot(this.scenarios),
			baseYearId: this.baseYearId,
			orgName: this.orgName
		};
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
		} catch {
			/* 저장 실패(용량·프라이빗 모드)는 무시 */
		}
	}

	resetToSample() {
		this.years = sampleYears();
		this.scenarios = defaultScenarios();
		this.baseYearId = null;
	}

	clearAll() {
		this.years = [];
		this.scenarios = defaultScenarios();
		this.baseYearId = null;
	}

	addYear(year: number): YearRecord {
		const prev = this.sortedYears.at(-1);
		const rec: YearRecord = {
			id: newId(),
			year,
			inputs: prev ? { ...prev.inputs } : { revenue: 0, operatingCost: 0, hcCost: 0, headcount: 1 },
			breakdown: prev?.breakdown ? { ...prev.breakdown } : null
		};
		this.years.push(rec);
		return rec;
	}

	removeYear(id: string) {
		this.years = this.years.filter((y) => y.id !== id);
		if (this.baseYearId === id) this.baseYearId = null;
	}

	getYear(id: string): YearRecord | undefined {
		return this.years.find((y) => y.id === id);
	}

	/** 세부 내역이 있으면 총 인건비를 합계로 동기화 */
	setBreakdown(id: string, breakdown: HcCostBreakdown | null) {
		const y = this.getYear(id);
		if (!y) return;
		y.breakdown = breakdown;
		if (breakdown) y.inputs.hcCost = sumHcCost(breakdown);
	}

	hasYear(year: number): boolean {
		return this.years.some((y) => y.year === year);
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

	/** 연도 목록을 통째로 교체 (엑셀 가져오기 병합 결과 반영) */
	replaceYears(years: YearRecord[]) {
		this.years = years;
		if (this.baseYearId && !years.some((y) => y.id === this.baseYearId)) this.baseYearId = null;
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
			if (!raw || this.importJson(raw) !== null) return false;
			localStorage.removeItem(UNDO_KEY);
			this.undoAvailable = false;
			return true;
		} catch {
			return false;
		}
	}

	exportJson(): string {
		const data: Persisted = {
			years: $state.snapshot(this.years),
			scenarios: $state.snapshot(this.scenarios),
			baseYearId: this.baseYearId,
			orgName: this.orgName
		};
		return JSON.stringify(data, null, 2);
	}

	/** JSON 문자열을 불러온다. 성공 시 null, 실패 시 오류 메시지 */
	importJson(text: string): string | null {
		try {
			const parsed: unknown = JSON.parse(text);
			if (!isPersisted(parsed)) return '형식이 올바르지 않습니다 (years, scenarios 배열 필요).';
			this.years = parsed.years;
			this.scenarios = parsed.scenarios.length ? parsed.scenarios : defaultScenarios();
			this.baseYearId = parsed.baseYearId ?? null;
			this.orgName = typeof parsed.orgName === 'string' ? parsed.orgName : '';
			return null;
		} catch (e) {
			return `JSON 파싱 실패: ${(e as Error).message}`;
		}
	}
}

export const workspace = new Workspace();
