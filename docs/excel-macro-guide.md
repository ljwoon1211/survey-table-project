# 데이터 클리닝 Excel 매크로 가이드

데이터 클리닝용 Semi-Long Excel을 **"시트 간 필터 연동"** 옵션으로 내보내면 `.xlsm`(VBA 매크로 포함) 형식으로 다운로드됩니다. 매크로 덕분에 **어느 시트에서 autofilter를 걸어도 같은 `response_id`만 보이도록 모든 시트가 자동 좁혀집니다**.

## 동작 원리

1. 파일을 열면 `Workbook_SheetCalculate` 이벤트가 활성화됩니다.
2. 사용자가 어느 시트에서든 autofilter를 조작하면 VBA가 그 시트의 **보이는 `response_id` 집합**을 수집합니다.
3. VBA가 나머지 모든 시트의 `response_id` 열에 해당 집합을 **IN 필터**로 적용합니다.
4. 결과: 모든 시트가 동일 응답자만 보이는 상태로 동기화됩니다.

수식이나 헬퍼 컬럼을 쓰지 않아 대용량 데이터에서도 Excel이 멈추지 않습니다.

## 파일 열기

### Windows Excel

1. 다운로드한 `.xlsm` 파일 열기
2. 노란색 보안 경고 바 → **"편집 사용"** → **"콘텐츠 사용"**
3. 아무 시트에서 autofilter 조작 → 다른 시트 자동 좁혀지면 정상

### Mac Excel

Mac은 매크로 사용 파일에 더 엄격합니다.

1. 파일을 `~/Documents` 또는 별도 신뢰 폴더에 저장
2. Excel → **환경설정 → 보안 및 개인정보 보호**
3. **"매크로 보안"** → 매크로 사용 허용
4. 파일 열 때 매크로 허용 대화상자에서 **"매크로 사용"** 클릭

## 매크로 실행 방법

- **ClearAllFilters** (모든 시트의 필터 해제):
  - `Alt+F8` (Mac: `Option+F8`) → `ClearAllFilters` 선택 → **실행**

> **단축키 안내**: `Application.OnKey` 기반 단축키 바인딩이 제공되지만, Mac Excel 16.56 등 일부 버전에서 단축키가 동작하지 않을 수 있습니다. 단축키가 먹지 않으면 `Alt+F8` 방식이나 **빠른 실행 도구 모음(QAT)** 에 매크로 버튼을 추가하는 방식으로 대응하세요.

## 문제 해결

| 증상 | 원인 / 대응 |
|------|-------|
| 필터를 걸어도 다른 시트가 반응 없음 | 매크로 차단됨. "콘텐츠 사용" 재확인 |
| `Alt+F8` 실행도 안 됨 | 파일이 `.xlsx`임. `.xlsm` 재다운로드 필요 |
| 파일 열기 자체가 느림 | 응답/시트 수가 매우 많음. 필요 시 "시트 간 필터 연동" 끄고 다운로드 |
| Mac에서 단축키 무반응 | 정상. `Alt+F8`로 매크로 직접 실행 |

## 내부 구조 (개발자용)

- VBA 소스: [src/assets/vba/sync-filters.bas](../src/assets/vba/sync-filters.bas)
- 템플릿 바이너리: `public/assets/cleaning-export-template.xlsm` — VBA가 import된 빈 xlsm
- Export 파이프라인: [src/lib/analytics/semi-long-excel-export.ts](../src/lib/analytics/semi-long-excel-export.ts)
- xlsm 주입 (JSZip 기반 `vbaProject.bin` 병합): [src/lib/analytics/macro-injection.ts](../src/lib/analytics/macro-injection.ts)
- 템플릿 재생성 절차: [src/assets/vba/README.md](../src/assets/vba/README.md)

시트 간 필터 연동 옵션을 **끄고** 내보내면 매크로 없는 `.xlsx`가 다운로드됩니다 (동기화 기능 없음).
