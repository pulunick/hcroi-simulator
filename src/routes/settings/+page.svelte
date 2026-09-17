<script lang="ts">
	/**
	 * 설정 — 금액 표시 단위 · 임직원 수 산정 기준 · 화면 테마 · 백업.
	 * 시안 docs/design/commercial/Settings.dc.html 의 4개 절 구조를 그대로 따른다.
	 * 옵션 목록·라벨은 전부 `$lib/hcroi` 의 기존 export 를 쓴다 (화면에 복제하지 않는다).
	 */
	import { onMount } from 'svelte';
	import { relativeSavedLabel, storageBytes, workspace } from '$lib/state/workspace.svelte';
	import type { ThemePref } from '$lib/state/workspace.svelte';
	import {
		exportWorkspaceExcel,
		exportWorkspaceJson,
		importWorkspaceJsonFile
	} from '$lib/state/io';
	import { AMOUNT_UNITS, formatAmount, headcountBasisLabel } from '$lib/hcroi/format';
	import {
		HEADCOUNT_LABELS,
		HEADCOUNT_METHOD_LABELS,
		HEADCOUNT_OPTIONAL_KEYS
	} from '$lib/hcroi/types';
	import SettingsSection from '$lib/components/settings/SettingsSection.svelte';
	import ChipRadio from '$lib/components/settings/ChipRadio.svelte';
	import Checkbox from '$lib/components/settings/Checkbox.svelte';

	const METHOD_OPTIONS = [
		{ key: 'average', label: HEADCOUNT_METHOD_LABELS.average },
		{ key: 'periodEnd', label: HEADCOUNT_METHOD_LABELS.periodEnd }
	] as const;

	const THEME_OPTIONS = [
		{ key: 'system', label: '기기 설정 따라감' },
		{ key: 'light', label: '밝게' },
		{ key: 'dark', label: '어둡게' }
	] as const satisfies readonly { key: ThemePref; label: string }[];

	/** 01 절의 예시 문장에 쓰는 금액 (가상 수치) */
	const SAMPLE_HC_COST = 3_384_000_000;

	// "5일 전" 표기를 살아 있게 한다 (헤더의 저장 시각과 같은 주기)
	let now = $state(Date.now());
	onMount(() => {
		const id = setInterval(() => (now = Date.now()), 30_000);
		return () => clearInterval(id);
	});

	// 저장소 사용량 — 저장될 때마다 다시 센다
	let usedBytes = $state(0);
	$effect(() => {
		void workspace.savedAt;
		usedBytes = storageBytes();
	});
	const usedLabel = $derived.by(() => {
		const mb = usedBytes / 1024 / 1024;
		return `${mb >= 1 ? mb.toFixed(1) : mb.toFixed(2)} MB`;
	});
	const backupLabel = $derived.by(() => {
		const ts = workspace.lastBackupAt;
		if (ts === null) return '아직 없음';
		const d = new Date(ts);
		const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		return `${relativeSavedLabel(ts, now)} · ${date}`;
	});

	let message = $state<string | null>(null);
	let busy = $state(false);

	/** 백업 파일(.json) 저장 — 파일명·동작은 `io.ts` 공용, 백업 시각 기록만 이 화면 몫 */
	function saveBackup() {
		const filename = exportWorkspaceJson();
		workspace.markBackedUp();
		message = `백업 파일(${filename})을 내려받았습니다.`;
	}

	async function openBackup(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		try {
			const { fileName, result } = await importWorkspaceJsonFile(file);
			message = result.ok
				? `${fileName} 을(를) 불러왔습니다.${result.warning ? ` ${result.warning}` : ''}`
				: result.error;
		} finally {
			// 실패해도(파일 읽기 오류 등) 같은 파일을 다시 고를 수 있도록 항상 입력을 비운다
			input.value = '';
		}
	}

	/** 엑셀 내보내기 — exceljs 동적 로드·파일명 규칙은 `io.ts` 공용 */
	async function exportExcel() {
		busy = true;
		try {
			const filename = await exportWorkspaceExcel({
				records: $state.snapshot(workspace.records),
				scenarios: $state.snapshot(workspace.scenarios),
				base: workspace.base ? $state.snapshot(workspace.base) : null,
				orgName: workspace.orgName,
				headcountBasis: $state.snapshot(workspace.headcountBasis),
				summaryRecords: $state.snapshot(workspace.effective),
				peers: $state.snapshot(workspace.peers)
			});
			message = `엑셀 파일(${filename})을 내려받았습니다.`;
		} catch (err) {
			message = `엑셀 내보내기 실패: ${(err as Error).message}`;
		} finally {
			busy = false;
		}
	}

	function clearThisPc() {
		if (
			!confirm(
				'이 PC 에 저장된 데이터를 모두 지울까요? 되돌릴 수 없습니다.\n\n' +
					'지워지는 것: 모든 기간 레코드 · 동종업계 회사 · 시나리오 · 회사/조직 이름 · 임직원 수 산정 기준 · ' +
					'PDF 읽기 설정 · 리포트 작성자/소속 · 마지막 백업 기록 · 가져오기 되돌리기 저장분.\n' +
					'화면 테마(밝게/어둡게)는 유지됩니다.\n\n' +
					'지운 뒤에는 빈 화면으로 시작합니다. 먼저 백업 파일을 저장하는 것을 권합니다.'
			)
		)
			return;
		workspace.wipeAll();
		message = '이 PC 의 데이터를 모두 지웠습니다. 빈 화면에서 다시 시작하세요.';
	}
