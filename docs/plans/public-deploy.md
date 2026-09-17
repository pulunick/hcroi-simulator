# 공개판 배포 계획 — 별도 호스팅 · 검색 노출 · 유입 측정 · 광고

> 상태: **초안 (2026-09-17, main 에서 작성)**. 공개판(`product/commercial`, Headroom)을 지금의 Vercel 프로젝트가 아닌 **별도 호스팅**으로 내보내고, 구글·네이버 검색에 잡히게 하고, 방문자 수를 재고, 필요하면 광고를 붙이기 위한 계획.
> §11 의 답이 나오면 [brain §12](../../.claude/brain.md) 와 [decision-log](../decision-log.md) 에 옮기고 이 문서는 절차서로 남긴다. 기획 배경은 [commercial-product.md](commercial-product.md), 브랜치 규칙은 [branch-strategy.md](branch-strategy.md).

## 0. 한 장 요약

| 항목      | 추천                                                                                                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 호스팅    | **Cloudflare Pages** 에 `product/commercial` 브랜치를 별도 프로젝트로. 무료·대역폭 무제한·상업 이용 허용·한국 엣지. 지금 Vercel 프로젝트(hcroi-simulator.vercel.app)는 **사내판(main) 전용**으로 남긴다                                                      |
| 이유      | Vercel Hobby(무료)는 **비상업 개인 용도만** — 광고를 붙이는 순간 약관 위반이라 Pro(월 $20)가 필요하다. Cloudflare 는 무료로 광고·상업 이용이 된다                                                                                                            |
| 도메인    | 사용자가 구입(`headroom.kr` 계열 우선, 상표·중복 확인). DNS 는 Cloudflare 에 두면 Pages·Analytics 연결이 클릭 한 번                                                                                                                                          |
| 검색 노출 | 색인 대상은 **소개·가이드·설명서 3장만**(`prerender`), 앱 화면은 전부 `noindex`. `robots.txt`·`sitemap.xml` 라우트, 페이지별 title/description, JSON-LD, Search Console + **네이버 서치어드바이저** 등록. 사내판(main)은 `noindex` + robots 전면 차단        |
| 유입 측정 | **쿠키 없는 분석**(Cloudflare Web Analytics 기본, 버튼 클릭 같은 이벤트가 필요하면 Umami Cloud 무료). 파일 내용·입력값은 절대 안 보냄. "서버로 보내는 것 없음" 문구를 "방문 통계 외에는 없음"으로 정정하고 `/privacy` 한 장                                  |
| 광고      | **지금은 보류, 조건부 착수**. HCROI 는 니치라 월 방문 수천 명 이하면 수익이 커피값이고, 인사담당자용 도구의 신뢰를 깎는다. 월 방문자 1,000명이 석 달 이어지면 소개·가이드 페이지 하단에만 검토(AdSense 또는 카카오 AdFit). 앱 화면·리포트 인쇄에는 절대 없음 |
| 코드 변경 | 전부 **main 에서 고치고 product 로 머지**(brain §12). 공개판 분기는 `SITE_ENABLED` 한 줄로, 분석·광고 ID 는 **환경변수**로(공개 저장소에 박지 않는다). 어댑터는 환경변수로 Vercel/Cloudflare 선택                                                            |
| 순서      | M0 결정(§11) → M1 배포 분리 → M2 검색 준비 → M3 유입 측정 → M4 콘텐츠·알리기(지속) → M5 광고(조건부). M1–M3 는 세션 2–3개                                                                                                                                    |

## 1. 지금 상태 (2026-09-17)

- 배포: Vercel 프로젝트 하나, Production Branch = `main`(사내판 빌드, 제목 "HCROI 대시보드"). `@sveltejs/adapter-vercel`, 설정은 `vite.config.ts` 한 곳.
- 공개판: `product/commercial` = main + `SITE_ENABLED=true`. 소개 `/intro` 만 SSR(`intro/+page.ts`), 나머지는 `ssr=false`(localStorage 상태). 공유 메타(og/twitter/canonical)는 `+layout.svelte` 한 곳, 문구는 `site-config.ts`. 폰트 자체 호스팅 완료.
- 검색 관련으로 이미 있는 것: `lang="ko"`, `meta description`(전 페이지 동일 문구), canonical(현재 경로), og 이미지 `hero-dashboard.jpg`(1100×764), 오류 페이지 `noindex`, `static/robots.txt`(**전부 허용** — 사내판도 색인 허용 상태라 고쳐야 함).
- 없는 것: 사이트맵, 페이지별 description, 앱 화면 noindex, 구조화 데이터, 분석 스크립트, 개인정보처리방침, 도메인, 문제 신고 채널(GitHub Issues 뿐 — 인사담당자는 GitHub 계정이 없다).

