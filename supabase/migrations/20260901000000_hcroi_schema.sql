-- =============================================================================
-- HCROI & 인건비 시뮬레이터 — 전용 스키마 `hcroi`
--
-- * 기존 프로젝트(public 스키마)와 완전히 분리된 별도 스키마를 사용한다.
-- * 프로토타입 단계에서는 아직 어느 Supabase 프로젝트에도 적용하지 않는다.
--   적용 절차와 Data API 노출 설정은 supabase/README.md 참조.
-- * 이후 다른 클라우드로 이관 시 이 스키마만 pg_dump -n hcroi 로 떼어낼 수 있다.
-- =============================================================================

create schema if not exists hcroi;

-- authenticated 사용자만 스키마에 접근 (anon 은 접근 불가)
grant usage on schema hcroi to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 조직 (회사/사업부 단위 작업공간)
-- -----------------------------------------------------------------------------
create table hcroi.organizations (
	id          uuid primary key default gen_random_uuid(),
	name        text not null check (length(name) between 1 and 100),
	created_by  uuid references auth.users (id) on delete set null,
	created_at  timestamptz not null default now(),
	updated_at  timestamptz not null default now()
);

create type hcroi.member_role as enum ('owner', 'editor', 'viewer');

create table hcroi.organization_members (
	org_id      uuid not null references hcroi.organizations (id) on delete cascade,
	user_id     uuid not null references auth.users (id) on delete cascade,
	role        hcroi.member_role not null default 'viewer',
	created_at  timestamptz not null default now(),
	primary key (org_id, user_id)
);
create index organization_members_user_idx on hcroi.organization_members (user_id);

-- -----------------------------------------------------------------------------
-- 연도별 재무·HR 데이터 (앱의 YearRecord 와 1:1)
--   금액은 원 단위 정수(numeric(18,0)), 인원은 정수
-- -----------------------------------------------------------------------------
create table hcroi.fiscal_years (
	id              uuid primary key default gen_random_uuid(),
	org_id          uuid not null references hcroi.organizations (id) on delete cascade,
	year            smallint not null check (year between 1990 and 2100),
	revenue         numeric(18,0) not null check (revenue >= 0),
	operating_cost  numeric(18,0) not null check (operating_cost >= 0),
	hc_cost         numeric(18,0) not null check (hc_cost >= 0),
	headcount       integer not null check (headcount >= 0),
	-- 총 인건비 세부 내역. null 이면 총액만 관리.
	-- 형식: {"baseSalary":..,"incentives":..,"retirement":..,"statutoryWelfare":..,"otherWelfare":..,"training":..}
	hc_breakdown    jsonb,
	memo            text,
	created_at      timestamptz not null default now(),
	updated_at      timestamptz not null default now(),
	unique (org_id, year),
	constraint hc_cost_within_operating_cost check (hc_cost <= operating_cost)
);

-- 세부 내역이 있으면 합계가 hc_cost 와 일치해야 한다
create or replace function hcroi.check_breakdown_sum()
returns trigger
language plpgsql
as $$
declare
	total numeric;
begin
	if new.hc_breakdown is null then
		return new;
	end if;
	select coalesce(sum((value)::numeric), 0) into total
	from jsonb_each_text(new.hc_breakdown)
	where key in ('baseSalary','incentives','retirement','statutoryWelfare','otherWelfare','training');
	if total <> new.hc_cost then
		raise exception 'hc_breakdown 합계(%)가 hc_cost(%)와 일치하지 않습니다', total, new.hc_cost
			using errcode = 'check_violation';
	end if;
	return new;
end;
$$;

create trigger fiscal_years_breakdown_sum
	before insert or update on hcroi.fiscal_years
	for each row execute function hcroi.check_breakdown_sum();

-- -----------------------------------------------------------------------------
-- 시나리오 (앱의 Scenario 와 1:1, params 는 ScenarioParams JSON)
-- -----------------------------------------------------------------------------
create table hcroi.scenarios (
	id            uuid primary key default gen_random_uuid(),
	org_id        uuid not null references hcroi.organizations (id) on delete cascade,
	base_year_id  uuid references hcroi.fiscal_years (id) on delete set null,
	name          text not null check (length(name) between 1 and 60),
	-- {"headcountMode":"pct|delta","headcountPct":n,"headcountDelta":n,"wageIncreasePct":n,"productivityPct":n,"variableCostRatioPct":n}
	params        jsonb not null,
	sort_order    smallint not null default 0,
	created_by    uuid references auth.users (id) on delete set null,
	created_at    timestamptz not null default now(),
	updated_at    timestamptz not null default now()
);
create index scenarios_org_idx on hcroi.scenarios (org_id, sort_order);

