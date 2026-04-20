# VBA 템플릿 관리

Semi-Long Excel export에 포함되는 VBA 매크로의 **단일 진실 소스**.

## 파일 구성

| 파일 | 역할 |
|------|------|
| `sync-filters.bas` | 시트 간 필터 동기화 VBA 모듈 (표준 모듈) |
| `cleaning-export-template.xlsm` (별도 위치) | 이 VBA를 import한 빈 xlsm 템플릿. export 파이프라인이 이 파일을 fetch하여 `vbaProject.bin`을 주입한다 |

템플릿 바이너리는 `public/assets/cleaning-export-template.xlsm`에 둔다 (브라우저 fetch 접근).

## 매크로 구조

### 표준 모듈 (`SyncFilters`)

`sync-filters.bas`에 정의된 주요 public 프로시저:

- **`SyncFiltersFromSheet(sourceSheet)`** — 소스 시트에서 보이는 `response_id`를 수집해 다른 모든 시트에 IN 필터로 전파. `Workbook_SheetCalculate` 이벤트에서 호출.
- **`ClearAllFilters`** — 모든 시트의 autofilter를 전체 해제.
- **`Auto_Open`** — 파일 열릴 때 자동 실행 (`Application.OnKey` 단축키 바인딩 시도 + 상태표시줄 안내).

Mac 호환: `Scripting.Dictionary` / `CreateObject` 대신 `Collection` 사용.

### ThisWorkbook 모듈

```vba
Private Sub Workbook_SheetCalculate(ByVal Sh As Object)
    If Sh Is Nothing Then Exit Sub
    SyncFiltersFromSheet Sh
End Sub
```

## 템플릿 최초 제작 절차

**Windows Excel 또는 Mac Excel에서 수행** (한 번만):

1. 새 워크북 생성 → 빈 Sheet1 하나만 남김
2. `Alt+F11` (Mac: `Option+Fn+F11`) → VB 편집기
3. **표준 모듈 import**:
   - `File → Import File` → `sync-filters.bas` 선택
   - 모듈 이름이 `SyncFilters`로 들어옴을 확인
4. **ThisWorkbook 모듈에 이벤트 핸들러 수동 추가**:
   - 프로젝트 탐색기에서 `ThisWorkbook` 더블클릭
   - 위의 `Workbook_SheetCalculate` 코드 붙여넣기
5. `파일 → 다른 이름으로 저장` → `Excel 매크로 사용 통합 문서 (*.xlsm)` → 파일명 `cleaning-export-template.xlsm`
6. `public/assets/cleaning-export-template.xlsm`으로 이동
7. Git commit

## `.bas` 수정 후 템플릿 재생성

VBA 로직을 바꿀 때마다:

1. 이 파일(`sync-filters.bas`) 편집
2. 템플릿 `.xlsm` 열기 → VB 편집기 → `SyncFilters` 모듈 우클릭 → `Remove SyncFilters`
3. `File → Import File` → 수정된 `.bas` 재import
4. 저장 후 commit

템플릿 `.xlsm`은 바이너리라 **diff가 불가능**하다. `.bas`가 유일한 리뷰 대상이다.

## Mac 호환 유의사항

- `Scripting.Dictionary` / `CreateObject(...)` 사용 금지 → 이미 준수
- `Application.OnKey` 단축키는 Mac Excel 16.56 등 일부 버전에서 바인딩은 되지만 실제 키 후킹이 안 되는 경우가 있다. 이 경우 사용자는 `Alt+F8`로 매크로를 직접 실행하도록 안내.
- Mac 매크로 보안: `Excel → 환경설정 → 보안 및 개인정보 보호 → 신뢰할 수 있는 위치`에 파일 폴더 추가 필요.