## 2. 호스팅 분리

### 2.1 선택지

| 안  | 방식                                                                   | 비용                             | 장점                                                                           | 단점                                                                                                    |
| --- | ---------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| A   | 같은 Vercel 계정에 **두 번째 프로젝트**(Production Branch = product)   | 무료(Hobby)                      | 코드 변경 0, 10분이면 끝                                                       | Hobby 는 비상업 용도만 → **광고 불가**. 계정이 지금 어떤 계정인지에 따라 사내판과 얽힘                  |
| B   | **다른 Vercel 계정**(pulunick GitHub 로 가입)에 product 만 import      | 무료(Hobby) / 광고 시 Pro $20/월 | 사내판과 계정 분리, 코드 변경 0                                                | 광고 붙이면 유료. Vercel Analytics 무료 한도 작음                                                       |
| C   | **Cloudflare Pages** + `adapter-cloudflare`                            | **무료**                         | 대역폭 무제한·상업 허용·Web Analytics 내장(쿠키 없음)·한국 엣지·DNS 까지 한 곳 | 어댑터 추가(환경변수 분기), Functions 는 일 10만 요청 한도(우리는 `/intro` 프리렌더로 함수 호출 거의 0) |
| D   | 완전 정적(`adapter-static` + SPA fallback) → GitHub Pages / Netlify 등 | 무료                             | 어디든 올릴 수 있음                                                            | SPA fallback 설정이 호스트마다 다르고 404 처리가 지저분. 이득이 C 보다 없다                             |

### 2.2 추천: C (Cloudflare Pages)

- 광고 가능성을 열어 두면서 무료인 유일한 안. 광고를 끝내 안 붙여도 손해 없음.
- 사내판은 지금 Vercel 그대로. **두 배포가 계정·호스트 수준에서 분리**되어 사내 링크와 공개 링크가 섞이지 않는다.
- B 를 고르면 코드 변경은 없지만, 광고 결정 시 Pro 로 넘어가야 하므로 그때 C 로 옮기는 일이 한 번 더 생긴다.

### 2.3 코드 변경 (C 일 때)

- `vite.config.ts`: 어댑터를 환경변수로 고른다 — `HCROI_ADAPTER=cloudflare` 면 `@sveltejs/adapter-cloudflare`, 아니면 지금처럼 Vercel. **파일은 양쪽 브랜치 동일**(브랜치 차이는 여전히 `SITE_ENABLED` 한 줄).
- `/intro`·`/guide`·`/guide/manual` 은 `ssr = true` 대신 **`prerender = true`**(§4.2) — 빌드 때 HTML 로 굽는다. 그러면 Cloudflare Functions 호출이 거의 없고 검색 봇에도 가장 안전.
- 프리뷰 배포(브랜치 프리뷰 URL)는 `noindex` — Cloudflare 는 `CF_PAGES_BRANCH` 환경변수로 프로덕션 여부를 알 수 있으니 레이아웃에서 프로덕션이 아니면 `<meta name="robots" content="noindex">`. `*.pages.dev` 기본 주소도 도메인 연결 뒤에는 canonical 이 도메인을 가리키게(§4.3).
- 확인 항목: pdf.js worker 자산(`pdfjs-dist` 동적 import) 200, exceljs 다운로드, 폰트 woff2 92개, `?start=` 진입, 다크 모드 첫 렌더. 절차는 `tests/qa/site.mjs` 를 배포 URL 로 돌린다.

### 2.4 절차 (사용자 몫 표시)

1. (사용자) Cloudflare 계정 → Workers & Pages → Create → GitHub `pulunick/hcroi-simulator` 연결, Production branch `product/commercial`, 빌드 `npm run build`, 출력 `.svelte-kit/cloudflare`, 환경변수 `HCROI_ADAPTER=cloudflare` + 분석 ID(§5).
2. (Claude, main) 어댑터 분기 + 프리렌더 + 프리뷰 noindex → test/check/lint → product 로 머지.
3. (사용자) 첫 배포 확인 → 도메인 연결(§3) → 사내 Vercel 프로젝트는 그대로.
4. (Claude) 배포 URL 로 `qa:site` + PDF 가져오기 실측 → state 기록.

