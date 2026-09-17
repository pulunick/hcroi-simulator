import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import vercel from '@sveltejs/adapter-vercel';
import cloudflare from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

/**
 * 배포 대상은 환경변수 하나로 고른다 — Cloudflare Pages(공개판) 는 `HCROI_ADAPTER=cloudflare`,
 * 사내 Vercel 은 기본(값 없음). 파일은 main·product/commercial 양쪽 공통이다.
 * Cloudflare 출력은 `.svelte-kit/cloudflare`, Vercel 출력은 `.vercel/output`.
 */
const adapter = () => (process.env.HCROI_ADAPTER === 'cloudflare' ? cloudflare() : vercel());

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
