# 응답 라이프사이클 정책 + KPI 재정의 + A2 차트 과거 탐색

작성일: 2026-04-30
상위 작업: 슬라이스 1 (현황 콘솔 / Fieldwork report) 정책 보강

## Context

슬라이스 1을 마무리하면서 운영 의미가 직관적이지 않은 부분이 드러났다.

- **KPI "Total"의 의미가 모호하다.** 현재 정책은 "응답을 시작한 사람"(첫 답 저장 시점)이라 in_progress가 Total에 포함된다. 24h cron이 돌기 전엔 KPI 분모가 진동하고, 운영자 입장에선 "끝까지 안 한 사람을 Total에 넣는 게 맞나?" 의문이 든다.
- **이탈 시점이 24h이라 "지금 이 순간 응답 중인 사람"이 어디에도 안 보인다.** 운영자가 일상적으로 묻는 "지금 N명 응답 중?"에 답할 KPI가 없다.
- **drop으로 전환된 응답에 다시 들어와도 새 응답으로 잡힌다.** 사용자가 잠시 끊겼다가 같은 브라우저에서 이어 쓰고 싶을 때 이중 카운트가 발생한다.
- **A2 일자별 차트가 마지막 7일만 보여주는데 그 이전 데이터를 볼 방법이 없다.** "지난 주 / 그 전 주 비교"가 운영자의 일상 관심사인데 막혀 있다.

본 spec은 4갈래 정책을 재정비하고 KPI·차트 UI를 그에 맞게 조정한다.

## 결정

### 1. 응답 시작 정의 — 변경 없음

첫 답 저장 시점에 row INSERT (T4 `createResponseWithFirstAnswer`). 진입만 하고 답 0건 이탈은 KPI에 포함되지 않는다. 이 정책은 슬라이스 1에서 이미 도입돼 있고 이번에도 유지.

### 2. 이탈 트리거 — 24h cron 유지 + KPI에 "진행중" 셀 추가

`last_activity_at < now() - interval '24 hours'` 의 stale `in_progress` 응답을 좀비 cron이 `drop`으로 전환하는 정책은 그대로. 추가로 KPI Row에 **"진행중" 셀**을 명시 노출해 운영자에게 실시간 가시성을 준다.

브라우저 닫음 즉시 drop은 `beforeunload` + `sendBeacon`이 모바일 Safari에서 신뢰성이 낮고 새로고침까지 drop으로 잡혀 false drop이 누적되는 risk가 있어 도입하지 않는다.

### 3. 재진입 회복 — localStorage 기반

같은 브라우저에서 drop된 응답을 재진입하면 `in_progress`로 회복하고 답을 이어 쓸 수 있게 한다.

저장소: `localStorage`의 `survey-session:{surveyId}` 키에 `sessionId` 저장. 진입 시 1회 조회 → 매칭 row가 `drop`이면 `in_progress`로 UPDATE + `last_activity_at` 갱신, `in_progress`/`completed`이면 그대로 사용. `completeResponse` 성공 시 localStorage 정리.

다른 디바이스·브라우저에서 들어오면 새 응답으로 잡힌다 (slice 1 정책상 의도된 한계). 후속 슬라이스에서 컨택리스트(p5) 인프라가 들어올 때 `inviteToken` 기반 정식 resume으로 자연스럽게 진화.

Upstash·Vercel KV 등 외부 KV 스토어는 도입하지 않는다. 슬라이스 1엔 localStorage로 충분하고, 후속 단계에서도 Supabase 테이블에 (sessionId, surveyId, expires_at) 매핑을 두면 같은 효과를 얻을 수 있다. 외부 Redis는 latency가 KPI에 직접 영향을 주는 단계에서나 의미 있는 인프라.

### 4. 완료 트리거 — 변경 없음

명시 "제출" 버튼 클릭만 `completed`로 전환. 자동 완료(마지막 페이지 도달 + 답 100%)는 도입 X — 사용자가 의도하지 않은 완료가 KPI를 왜곡한다.

### 5. KPI Total 의미 변경

이전: `total = 모든 status 합계` (in_progress 포함)
변경: `total = completed + screenedOut + quotafulOut + bad + drop` (in_progress 제외)

운영자에게 "Total = 종결된 응답"이라는 직관을 주고, 24h cron 이전의 KPI 진동을 없앤다.

### 6. KPI Row 7셀 + 라벨 한국어화