## 3. 도메인

- 후보: `headroom.kr` / `headroom.co.kr` / `headroom.app` / `gethreadroom.com` 류. "headroom" 은 흔한 단어라 `.com` 은 없다고 봐야 한다. **한국 인사담당자가 대상이므로 `.kr` 계열이 신뢰감이 있다.**
- 확인: (a) 등록 가능 여부 (b) 특허정보넷 키프리스 상표 검색(소프트웨어 류 9·42) (c) 같은 이름의 국내 HR 서비스 존재 여부. 걸리면 `headroom-hr` 같은 변형.
- 등록처는 어디든 되지만 **DNS 는 Cloudflare 로**(Pages 연결·Analytics·이메일 전달 무료). 비용 연 1–3만 원.
- 도메인 확정 전에도 `*.pages.dev` 로 M1·M2 작업은 진행 가능. 단 **Search Console 등록·색인 요청은 도메인 확정 뒤**에(주소를 바꾸면 처음부터 다시).

## 4. 검색 노출 (SEO)

### 4.1 무엇을 색인시키나

| 경로                                                    | 색인 | 이유                                                                                      |
| ------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `/intro`                                                | O    | 랜딩. 검색 결과의 대표 페이지                                                             |
| `/guide` (산식·가정)                                    | O    | "HCROI 계산식", "HCVA" 같은 정보성 검색의 착지점                                          |
| `/guide/manual` (사용 설명서)                           | O    | 긴 본문·H2 12개 — 콘텐츠 페이지 역할                                                      |
| `/` `/data` `/simulator` `/peers` `/report` `/settings` | X    | 개인 데이터 화면. 봇이 보면 샘플 회사 숫자가 그대로 색인된다. `noindex`                   |
| `/privacy` (신설)                                       | O    | 광고·분석 심사 요건. 짧아도 색인 허용                                                     |
| 오류 페이지                                             | X    | 이미 noindex                                                                              |
| 사내판(main) 전체                                       | X    | `SITE_ENABLED=false` 면 모든 화면 noindex + robots 전면 차단. 지금은 열려 있음 — **버그** |

### 4.2 서버가 그린 HTML 이 있어야 한다

- 구글은 JS 를 렌더하지만 느리고 불안정하며, **네이버는 사실상 JS 렌더를 기대하면 안 된다.** 색인 대상 3장(+privacy)은 상태 의존이 없으므로 `prerender = true` 로 빌드 시 HTML 을 굽는다.
- 주의: `/guide` 는 지금 `workspace.amountUnit`·`headcountBasis` 를 읽어 기본값 표기를 만든다. 프리렌더 시점엔 workspace 가 비어 있으니 **기본 단위(천원)·기본 산정 기준으로 굽고, 클라이언트에서 hydrate 뒤 사용자 설정으로 갱신**되게 한다(지금 구조로도 그렇게 동작하지만 첫 HTML 이 기본값이라는 점을 테스트로 고정). `pageTitle` 도 프리렌더에서는 회사명 없이 제품명.
- `/guide/manual` 은 `docs/user-guide.md` 를 빌드 시 `?raw` 로 읽어 파싱하므로 프리렌더에 적합.

### 4.3 메타·파일

- **`robots.txt` 를 서버 라우트로**(`src/routes/robots.txt/+server.ts`, prerender): `SITE_ENABLED` 면 `Allow: /` + `Disallow` 앱 경로 + `Sitemap:` 줄, 아니면 `Disallow: /`. `static/robots.txt` 삭제.
- **`sitemap.xml` 라우트**(prerender): 색인 대상 4장만, `lastmod` 는 빌드 시각. 사내판은 빈 사이트맵 또는 404.
- **페이지별 `<title>`·description**: 지금은 description 이 전 페이지 같은 문구. `site-config.ts` 에 색인 대상 페이지의 제목·설명을 표로 두고 레이아웃이 경로로 고른다(문구 한 곳 규칙 유지). 제목 형식 `"HCROI 계산식과 등급 기준 — Headroom"`.
- **canonical**: 도메인 확정 뒤 `SITE_ORIGIN` 상수(환경변수)로 절대 URL. `*.pages.dev`·프리뷰에서도 canonical 은 본 도메인. **`/` 의 canonical 은 `/intro`** — 앱 주소를 `/` 로 유지(brain §12)하면서 검색 대표는 소개로 모은다.
- **구조화 데이터**(JSON-LD, `/intro` 만): `SoftwareApplication` — name Headroom, `applicationCategory: BusinessApplication`, `operatingSystem: Web`, `offers.price: 0`, `inLanguage: ko`. FAQ 마크업은 실제 FAQ 절이 생기면.
- **OG 이미지**: 1200×630 을 하나 더 만든다(`static/og.jpg`, 카카오톡·링크드인 규격). `hero-dashboard.jpg` 는 랜딩 히어로로 유지.
- 접근성·성능은 검색 순위 요소: Lighthouse 4개 항목 90+ 를 M2 완료 기준으로. 히어로 이미지 `webp`+`loading=eager`+`fetchpriority=high`, 나머지 lazy.

