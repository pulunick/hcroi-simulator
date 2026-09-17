import { describe, expect, it } from 'vitest';
import {
	PEER_METRIC_KEYS,
	PEER_METRIC_LOWER_IS_BETTER,
	comparePeers,
	peerPeriods,
	type PeerEffective
} from './peers';
import { DEFAULT_HEADCOUNT_BASIS, type Period, type PeriodRecord } from './types';
import { periodKey } from './period';
import { rollup } from './rollup';

const basis = DEFAULT_HEADCOUNT_BASIS;
/** 화면(작업공간 `peerEffective`)과 같은 방식 — 합산은 코어 밖에서 한 번만 한다 */
const eff = (records: PeriodRecord[]): PeriodRecord[] => rollup(records, basis);
const Y = (year: number): Period => ({ year, type: 'Y', index: 1 });
const Q = (year: number, index: number): Period => ({ year, type: 'Q', index });

/** 영업이익으로 받아 영업비용으로 저장한다 (화면·엑셀과 같은 규칙) */
function rec(
	id: string,
	period: Period,
	revenue: number,
	operatingProfit: number,
	hcCost: number,
	headcount = 10
): PeriodRecord {
	return {
		id,
		period,
		inputs: { revenue, operatingCost: revenue - operatingProfit, hcCost, headcount },
		breakdown: null,
		headcountBreakdown: null
	};
}

function peer(name: string, ...records: PeriodRecord[]): PeerEffective {
	return { id: `peer-${name}`, name, effective: eff(records) };
}

/** HCROI = (영업이익 + 인건비) ÷ 인건비 — 인건비 100 고정이면 영업이익으로 배수를 정할 수 있다 */
const byHcroi = (name: string, operatingProfit: number, year = 2025) =>
	peer(name, rec(`${name}-${year}`, Y(year), 1_000, operatingProfit, 100));

const self2025 = [rec('self-2025', Y(2025), 1_000, 100, 200)]; // HCROI 1.5배 · 인건비율 20%

describe('comparePeers — 평균·중앙값', () => {
	it('업계 평균은 각 사 지표의 단순 평균이고, 짝수 개 중앙값은 가운데 둘의 평균이다 (자사 제외)', () => {
		// 상대 HCROI: 1.0 · 1.2 · 1.4 · 2.0 → 평균 1.4, 중앙값 (1.2+1.4)/2 = 1.3
		const peers = [
			byHcroi('가회사', 0),
			byHcroi('나회사', 20),
			byHcroi('다회사', 40),
			byHcroi('라회사', 100)
		];
		const c = comparePeers(eff(self2025), peers, Y(2025));
		expect(c.stats.hcroi.count).toBe(4);
		expect(c.stats.hcroi.mean).toBeCloseTo(1.4, 10);
		expect(c.stats.hcroi.median).toBeCloseTo(1.3, 10);
		// 자사(1.5배)는 평균에 들어가지 않는다
		expect(c.self.metrics?.hcroi).toBeCloseTo(1.5, 10);
	});

	it('홀수 개 중앙값은 가운데 값', () => {
		const c = comparePeers(
			eff(self2025),
			[byHcroi('가회사', 0), byHcroi('나회사', 20), byHcroi('다회사', 100)],
			Y(2025)
		);
		expect(c.stats.hcroi.median).toBeCloseTo(1.2, 10);
	});
});

describe('comparePeers — 순위', () => {
	it('자사를 포함해 매기고 동점은 같은 순위다 (1 + 자사보다 좋은 회사 수)', () => {
		// 상대 1.6 · 1.5(자사와 동점) · 1.0 → 자사 1.5 는 2위 (4곳 중)
		const peers = [byHcroi('가회사', 60), byHcroi('나회사', 50), byHcroi('다회사', 0)];
		const c = comparePeers(eff(self2025), peers, Y(2025));
		expect(c.rank.hcroi).toEqual({ rank: 2, of: 4 });
		// 동점 상대를 하나 더 넣어도 자사 순위는 그대로(더 좋은 회사 수만 센다)
		const c2 = comparePeers(eff(self2025), [...peers, byHcroi('라회사', 50)], Y(2025));
		expect(c2.rank.hcroi).toEqual({ rank: 2, of: 5 });
	});

	it('인건비율은 낮을수록 좋은 순위로 매긴다', () => {
		expect(PEER_METRIC_LOWER_IS_BETTER.hcCostToRevenue).toBe(true);
		expect(PEER_METRIC_LOWER_IS_BETTER.hcroi).toBe(false);
		// 자사 인건비율 20% · 상대 10% · 25% · 30% → 자사는 2위
		const peers = [
			peer('가회사', rec('a', Y(2025), 1_000, 100, 100)),
			peer('나회사', rec('b', Y(2025), 1_000, 100, 250)),
			peer('다회사', rec('c', Y(2025), 1_000, 100, 300))
		];
		const c = comparePeers(eff(self2025), peers, Y(2025));
		expect(c.self.metrics?.hcCostToRevenue).toBeCloseTo(20, 10);
		expect(c.rank.hcCostToRevenue).toEqual({ rank: 2, of: 4 });
		// 같은 자료에서 영업이익률은 전부 10% 동점 → 자사 1위
		expect(c.rank.operatingMargin).toEqual({ rank: 1, of: 4 });
	});

	it('상대가 0곳이면 순위는 null 이고 평균 개수도 0', () => {
		const c = comparePeers(eff(self2025), [], Y(2025));
		expect(c.peers).toEqual([]);
		for (const k of PEER_METRIC_KEYS) {
			expect(c.rank[k]).toBeNull();
			expect(c.stats[k]).toEqual({ mean: null, median: null, count: 0 });
		}
	});

	it('자사 레코드가 없으면 지표·순위는 null 이지만 업계 평균은 그대로 낸다', () => {
		const c = comparePeers([], [byHcroi('가회사', 0), byHcroi('나회사', 100)], Y(2025));
		expect(c.self.record).toBeNull();
		expect(c.self.metrics).toBeNull();
		expect(c.rank.hcroi).toBeNull();
		expect(c.stats.hcroi.count).toBe(2);
		expect(c.stats.hcroi.mean).toBeCloseTo(1.5, 10);
	});
});

