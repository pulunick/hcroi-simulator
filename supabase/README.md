# Supabase — `hcroi` 스키마

프로토타입 단계에서는 **DB 를 사용하지 않는다** (브라우저 localStorage). 이 폴더는 DB 연동 단계를 위해
스키마를 미리 정의해 둔 것이며, **아직 어느 Supabase 프로젝트에도 적용되지 않았다.**

## 설계 원칙

- 기존 프로젝트의 `public` 스키마를 건드리지 않도록 **전용 스키마 `hcroi`** 를 쓴다.
- 지표(HCROI/HCVA)는 저장하지 않고 입력값만 저장 → 앱의 `src/lib/hcroi` 가 단일 계산 소스.
- 조직(organization) 단위 멀티테넌시 + 멤버 역할(owner/editor/viewer) RLS.
- 이관 시 `pg_dump -n hcroi` 로 스키마만 떼어낼 수 있다.

## 적용 절차 (사람이 직접 실행)

1. 대상 프로젝트 결정 후 링크: `supabase link --project-ref <ref>`
2. `supabase db push` 로 `migrations/20260901000000_hcroi_schema.sql` 적용
3. Supabase 대시보드 → **Project Settings → Data API → Exposed schemas** 에 `hcroi` 추가
   (추가하지 않으면 supabase-js 에서 `.schema('hcroi')` 호출이 거부된다)
4. 클라이언트: `supabase.schema('hcroi').from('fiscal_years')...`

## 앱과의 매핑

| 앱 타입 (`src/lib/hcroi/types.ts`) | 테이블                                         |
| ---------------------------------- | ---------------------------------------------- |
| `YearRecord`                       | `hcroi.fiscal_years`                           |
| `HcCostBreakdown`                  | `fiscal_years.hc_breakdown` (jsonb)            |
| `Scenario` / `ScenarioParams`      | `hcroi.scenarios` (`params` jsonb)             |
| (작업공간)                         | `hcroi.organizations` + `organization_members` |

DB 연동 시 교체할 모듈은 `src/lib/state/workspace.svelte.ts` 하나다 (load/save 를 Supabase 호출로 대체).