### 4.4 등록 (사용자 몫)

1. **Google Search Console** — 도메인 속성(DNS TXT). 사이트맵 제출, `/intro`·`/guide`·`/guide/manual` 색인 요청.
2. **네이버 서치어드바이저** — 사이트 등록(HTML 메타 인증 → 레이아웃에 환경변수로 주입), 사이트맵·RSS 없음 제출, 수집 요청. 한국 인사담당자는 네이버 검색 비중이 크다.
3. (선택) 다음(카카오) 검색등록, Bing Webmaster(Search Console 가져오기 한 번).

### 4.5 검색 유입이 실제로 생기려면 — 콘텐츠

랜딩 한 장으로는 "headroom hcroi" 같은 지명 검색만 잡힌다. 유입은 **정보성 검색**에서 온다.

- 노릴 검색어(가설): `HCROI 계산`, `HCROI 뜻`, `인적자본 ROI`, `HCVA`, `인당 인건비 계산`, `인건비 시뮬레이션`, `정원 산정 시뮬레이션`, `DART 인건비 확인`, `사업보고서 직원 현황 인건비`.
- 그릇: `/guide` 아래 **용어·방법 글** 몇 편(예: "HCROI 란 — 계산식·해석·업종별 감", "사업보고서에서 인건비 찾는 법(DART)", "정원 늘리면 영업이익이 어떻게 되나 — 손익분기 인원"). `docs/` md 를 `/guide/manual` 과 같은 방식으로 렌더하면 코드 없이 글만 추가된다(`src/lib/guide/` 재사용, 목록 페이지 하나).
- 샘플 리포트(가상 회사) 이미지·PDF 공개 — "결과가 이렇게 나온다"를 검색 결과에서 바로 보게.
- 문체는 [copy 규칙](../../.claude/brain.md)(인사담당자 말, 개발 용어 금지). 글은 사용자가 쓰거나 Claude 가 초안 → 사용자 검수. **M4, 지속 작업.**
- 초기 유입은 검색보다 **소개**가 빠르다: 인사담당자 커뮤니티(HR 카페·오픈채팅·링크드인·브런치)에 글 한 편. 이건 도구 아닌 사람 일.

## 5. 유입 측정 (Analytics)

### 5.1 원칙

- "귀사 데이터는 귀사 PC 안에만" 문구와 양립해야 한다 → **입력값·파일·회사명은 어떤 경우에도 보내지 않는다.** 보내는 것은 페이지뷰와 이벤트 이름뿐.
- 쿠키를 쓰지 않는 도구를 고르면 동의 배너 없이 시작할 수 있다(광고를 붙이기 전까지).
- ID 는 환경변수(`PUBLIC_ANALYTICS_ID` 등)로, 코드·문서에 박지 않는다(공개 저장소). dev·사내판(`SITE_ENABLED=false`)·프리뷰에서는 스크립트를 넣지 않는다.

### 5.2 도구 비교

| 도구                     | 비용            | 쿠키 | 이벤트 | 비고                                                                             |
| ------------------------ | --------------- | ---- | ------ | -------------------------------------------------------------------------------- |
| Cloudflare Web Analytics | 무료            | 없음 | 없음   | Pages 면 토글 하나. 방문·페이지·리퍼러·국가. **M3 기본**                         |
| Umami Cloud              | 무료 티어       | 없음 | 있음   | 이벤트 몇 개 심을 때. 오픈소스, 상업 이용 가능. 셀프호스팅은 운영 부담이라 안 함 |
| Vercel Web Analytics     | Hobby 소량 한도 | 없음 | Pro 만 | Vercel 을 골랐을 때만                                                            |
| PostHog                  | 무료 티어 넉넉  | 선택 | 있음   | 기능 과다. 세션 리플레이는 입력값이 찍힐 수 있어 **금지**                        |
| GA4                      | 무료            | 있음 | 있음   | 동의 배너·개인정보처리방침 필수. **광고(AdSense) 붙일 때만** 같이 도입           |

