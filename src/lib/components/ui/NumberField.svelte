<script lang="ts">
	import { formatAmount, formatInt, type AmountUnit } from '$lib/hcroi/format';

	interface Props {
		label: string;
		/** 숫자 값 (원 또는 명). 양방향 바인딩 */
		value: number;
		/** 접미 단위 표기 */
		unit?: string;
		/** 입력칸 아래에 축약 금액(억/만) 힌트 표시 */
		krwHint?: boolean;
		/** 힌트에 쓸 표시 단위 (화면이 `hintAmountUnit(workspace.amountUnit)` 을 넘긴다). 값 자체는 언제나 원 */
		hintUnit?: AmountUnit;
		/** 정수만 허용 */
		integer?: boolean;
		/**
		 * 이 값보다 작으면 **오류로 표시**한다 (테두리 + `aria-invalid`).
		 * 입력값을 말없이 끌어올리지 않는다 — 0 을 넣었는데 1 이 저장되면 화면과 표가 어긋난다(2026-09-15).
		 * 실제 판정 문구는 코어 `validateRecord` 가 낸다.
		 */
		min?: number;
		readonly?: boolean;
		help?: string;
		error?: string | null;
		/** 바깥(검증)에서 이 칸이 틀렸다고 알려 줄 때 — 테두리만 붉게, 문구는 패널 상단에서 보여 준다 */
		invalid?: boolean;
	}

	let {
		label,
		value = $bindable(0),
		unit = '원',
		krwHint = unit === '원',
		hintUnit = 'auto',
		integer = true,
		min,
		readonly = false,
		help,
		error = null,
		invalid = false
	}: Props = $props();

	const id = $props.id();
	let focused = $state(false);
	let text = $state(formatInt(value));

	// 외부에서 값이 바뀌면(연도 전환 등) 포커스가 없을 때만 표시 텍스트를 갱신
	$effect(() => {
		const v = value;
		if (!focused) text = formatInt(v);
	});

	function parse(raw: string): number | null {
		const cleaned = raw.replace(/[^\d.-]/g, '');
		if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
		const n = Number(cleaned);
		if (!Number.isFinite(n)) return null;
		return integer ? Math.round(n) : n;
	}

	function onInput(e: Event) {
		const raw = (e.currentTarget as HTMLInputElement).value;
		text = raw;
		const n = parse(raw);
		// 적힌 숫자를 그대로 싣는다 (min 으로 올려 치지 않는다) — 범위를 벗어나면 아래에서 오류로 보인다
		if (n !== null) value = n;
	}

	/** 입력값이 허용 범위 아래인가 — 붉은 테두리·aria-invalid 의 근거 */
	const belowMin = $derived(min !== undefined && Number.isFinite(value) && value < min);
	const showInvalid = $derived(!!error || invalid || belowMin);

	function onBlur() {
		focused = false;
		text = formatInt(value);
	}
</script>

<div class="space-y-1.5">
	<label for={id} class="block text-sm font-semibold text-ink-2">{label}</label>
	<div class="relative">
		<input
			{id}
			type="text"
			inputmode={integer ? 'numeric' : 'decimal'}
			class="tabular field-input pr-12 text-right"
			class:opacity-70={readonly}
			class:border-status-critical={showInvalid}
			value={text}
			{readonly}
			aria-invalid={showInvalid ? 'true' : undefined}
			aria-describedby={help || krwHint ? `${id}-help` : undefined}
			onfocus={() => (focused = true)}
			oninput={onInput}
			onblur={onBlur}
		/>
		<span
			class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted"
			>{unit}</span
		>
	</div>
	{#if error}
		<p class="text-sm text-status-critical-ink">{error}</p>
	{:else if krwHint || help}
		<p id="{id}-help" class="text-sm text-muted">
			{#if krwHint}<span class="tabular">= {formatAmount(value, hintUnit)}</span>{/if}
			{#if krwHint && help}<span aria-hidden="true"> · </span>{/if}
			{#if help}{help}{/if}
		</p>
	{/if}
</div>