| 순서 | 라벨 | DB status | 비고 |
|------|------|-----------|------|
| 1 | 전체 | (계산값) | total = 종결 응답 합계 |
| 2 | 진행중 | `in_progress` | delta 자리에 "live" 인디케이터. 클릭 시 향후 B 세션 테이블 drill-down |
| 3 | 완료 | `completed` | |
| 4 | 자격 미달 | `screened_out` | (이전 라벨 "스크린아웃"에서 변경) |
| 5 | 쿼터마감 | `quotaful_out` | 업계 한국어 그대로 |
| 6 | 불성실 | `bad` | 슬라이스 1엔 항상 0건. 후속에서 운영자 수동 플래깅 UI 도입 시 채워짐 |
| 7 | 이탈 | `drop` | rose 색 (mockup 동일) |

레이아웃: `lg:grid-cols-7` (모바일은 `grid-cols-2` / `sm:grid-cols-4`로 wrap).

### 7. A2 일자별 차트 좌우 페이지네이션

day 모드에서 마지막 7일 슬라이스 default. 좌우 화살표(`‹` / `›`) 버튼으로 7일 단위 과거·미래 이동.

URL 상태: `?weekOffset=N` (0 = 최근 7일, 1 = 그 이전 7일, ...). 헤더 중앙에 현재 범위 `MM-DD ~ MM-DD` 표시.

- 첫 응답일 도달 시 `‹` disabled
- `weekOffset === 0`일 때 `›` disabled
- 어댑터(`aggregate-daily.server.ts`)는 day 모드에서 전체 일자 반환 유지. 컴포넌트가 weekOffset에 따라 slice
- hour 모드는 영향 없음

## 구현 영향 파일

신규:
- `src/actions/response-actions.ts` 안에 `resumeOrCreateResponse(surveyId, sessionId)` 신규 server action

수정:
- `src/lib/operations/aggregate-status.ts` — `mapRowsToCounts`에서 total 계산식 변경 (in_progress 제외)
- `src/components/operations/kpi-row.tsx` — CELLS 7개로 재구성, 진행중 셀 + live deltaTone 추가
- `src/components/operations/daily-participation-chart.tsx` — `weekOffset` prop, ‹›버튼, 헤더 범위 표시
- `src/app/admin/surveys/[id]/operations/overview/page.tsx` — searchParams에서 weekOffset 추출 + prop 전달
- `src/app/survey/[id]/page.tsx` — 진입 시 localStorage `survey-session:{surveyId}` 조회 + `resumeOrCreateResponse` 호출. 첫 답 저장 후 localStorage SET. 완료 후 localStorage 정리
- `tests/unit/domains/operations/aggregate-status.test.ts` — total 계산 변경에 따른 expected 갱신

## 검증

1. **KPI Total 의미 변경**: 단위 테스트 — `aggregate-status.test.ts`의 mock rows에서 `in_progress: 10, completed: 30, drop: 5`이면 `total === 35` (이전 정책 45 → 변경 35). 진행중 셀이 10 표시
2. **진행중 셀 live 인디케이터**: 컴포넌트 시각 확인 — value 옆에 작은 펄스 점(`bg-blue-500` + `animate-pulse`) + delta 자리에 "live" 텍스트(`text-blue-600`)
3. **재진입 회복** (수동):
   - 응답 1개 시작(첫 답 입력) → 탭 닫기
   - SQL로 `last_activity_at`을 25h 전으로 backdate + `sweep_stale_sessions()` 실행 → `drop`
   - 같은 브라우저로 같은 설문 재진입 → 토스트 "이전 응답을 이어서 진행합니다" + 응답 row가 `in_progress`로 복귀
   - 완료 → `completed`. localStorage 키 사라짐
4. **A2 weekOffset 페이지네이션**:
   - day 모드 진입 시 `weekOffset=0` (최근 7일)
   - `‹` 클릭 → `?weekOffset=1` URL 변화 + 그 이전 7일 막대 노출
   - 첫 응답일까지 도달 시 `‹` disabled
5. **회귀**: 기존 슬라이스 1 동작 정상(typecheck pass, 91 operations tests pass + 12 SPSS pre-existing failing)

## 후속 슬라이스에 미루는 것

- **컨택리스트(p5) + inviteToken 기반 resume**: localStorage 의존 없는 정식 resume. 다른 디바이스·브라우저에서도 회복
- **불성실 자동 판단 휴리스틱**: 응답시간 임계 / 동일 답 반복 / 일관성 검증. 슬라이스 1엔 도입 안 함
- **불성실 운영자 수동 플래깅 UI**: 응답 단건 편집 화면(p6)에서 "bad 지정" 버튼
- **24h 임계값 설문별 설정**: 짧은 설문은 더 짧은 stale, 긴 설문은 더 긴 stale을 허용
- **Upstash·Vercel KV 마이그레이션**: 트래픽이 Supabase 한계를 압박할 때만 검토
- **자동 완료 (마지막 페이지 + 답 100%)**: 사용자가 의도 안 한 완료가 KPI 왜곡 — 도입 안 함이 정책