추천: **Cloudflare Web Analytics 로 시작**, 시작 경로 클릭 같은 이벤트가 궁금해지면 **Umami** 추가. GA4 는 광고 단계에서.

### 5.3 재고 싶은 것 (이벤트 5개, 값 없음)

| 이벤트         | 언제                            | 알고 싶은 것                   |
| -------------- | ------------------------------- | ------------------------------ |
| `start_pdf`    | 소개 "결산서 PDF 로 시작" 클릭  | 핵심 가치가 먹히나             |
| `start_sample` | "가상 회사 샘플 열어 보기" 클릭 | 구경만 하는 비율               |
| `pdf_applied`  | PDF 카드 확인 → 반영 완료       | 실제로 결산서까지 넣는 사람 수 |
| `excel_import` | 엑셀 가져오기 반영              | 엑셀 경로 사용률               |
| `report_print` | 리포트 인쇄 버튼                | 끝까지 간 사람 수              |

구현: `src/lib/site/analytics.ts` 에 `track(name)` 하나 — `SITE_ENABLED` 이고 ID 가 있을 때만 전송, 아니면 no-op. 호출은 화면 5곳. 페이지뷰는 도구 스크립트가 자동. **파일명·금액·회사명을 인자로 받지 않는 시그니처**(`track(name: EventName)`)로 실수를 막는다.

### 5.4 문구·문서

- 소개 페이지 "서버로 보내는 것: 없음" 셀 → "**방문 통계(어느 화면을 봤는지)만** — 입력한 숫자·파일·회사명은 보내지 않습니다". 설명서 §데이터 보관 절도 같은 문장.
- **`/privacy` 개인정보처리방침** 한 장(신설, 사내판에서는 404): 수집 항목(방문 기록·기기 정보, 쿠키 없음), 도구 이름, 보관 기간, 입력 데이터는 서버로 가지 않는다는 점, 문의 방법. 광고 도입 시 절 추가.
- 면책 한 줄(`/guide` 하단 + 리포트 각주): "계산 결과는 참고용이며 회계·법률 판단을 대신하지 않습니다".

## 6. 광고

### 6.1 현실 체크

- HCROI 는 니치 검색어. 월 방문 수백–수천이면 디스플레이 광고 수익은 **월 수천 원–수만 원**. 도메인 값도 안 나올 수 있다.
- 대상이 인사담당자·회사 PC — 도구에 광고가 붙으면 "믿을 만한가"가 먼저 깎인다. 특히 앱 화면(숫자 입력·리포트)에 광고는 안 된다.
- 그래서 **보류**. 다만 붙일 수 있게 구조는 열어 둔다(§6.3).

### 6.2 착수 조건과 대안

- 조건: **월 순방문자 1,000명이 3개월 연속** + 검색 유입 비중 확인. 그 전엔 트래픽이 심사도 못 넘긴다.
- 대안(먼저 검토): 소개·설명서 하단 "후원(Buy Me a Coffee 류)" 링크 하나 · 기획서 §11 의 컨설턴트 안내 링크(사람이 하는 일에서 돈). 둘 다 신뢰를 깎지 않는다.

### 6.3 붙인다면

- 네트워크: **Google AdSense**(글로벌, 심사 엄격 — 독자 콘텐츠·개인정보처리방침·도메인 소유 필요) 또는 **카카오 AdFit**(국내, 개인 가능, 심사 비교적 빠름). 둘 중 하나만.
- 자리: `/intro` 하단 1칸, `/guide`·`/guide/manual`·용어 글 본문 끝 1칸. **앱 화면·리포트·인쇄·모바일 상단 고정 없음.**
- 필요한 것: 동의 배너(제3자 쿠키), `/privacy` 광고 절, 개인정보처리방침에 광고 사업자 표기, GA4 연동(AdSense 는 GA4 와 붙여야 수익 분석이 된다), 사업소득 신고(개인 가능, 사업자등록은 그때 판단).
- 호스팅: Vercel Hobby 면 **Pro 전환 필수**. Cloudflare 면 그대로.
- 코드: 광고 슬롯 컴포넌트 하나(`src/lib/components/site/AdSlot.svelte`), `PUBLIC_AD_CLIENT` 환경변수 없으면 렌더 안 함. CSP 를 쓰지 않으므로 스크립트 허용 문제 없음.