</script>

<svelte:head><title>{workspace.pageTitle('설정')}</title></svelte:head>

<div class="flex max-w-[720px] flex-col gap-2 pb-2">
	<span class="text-xs font-semibold tracking-wide text-muted">설정</span>
	<h1 class="text-2xl leading-[1.3] font-bold text-ink">표시 방식과 산정 기준, 백업</h1>
	<p class="text-[15px] text-pretty text-ink-2">
		여기 값은 모든 화면에 함께 적용됩니다. 기간·시나리오·PDF 열 선택은 각 화면 안에서 바꿉니다.
	</p>
</div>

<SettingsSection
	label="01 · 금액 표시 단위"
	title="표와 카드에 쓰는 단위"
	hint="저장값은 항상 원 단위 정수. 표시만 바뀝니다. 차트 축은 자동 축약을 유지합니다."
>
	<div class="flex flex-col gap-4">
		<ChipRadio
			name="amount-unit"
			ariaLabel="금액 표시 단위"
			options={AMOUNT_UNITS}
			bind:value={workspace.amountUnit}
		/>
		<p class="text-[13px] text-muted">
			예: 총 인건비 3,384,000,000원 →
			<span class="tabular">{formatAmount(SAMPLE_HC_COST, workspace.amountUnit)}</span>.
			{workspace.amountUnit === 'auto'
				? '자동 축약은 칸 안에 단위까지 함께 적습니다.'
				: '열 머리글에 단위가 붙습니다.'}
		</p>
	</div>
</SettingsSection>

<SettingsSection
	label="02 · 임직원 수 산정 기준"
	title={headcountBasisLabel(workspace.headcountBasis)}
	hint="HCVA·인당 지표의 분모. 결산서 직원 현황은 기말 인원이라 화면마다 기준을 표기합니다."