describe('comparePeers — 레코드 없음·검증 오류', () => {
	it('검증 오류 레코드는 지표·평균·순위에서 빠지고, 행에는 남아 화면이 오류를 보여 줄 수 있다', () => {
		// 인건비(200) > 영업비용(100) → validateRecord 오류
		const broken = peer('나회사', rec('broken', Y(2025), 1_000, 900, 200));
		const c = comparePeers(eff(self2025), [byHcroi('가회사', 0), broken], Y(2025));
		const row = c.peers.find((p) => p.name === '나회사')!;
		expect(row.record).not.toBeNull();
		expect(row.metrics).toBeNull();
		expect(c.stats.hcroi.count).toBe(1);
		expect(c.stats.hcroi.mean).toBeCloseTo(1.0, 10);
		expect(c.rank.hcroi).toEqual({ rank: 1, of: 2 });
	});

	it('그 기간 레코드가 없는 회사는 record·metrics 가 모두 null', () => {
		const c = comparePeers(eff(self2025), [byHcroi('가회사', 0, 2024)], Y(2025));
		expect(c.peers[0].record).toBeNull();
		expect(c.peers[0].metrics).toBeNull();
		expect(c.stats.hcroi.count).toBe(0);
		expect(c.rank.hcroi).toBeNull();
	});
});

describe('comparePeers — 합산·정렬', () => {
	it('분기 4개만 넣은 상대도 연간 합산으로 비교된다', () => {
		const quarters = peer(
			'가회사',
			rec('q1', Q(2025, 1), 250, 25, 25),
			rec('q2', Q(2025, 2), 250, 25, 25),
			rec('q3', Q(2025, 3), 250, 25, 25),
			rec('q4', Q(2025, 4), 250, 25, 25)
		);
		const c = comparePeers(eff(self2025), [quarters], Y(2025));
		const row = c.peers[0];
		expect(row.record?.derived?.method).toBe('sum');
		expect(row.record?.inputs.revenue).toBe(1_000);
		expect(row.metrics?.hcroi).toBeCloseTo(2.0, 10); // (100 + 100) / 100
		expect(c.stats.hcroi.count).toBe(1);
	});

	it('상대 회사는 이름 순(ko)으로 정렬된다', () => {
		const peers = [byHcroi('다회사', 0), byHcroi('가회사', 0), byHcroi('나회사', 0)];
		const c = comparePeers(eff(self2025), peers, Y(2025));
		expect(c.peers.map((p) => p.name)).toEqual(['가회사', '나회사', '다회사']);
		expect(c.self.isSelf).toBe(true);
		expect(c.peers.every((p) => !p.isSelf)).toBe(true);
	});
});

describe('peerPeriods', () => {
	it('자사·상대의 기간을 합쳐 시간순으로 주고 중복은 하나로 묶는다 (합산 기간 포함)', () => {
		const peers = [
			peer('가회사', rec('a1', Y(2024), 1_000, 100, 100)),
			peer(
				'나회사',
				rec('b1', Q(2023, 1), 250, 25, 25),
				rec('b2', Q(2023, 2), 250, 25, 25),
				rec('b3', Q(2023, 3), 250, 25, 25),
				rec('b4', Q(2023, 4), 250, 25, 25)
			)
		];
		const keys = peerPeriods(
			eff([rec('s1', Y(2024), 1_000, 100, 100), rec('s2', Y(2025), 1_000, 100, 100)]),
			peers
		).map(periodKey);
		// 2023 분기 4개 + 그 합산(반기 2 · 연간) + 2024(자사·상대 중복 제거) + 2025
		expect(keys).toEqual([
			'2023-Q1',
			'2023-Q2',
			'2023-H1',
			'2023-Q3',
			'2023-Q4',
			'2023-H2',
			'2023-Y1',
			'2024-Y1',
			'2025-Y1'
		]);
	});

	it('검증 오류 기간은 비교 기간 목록에 넣지 않는다', () => {
		const keys = peerPeriods(eff([rec('bad', Y(2025), 1_000, 900, 200)]), [
			peer('가회사', rec('ok', Y(2024), 1_000, 100, 100))
		]).map(periodKey);
		expect(keys).toEqual(['2024-Y1']);
	});

	it('자사도 상대도 없으면 빈 배열', () => {
		expect(peerPeriods([], [])).toEqual([]);
	});
});