## 7. 운영·법적

| 항목             | 내용                                                                                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 문제 신고        | GitHub Issues 는 유지하되, 인사담당자용으로 **구글 폼 또는 전용 이메일 하나** 추가(푸터·설정 화면). 이메일은 도메인 메일(Cloudflare Email Routing 무료)로 — 개인 메일 노출 금지 |
| 개인정보처리방침 | §5.4. 분석 도입과 같은 배포에 넣는다                                                                                                                                            |
| 이용 안내·면책   | 별도 약관 페이지는 아직 불필요(무료·계정 없음). 면책 한 줄만(§5.4)                                                                                                              |
| 라이선스 파일    | 사용자 결정 대기(brain §12 e). 공개 사이트에 "소스 코드" 링크가 있으니 M2 전에 정하는 것이 좋다                                                                                 |
| 오류 수집        | Sentry 류는 **보류** — 입력값이 브레드크럼에 섞일 위험. 필요해지면 오류 메시지만 보내는 최소 설정으로                                                                           |
| 가동 확인        | Cloudflare 기본 상태로 충분. 별도 모니터링 없음                                                                                                                                 |
| 백업·데이터      | 변화 없음(브라우저·파일). 서버에 사용자 데이터가 없으므로 유출 사고 표면이 없다 — 이 점을 소개에 계속 강조                                                                      |

## 8. 코드 변경 목록 (전부 main 에서, product 로 머지)

| #   | 변경                                                                                               | 위치                                                               | 단계 |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ---- |
| 1   | 어댑터 환경변수 분기(`HCROI_ADAPTER`)                                                              | `vite.config.ts`, `@sveltejs/adapter-cloudflare` devDep            | M1   |
| 2   | `/intro`·`/guide`·`/guide/manual` `prerender = true`(SSR 대체), 프리렌더 기본값 테스트             | 각 `+page.ts`                                                      | M1   |
| 3   | 프리뷰·사내판 `noindex`, 앱 화면 `noindex`, `/` canonical → `/intro`, `SITE_ORIGIN` 절대 canonical | `+layout.svelte`, `site-config.ts`                                 | M2   |
| 4   | `robots.txt`·`sitemap.xml` 서버 라우트(prerender), `static/robots.txt` 삭제                        | `src/routes/robots.txt/`, `src/routes/sitemap.xml/`                | M2   |
| 5   | 페이지별 title/description 표, JSON-LD(`/intro`), OG 1200×630                                      | `site-config.ts`, `+layout.svelte`, `static/og.jpg`                | M2   |
| 6   | 네이버·구글 소유 확인 메타(환경변수)                                                               | `+layout.svelte`                                                   | M2   |
| 7   | 분석 래퍼 `track()` + 이벤트 5곳 + 스크립트 주입(환경변수)                                         | `src/lib/site/analytics.ts`, 화면 5곳, `app.html` 또는 레이아웃    | M3   |
| 8   | `/privacy` 페이지, 푸터 링크, 소개 "서버로 보내는 것" 문구, 설명서 데이터 보관 절, 면책 한 줄      | `src/routes/privacy/`, `SiteFooter`, `intro`, `docs/user-guide.md` | M3   |
| 9   | 문제 신고 채널(폼/이메일) 링크                                                                     | `SiteFooter`, `/settings`                                          | M3   |
| 10  | 용어·방법 글 렌더(목록 + md)                                                                       | `src/lib/guide/` 확장, `docs/articles/*.md`(가칭)                  | M4   |
| 11  | 광고 슬롯 컴포넌트·동의 배너·GA4                                                                   | `AdSlot.svelte` 등                                                 | M5   |

- 규칙: 코드 작성은 opus/sonnet 서브에이전트, Fable 은 브리핑·검수(brain §12 역할 분담). UI 변경 뒤 Codex 리뷰(한도 있으면 `/code-review`).
- 사내판 영향: 1·2·4 는 사내판에도 적용되지만 동작은 같다(어댑터 기본 Vercel, `/intro` 404 유지, robots 는 전면 차단으로 **오히려 고쳐짐**). 3 의 앱 화면 noindex 도 사내판에 이롭다.
- 문서: user-guide(데이터 보관 절), spec §화면(privacy), requirements-coverage, brain §12(결정 옮김), decision-log.

