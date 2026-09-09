---
name: wrap-up
description: 세션 마무리 — 문서(state/brain/decision-log/coverage/user-guide) 최신화, 검증(test·check·lint), 공개 저장소 식별자 스캔, dev 서버 종료, 지시 시 커밋·push(계정 전환·복귀). "세션 정리", "마무리", "문서 최신화" 요청 시 사용.
---

# 세션 마무리 (wrap-up)

이 프로젝트의 세션을 닫을 때 아래 순서를 **빠짐없이** 밟는다. 사용자가 "정리하고 마무리", "문서 최신화"라고 하면 이 스킬이다.

## 1. 문서 최신화

1. `.claude/state.md`
   - 상단 "현재 상태" 표: 단계 · `npm test` 개수(파일/테스트) · check · lint · git(마지막 커밋 해시, push 여부, 미커밋 여부) · DB
   - "구현 완료" 목록에 이번 세션 항목 추가
   - "다음 할 일"의 완료 항목 취소선, 새 항목 추가
   - 하단 세션 로그에 `### YYYY-MM-DD — 세션 N` 항목: 한 일 · 발견/수정한 버그 · 검증 결과 · 문서 갱신 목록 · **다음 세션 시작점**(번호 목록)
2. `.claude/brain.md` — 이번 세션에 **결정**된 규칙·가정·범위가 있으면 해당 § 갱신 (진행 상황은 넣지 않는다)
3. `docs/decision-log.md` — 새 결정을 **날짜와 함께** 맨 위에 추가 (brain 과 쌍)
4. `docs/requirements-coverage.md` — 구현 상태 ⏳/✅ 갱신, 새 요구 행 추가
5. `docs/user-guide.md` — 화면·기능·엑셀 구조가 바뀌었으면 해당 § 갱신 (§7 되는 것/안 되는 것 표 포함)
6. `docs/spec.md` — 수식·가정·표기 규칙·화면 표가 바뀌었으면 갱신
7. `CLAUDE.md` — 새 절대 규칙·명령·파일 위치가 생겼으면 한 줄 추가
8. `docs/plans/*.md` — 구현이 끝난 계획서는 상단에 "상태: 완료(날짜)" 표기
9. 전부 `npx prettier --write` (lint 가 prettier check 를 포함한다)

## 2. 검증

```
npm test          # 계산 로직 변경 시 테스트 없이 커밋 금지
npm run check     # 0 errors / 0 warnings
npm run lint      # prettier + eslint
```

브라우저 육안 점검이 필요했던 세션이면 결과(통과 항목·콘솔 에러 수)와 스크립트 위치(스크래치패드 `check-*.mjs`)를 state.md 에 적는다.

## 3. 공개 저장소 위생

커밋 전 반드시 스캔한다. **스캔 패턴(개인 이메일·회사명·회사 계정·타 프로젝트 ref)은 이 저장소에 적지 않는다** — 메모리 `public-repo-hygiene` 의 명령을 그대로 쓴다:

```
git add -A && git diff --cached | grep -n -iE '<메모리의 패턴>'
```

걸리면 커밋하지 않고 사용자에게 알린다. 이미 push 됐으면 amend + `push --force-with-lease` 로 즉시 지운다. `docs/*.pdf` 는 `.gitignore` 로 제외돼 있는지 확인. 샘플 데이터는 가상 수치만.

## 4. dev 서버 종료

```
netstat -ano | grep ":5173" | grep LISTENING   # 5174 도 확인
taskkill //PID <pid> //F
```

## 5. 커밋 · push (사용자가 지시했을 때만)

- 커밋 메시지: `type(scope): 요약` + 본문 bullet, 끝에 `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- push 절차(brain §1): `gh auth switch --user pulunick` → `git push origin main` → **회사 계정으로 복귀**(계정명은 메모리 `gh-accounts-and-push` 참조) → `gh auth status` 로 복귀 확인
- 마지막에 `git status -sb` 가 `## main...origin/main` 이고 작업 트리가 클린한지 확인. state.md 의 git 행에 반영

## 6. 마무리 보고

사용자에게: 이번 세션에 한 것(3~6줄) · 검증 결과 표 · 미커밋/미push 여부 · 다음 세션 시작점. 스크래치패드에만 있는 산출물(생성 스크립트·스크린샷)이 있으면 위치를 적는다.
