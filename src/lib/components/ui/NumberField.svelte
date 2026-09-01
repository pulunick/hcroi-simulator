<script lang="ts">
	import { formatInt, formatKrwCompact } from '$lib/hcroi/format';

	interface Props {
		label: string;
		/** 숫자 값 (원 또는 명). 양방향 바인딩 */
		value: number;
		/** 접미 단위 표기 */
		unit?: string;
		/** 입력칸 아래에 축약 금액(억/만) 힌트 표시 */
		krwHint?: boolean;
		/** 정수만 허용 */
		integer?: boolean;
		min?: number;
		readonly?: boolean;
		help?: string;
		error?: string | null;
	}

	let {
		label,
		value = $bindable(0),
		unit = '원',
		krwHint = unit === '원',
		integer = true,
		min,
		readonly = false,
		help,
		error = null
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
		if (n !== null) value = min !== undefined ? Math.max(min, n) : n;
	}

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
			value={text}
			{readonly}
			aria-invalid={error ? 'true' : undefined}
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
			{#if krwHint}<span class="tabular">= {formatKrwCompact(value)}</span>{/if}
			{#if krwHint && help}<span aria-hidden="true"> · </span>{/if}
			{#if help}{help}{/if}
		</p>
	{/if}
</div>