>
	<div class="flex flex-col gap-6">
		<div class="flex flex-col gap-2.5">
			<span class="text-[13px] text-muted">산정 방식</span>
			<ChipRadio
				name="headcount-method"
				ariaLabel="임직원 수 산정 방식"
				options={METHOD_OPTIONS}
				bind:value={workspace.headcountBasis.method}
			/>
		</div>
		<div class="flex flex-col gap-1.5">
			<span class="text-[13px] text-muted">총 임직원 수에 포함 — 실무 기준상 셋 다 기본 제외</span>
			<div class="flex flex-col">
				{#each HEADCOUNT_OPTIONAL_KEYS as k (k)}
					<Checkbox
						id={`headcount-include-${k}`}
						label={HEADCOUNT_LABELS[k]}
						bind:checked={workspace.headcountBasis.include[k]}
					/>
				{/each}
			</div>
		</div>
		<p class="text-[13px] text-muted">
			바꾸면 모든 기간의 총원이 다시 계산됩니다. 구분 인원이 없는 기간은 입력한 총원을 그대로
			씁니다.
		</p>
	</div>
</SettingsSection>

<SettingsSection
	label="03 · 화면"
	title="밝게 · 어둡게"
	hint="기본은 기기 설정을 따릅니다. 차트 범주색과 등급색은 두 모드에서 같습니다."
>
	<div class="flex flex-col gap-4">
		<ChipRadio
			name="theme"
			ariaLabel="화면 테마"
			options={THEME_OPTIONS}
			bind:value={workspace.theme}
		/>
		<p class="text-[13px] text-muted">인쇄용 리포트는 항상 밝은 바탕으로 나갑니다.</p>
	</div>
</SettingsSection>

<SettingsSection
	label="04 · 백업 · 데이터"
	title="서버가 없으니 파일이 전부입니다"
	hint="브라우저 사이트 데이터를 지우면 입력한 것도 지워집니다."
	last
>
	<div class="flex flex-col gap-6">
		<dl class="border-t border-line-2">
			<div
				class="grid gap-0.5 border-b border-line py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-0"
			>
				<dt class="text-[15px] text-muted">저장소 사용량</dt>
				<dd class="tabular text-[14px] text-ink">{usedLabel} / 브라우저 한도 약 5 MB</dd>
			</div>
			<div
				class="grid gap-0.5 border-b border-line py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-0"
			>
				<dt class="text-[15px] text-muted">마지막 백업</dt>
				<dd class="text-[15px] text-ink">{backupLabel}</dd>
			</div>
			<div
				class="grid gap-0.5 border-b border-line py-3 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-0"
			>
				<dt class="text-[15px] text-muted">파일에 담기는 것</dt>
				<dd class="text-[15px] text-ink">
					회사 이름 · 모든 기간 레코드 · 시나리오 · 이 화면의 설정. 엑셀로 내보내면 입력값 시트만.
				</dd>
			</div>
		</dl>

		<div class="flex flex-wrap items-center gap-x-6 gap-y-3">
			<button type="button" class="btn h-11 px-5 btn-primary" onclick={saveBackup}
				>백업 파일 저장 (.json)</button
			>
			<label
				class="text-[15px] leading-[1.4] font-medium text-brand underline underline-offset-2 hover:text-brand-hover"
			>
				파일 열기
				<input type="file" accept="application/json,.json" class="sr-only" onchange={openBackup} />
			</label>
			<button
				type="button"
				class="text-[15px] leading-[1.4] font-medium text-brand underline underline-offset-2 hover:text-brand-hover disabled:opacity-50"
				disabled={busy}
				onclick={exportExcel}>{busy ? '내보내는 중…' : '엑셀로 내보내기'}</button
			>
		</div>

		{#if message}
			<p class="text-[13px] text-ink-2" role="status">{message}</p>
		{/if}

		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
			<button
				type="button"
				class="text-[15px] leading-[1.4] font-semibold text-status-critical-ink underline underline-offset-2"
				onclick={clearThisPc}>이 PC 의 데이터 지우기</button
			>
			<span class="text-[13px] text-muted"
				>되돌릴 수 없습니다. 먼저 백업 파일을 저장하세요. 지운 뒤에는 빈 화면으로 시작합니다(샘플이
				필요하면 데이터 화면의 `샘플로 초기화` 를 쓰세요).</span
			>
		</div>
	</div>
</SettingsSection>
