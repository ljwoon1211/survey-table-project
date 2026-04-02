# Excel Transformer 함수 시그니처 및 responses 사용 패턴

## 함수 시그니처 정리

### 1. generateExcelWorkbook (Legacy 함수)
```typescript
export function generateExcelWorkbook(
  survey: Survey,
  responses: SurveySubmission[],
  options: ExportOptions
): XLSX.WorkBook
```
- **responses 사용**: 메모리에 전부 로드 후 처리

### 2. generateRawDataCombinedWorkbook
```typescript
export function generateRawDataCombinedWorkbook(
  survey: Survey,
  responses: SurveySubmission[]
): XLSX.WorkBook
```
- **responses 사용**: 메모리에 전부 로드 후 처리
- **처리 방식**: `responses.map()` (line 81)으로 모든 응답을 배열로 변환하여 메모리에 올림

### 3. generateRawDataIndividualWorkbook
```typescript
export function generateRawDataIndividualWorkbook(
  survey: Survey,
  responses: SurveySubmission[]
): XLSX.WorkBook
```
- **responses 사용**: 메모리에 전부 로드 후 처리
- **처리 방식**: `responses.forEach()` (line 145)로 각 응답마다 개별 시트 생성

### 4. generateSummaryWorkbook
```typescript
export function generateSummaryWorkbook(
  survey: Survey,
  responses: SurveySubmission[]
): XLSX.WorkBook
```
- **responses 사용**: 메모리에 전부 로드 후 처리
- **처리 방식**: `generateSummaryData(survey, responses)` 호출 (line 251)

---

## Responses 사용 방식 분석

### 모두 배치 처리 (Batch Processing)
모든 함수가 **responses 전체를 메모리에 올려서 처리**합니다:

1. **generateRawDataCombinedWorkbook** (line 81-98)
   - `responses.map()` → 모든 응답 데이터를 메모리의 배열로 변환
   - 각 응답마다 메타데이터 + 응답 데이터 조합
   - **메모리 사용**: O(n) - 응답 수에 비례

2. **generateRawDataIndividualWorkbook** (line 145-238)
   - `responses.forEach()` → 각 응답을 순회하며 처리
   - 반복적으로 처리하지만 여전히 메모리에 전부 로드된 상태
   - **메모리 사용**: O(n)

3. **generateSummaryWorkbook** (line 246-254)
   - `generateSummaryData()` 내부에서 응답 전체를 순회
   - 각 질문별로 모든 응답을 필터링/카운팅 (line 394-402, 437-441 등)
   - **메모리 사용**: O(n × m) - 응답 수 × 질문 수

4. **generateExcelWorkbook** (Legacy, line 16-51)
   - 위 세 함수를 선택적으로 호출
   - 동일한 배치 처리 방식

### 스트리밍 미사용
- **스트리밍 처리 없음**: 모든 responses가 배열로 메모리에 올려짐
- **대용량 데이터 처리 한계**: responses 수가 많으면 메모리 부족 가능
- **실시간 처리 불가**: 모든 데이터가 메모리에 있을 때까지 처리 시작 불가

---

## 성능 특성

| 함수 | 메모리 사용 | 복잡도 | 비고 |
|------|-----------|-------|------|
| generateRawDataCombinedWorkbook | O(n) | O(n) | 응답 수에 비례 |
| generateRawDataIndividualWorkbook | O(n) | O(n) | 응답 수에 비례 |
| generateSummaryWorkbook | O(n×m) | O(n×m) | 응답수×질문수, 요약 통계 계산 |
| generateExcelWorkbook | O(n×m) | O(n×m) | 옵션에 따라 위 함수들 조합 |