## 9. 마일스톤

| 단계 | 내용                               | 산출·완료 기준                                                                                         | 예상     |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ | -------- |
| M0   | 결정(§11) + 도메인 구입 + 라이선스 | brain §12 갱신                                                                                         | 사용자   |
| M1   | 배포 분리                          | 공개판이 새 호스트·도메인에서 열리고 `qa:site`·PDF 가져오기 실측 통과. 사내 Vercel 은 main 그대로      | 세션 1   |
| M2   | 검색 준비                          | 색인 4장 프리렌더, robots/sitemap, 메타, JSON-LD, Lighthouse 90+, Search Console·네이버 등록·색인 요청 | 세션 1   |
| M3   | 유입 측정 + 개인정보 문구          | 대시보드에서 방문·이벤트가 보임. `/privacy` 공개. 문제 신고 채널                                       | 세션 0.5 |
| M4   | 콘텐츠·알리기(지속)                | 글 3편 + 샘플 리포트 공개 + 커뮤니티 소개 1회. 4주 뒤 Search Console 노출·클릭 확인                    | 지속     |
| M5   | 광고(조건부)                       | §6.2 조건 충족 시에만                                                                                  | 미정     |

## 10. 비용

| 항목                                         | 연간                                |
| -------------------------------------------- | ----------------------------------- |
| 도메인 `.kr`/`.co.kr`                        | 1–3만 원                            |
| Cloudflare Pages·DNS·Analytics·Email Routing | 0                                   |
| Umami Cloud(무료 티어)                       | 0                                   |
| Vercel(사내판 Hobby)                         | 0                                   |
| (B 안 + 광고 시) Vercel Pro                  | 약 32만 원($20×12)                  |
| 광고 수익(참고)                              | 트래픽 수천/월 기준 월 수천–수만 원 |

## 11. 결정이 필요한 것 (사용자) — **2026-09-17 결정됨**(brain §12·decision-log 참조)

> 결과: 1 = C Cloudflare Pages · 3 = Cloudflare WA + Umami 이벤트 · 4 = 광고 보류 + **후원 링크 오픈** · 5 = canonical → `/intro` · 6 = **개인 Gmail**(환경변수 `PUBLIC_CONTACT_EMAIL` 로만, 저장소 미기재). 남은 것: 2 도메인 · 7 라이선스 · 후원 링크 주소(`PUBLIC_DONATE_URL`).

1. **호스팅**: C Cloudflare Pages(추천) / B 다른 Vercel 계정 / A 같은 계정 두 번째 프로젝트. 광고 가능성을 열어 두면 C.
2. **도메인**: 후보와 구입 시점. 확정 전엔 `*.pages.dev` 로 M1·M2 진행, 등록(§4.4)만 미룬다.
3. **분석 도구**: Cloudflare Web Analytics 만(추천 시작점) / +Umami 이벤트 5개. 둘 다 쿠키 없음.
4. **광고**: 보류(추천) / 조건부 착수(§6.2) / 지금 착수. "지금"이면 호스팅은 C 또는 Vercel Pro 로 고정.
5. **`/` 의 검색 처리**: canonical → `/intro`(추천, 앱 주소 유지) / `/` 를 랜딩으로 바꾸고 앱을 `/app` 으로(brain §12 결정 번복, 링크·`?start=` 전부 손봐야 함).
6. **문제 신고 채널**: 구글 폼 / 도메인 이메일 / GitHub Issues 만.
7. **라이선스 파일**(기존 보류 건) — 소스 코드 링크가 공개 사이트에 있으니 M2 전에.

## 12. 하지 않는 것

- 계정·로그인·서버 저장(Phase 2 규칙 그대로). 분석은 "누가"가 아니라 "몇 명이 어디까지"만.
- 세션 리플레이·히트맵 도구(입력값 노출 위험).
- 앱 화면 SSR/프리렌더(localStorage 상태 — 샘플이 먼저 그려지는 문제, brain §12).
- 다국어·영문 랜딩(대상은 국내 인사담당자).
- 광고를 위해 페이지를 쪼개거나 콘텐츠를 늘리는 일. 글은 검색 의도가 있을 때만.
- 사내판(main)의 검색 노출 — 항상 noindex.