-- updated_at 자동 갱신
create or replace function hcroi.touch_updated_at()
returns trigger language plpgsql as $$
begin
	new.updated_at = now();
	return new;
end;
$$;
create trigger organizations_touch before update on hcroi.organizations
	for each row execute function hcroi.touch_updated_at();
create trigger fiscal_years_touch before update on hcroi.fiscal_years
	for each row execute function hcroi.touch_updated_at();
create trigger scenarios_touch before update on hcroi.scenarios
	for each row execute function hcroi.touch_updated_at();

-- -----------------------------------------------------------------------------
-- RLS — 조직 멤버만 조회, editor 이상만 쓰기, owner 만 조직/멤버 관리
-- -----------------------------------------------------------------------------
create or replace function hcroi.member_role(p_org uuid)
returns hcroi.member_role
language sql
stable
security definer
set search_path = ''
as $$
	select m.role from hcroi.organization_members m
	where m.org_id = p_org and m.user_id = auth.uid()
$$;

create or replace function hcroi.can_edit(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
	select hcroi.member_role(p_org) in ('owner', 'editor')
$$;

create or replace function hcroi.is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
	select hcroi.member_role(p_org) is not null
$$;

alter table hcroi.organizations enable row level security;
alter table hcroi.organization_members enable row level security;
alter table hcroi.fiscal_years enable row level security;
alter table hcroi.scenarios enable row level security;

-- organizations
create policy "org: members can read" on hcroi.organizations
	for select to authenticated using (hcroi.is_member(id));
create policy "org: any user can create" on hcroi.organizations
	for insert to authenticated with check (created_by = auth.uid());
create policy "org: owner can update" on hcroi.organizations
	for update to authenticated using (hcroi.member_role(id) = 'owner');
create policy "org: owner can delete" on hcroi.organizations
	for delete to authenticated using (hcroi.member_role(id) = 'owner');

-- 조직 생성자를 자동으로 owner 로 등록
create or replace function hcroi.add_creator_as_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
	if new.created_by is not null then
		insert into hcroi.organization_members (org_id, user_id, role)
		values (new.id, new.created_by, 'owner')
		on conflict do nothing;
	end if;
	return new;
end;
$$;
create trigger organizations_add_owner after insert on hcroi.organizations
	for each row execute function hcroi.add_creator_as_owner();

-- organization_members
create policy "members: members can read" on hcroi.organization_members
	for select to authenticated using (hcroi.is_member(org_id));
create policy "members: owner can manage" on hcroi.organization_members
	for all to authenticated
	using (hcroi.member_role(org_id) = 'owner')
	with check (hcroi.member_role(org_id) = 'owner');

-- fiscal_years
create policy "years: members can read" on hcroi.fiscal_years
	for select to authenticated using (hcroi.is_member(org_id));
create policy "years: editors can write" on hcroi.fiscal_years
	for all to authenticated
	using (hcroi.can_edit(org_id))
	with check (hcroi.can_edit(org_id));

-- scenarios
create policy "scenarios: members can read" on hcroi.scenarios
	for select to authenticated using (hcroi.is_member(org_id));
create policy "scenarios: editors can write" on hcroi.scenarios
	for all to authenticated
	using (hcroi.can_edit(org_id))
	with check (hcroi.can_edit(org_id));

-- 테이블 권한 (RLS 가 행 단위 제어)
grant select, insert, update, delete on all tables in schema hcroi to authenticated;
grant all on all tables in schema hcroi to service_role;
grant execute on all functions in schema hcroi to authenticated, service_role;
alter default privileges in schema hcroi grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema hcroi grant all on tables to service_role;

comment on schema hcroi is 'HCROI & 인건비 시뮬레이터 전용 스키마 (public 과 분리)';
comment on table hcroi.fiscal_years is '연도별 재무·HR 입력값. HCROI 등 지표는 저장하지 않고 앱에서 재계산한다';
