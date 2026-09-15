# 브랜치 전략 — 사내 버전(main)과 상용 버전(product/commercial)

> 2026-09-10 결정. 인사담당자의 수정·개선 요청은 **main** 에서 계속 진행하고, 판매용 제품은 **product/commercial** 에서 만든다.
> 핵심 기술은 전부 main 에서 태어나 상용 브랜치로 흘러간다. 반대 방향은 없다.

## 1. 브랜치 두 개, 방향 하나

> **2026-09-15 개정**: 공개판 UI(브랜드 토큰·다크모드·설정·리포트·앱 헤더)는 사내 도구에도 그대로 쓰기로 해서 product → main 을 **한 번** 역머지했다. 이후 두 브랜치의 차이는 `/intro` 소개 페이지(+소개 링크)와 헤더 워드마크(main 은 회사 이름이 그 자리)뿐이다. 이후 UI 개선도 main 에서 하고 product 로 머지한다 — 아래 "방향 하나"는 그 뜻으로 읽는다. 차이는 파일 삭제가 아니라 `src/lib/site-config.ts` 의 `SITE_ENABLED` 한 줄(main false / product true)로 둔다 — 삭제하면 머지 때 product 쪽도 지워지므로.

```
main ────●────●────●────●────●────●──▶   사내 도구. 인사담당자 피드백·코어 개선·버그 수정
          \         \         \
product/   ●────●────●────●────●────●──▶  상용 제품. 작업공간·라이선스·리포트·마케팅·설치형
commercial   (merge main)  (merge main)
```

- **main → product/commercial: 정기 머지.** 세션 시작마다, 그리고 main 에 코어 변경이 들어간 직후 `git merge main`
- **product/commercial → main: 없다.** 상용 전용 코드가 사내 버전으로 새지 않는다. 상용 작업 중 발견한 코어 버그는 **main 에서 고치고** 머지로 받는다
- 두 브랜치 모두 원격 `pulunick/hcroi-simulator` 에 push (저장소 분리 전까지). 저장소가 분리되면 §5

## 2. 어디를 어느 브랜치에서 고치는가

| 영역                                                                  | main 에서만                                           | product/commercial 에서만                                                     |
| --------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/lib/hcroi/**` (수식·시나리오·인사이트·기간·합산·엑셀·PDF·format) | ✓ **코어. 상용 브랜치에서 절대 직접 수정하지 않는다** |                                                                               |
| `src/lib/state/workspace.svelte.ts`                                   | ✓ 단일 작업공간 로직                                  | 감싸는 계층만(`src/lib/state/workspaces.svelte.ts` 처럼 **새 파일**)          |
| `src/lib/components/{charts,ui,data}/**`                              | ✓                                                     | 새 컴포넌트는 `src/lib/components/product/**` 에                              |
| `src/routes/{+page,simulator,data,guide}`                             | ✓                                                     | 최소 수정. 새 화면은 새 경로(`/home`, `/report`, `/settings`, `/(marketing)`) |
| `src/routes/+layout.svelte`                                           | ✓                                                     | 내비게이션 항목 추가만. 로직은 새 컴포넌트로 빼서 import 한 줄                |
| `src/lib/license/**`, `src/lib/report/**`, `src/routes/api/**`        |                                                       | ✓ 상용 전용                                                                   |
| `docs/spec.md`, `docs/user-guide.md`, `docs/decision-log.md`          | ✓                                                     | 상용 전용 문서는 `docs/product/**` 에 따로                                    |
| `docs/plans/commercial-product.md`, `docs/plans/branch-strategy.md`   | 이 문서는 main 에도 둔다(공유 규칙)                   | 상용 기획·로드맵 갱신                                                         |
| `.claude/brain.md`                                                    | ✓ (도메인 규칙)                                       | §12 "상용" 절만 이 브랜치가 추가·관리                                         |
| `.claude/state.md`                                                    | main 진행 상황                                        | **머지 시 우리 것 유지**(§3). 상용 진행 상황은 이 브랜치 버전에               |
| `package.json` 의존성                                                 | 코어에 필요한 것                                      | 상용 전용(tauri 등)은 여기서. 충돌 시 양쪽 합집합                             |

원칙 한 줄: **상용 브랜치는 코어를 "쓰기만" 하고 "고치지 않는다."** 코어를 고쳐야 하면 main 으로 가서 고치고, 테스트 통과 후 머지로 받는다. 이 규칙만 지키면 `src/lib/hcroi/**` 는 머지 충돌이 나지 않는다.

## 3. 충돌이 예상되는 파일과 처리

| 파일                        | 왜 충돌하나            | 처리                                                                                                  |
| --------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `.claude/state.md`          | 양쪽이 매 세션 갱신    | `.gitattributes` 에 `merge=ours` → 머지 때 상용 브랜치 버전 유지. main 의 진행 상황은 필요하면 읽기만 |
| `.claude/brain.md`          | 가끔                   | 수동 병합. main 의 §1–§11 은 그대로 받고, §12(상용) 만 이 브랜치가 소유                               |
| `CLAUDE.md`                 | 드묾                   | 수동 병합. 상용 규칙은 맨 아래 "상용 브랜치" 절 하나에만                                              |
| `src/routes/+layout.svelte` | 내비게이션             | 상용 쪽 변경을 import 한 줄로 최소화                                                                  |
| `workspace.svelte.ts`       | main 이 필드 추가할 때 | 상용 브랜치는 이 파일을 감싸기만 하므로 보통 자동 병합                                                |
| `package-lock.json`         | 의존성 추가            | 충돌 시 `git checkout --theirs package-lock.json && npm install` 후 재확인                            |

`merge=ours` 드라이버는 로컬 설정이 있어야 동작한다(한 번만):

```sh
git config merge.ours.driver true
```

## 4. 세션 루틴

**상용 브랜치에서 작업 시작할 때**

```sh
git checkout product/commercial
git fetch origin
git merge main            # 코어 최신화. 충돌은 §3
npm test && npm run check # 코어 머지가 상용 코드를 깨지 않았는지
```

**main 에서 코어를 고쳤을 때** — 평소 절차 그대로(테스트 → 커밋 → push). 상용 브랜치는 다음 시작 때 받는다. 급하면 바로 위 루틴.

**push** — 두 브랜치 모두 `gh auth switch --user pulunick` 후 push, 끝나면 회사 계정 복귀(brain §1). `git push -u origin product/commercial` 은 첫 1회.

**wrap-up 스킬**은 어느 브랜치에서든 그대로. 마지막 `git status -sb` 확인만 `## product/commercial...origin/product/commercial` 로 읽는다.

## 5. 저장소를 분리하게 되면

상용 코드(라이선스·결제)를 public 에 두지 않기로 하면:

```
public  pulunick/hcroi-simulator        main  ← 사내 도구 + 코어 (지금과 같음)
private pulunick/hcroi-pro (가칭)       main  ← product/commercial 을 그대로 옮긴 것
                                        remote "core" = public 저장소
```

- private 쪽에서 `git remote add core https://github.com/pulunick/hcroi-simulator.git` → `git fetch core && git merge core/main`. 흐름은 §1 과 동일하고 브랜치 이름만 저장소 이름으로 바뀐다
- 분리 뒤 public 의 `product/commercial` 브랜치는 삭제(이력은 private 에 있음)
- 히스토리가 이어지므로 이후 코어 머지도 충돌 없이 된다. **분리 전에 이 브랜치를 squash 하지 말 것**

## 6. 하지 않는 것

- product 에서 main 으로 cherry-pick·머지 (코어 수정을 상용에서 먼저 하는 습관이 생긴다)
- 코어를 별도 npm 패키지로 분리 (1인 개발에 릴리스 절차만 늘어난다. 저장소 분리 후에도 git remote 머지로 충분)
- rebase 로 product 를 main 위에 다시 얹기 (push 된 브랜치 이력이 바뀐다. merge 만 쓴다)
