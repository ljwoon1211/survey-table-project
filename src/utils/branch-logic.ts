import { Question, BranchRule } from "@/types/survey";

/**
 * 질문과 응답을 기반으로 적용할 분기 규칙을 찾습니다
 */
export function getBranchRuleForResponse(
  question: Question,
  response: unknown
): BranchRule | null {
  if (!response) return null;

  switch (question.type) {
    case "radio":
      return getBranchRuleForRadio(question, response);
    case "checkbox":
      return getBranchRuleForCheckbox(question, response);
    case "select":
      return getBranchRuleForSelect(question, response);
    case "table":
      return getBranchRuleForTable(question, response);
    default:
      return null;
  }
}

/**
 * 라디오 버튼 응답의 분기 규칙 찾기
 */
function getBranchRuleForRadio(question: Question, response: unknown): BranchRule | null {
  if (!question.options) return null;

  // 응답이 객체인 경우 (기타 옵션)
  const selectedValue =
    typeof response === "object" && response !== null && "selectedValue" in response
      ? (response as { selectedValue: string }).selectedValue
      : response;

  // 선택된 값과 일치하는 옵션의 branchRule 찾기
  const selectedOption = question.options.find((opt) => opt.value === selectedValue);
  return selectedOption?.branchRule || null;
}

/**
 * 체크박스 응답의 분기 규칙 찾기
 * 여러 옵션이 선택된 경우 첫 번째 branchRule을 우선 적용
 */
function getBranchRuleForCheckbox(question: Question, response: unknown): BranchRule | null {
  if (!question.options || !Array.isArray(response)) return null;

  // 체크된 값들 추출
  const checkedValues = response.map((val: unknown) =>
    typeof val === "object" && val !== null && "selectedValue" in val
      ? (val as { selectedValue: string }).selectedValue
      : val
  );

  // 체크된 옵션 중 branchRule이 있는 첫 번째 옵션 찾기
  for (const option of question.options) {
    if (checkedValues.includes(option.value) && option.branchRule) {
      return option.branchRule;
    }
  }

  return null;
}

/**
 * 셀렉트 응답의 분기 규칙 찾기
 */
function getBranchRuleForSelect(question: Question, response: unknown): BranchRule | null {
  if (!question.options) return null;

  const selectedValue =
    typeof response === "object" && response !== null && "selectedValue" in response
      ? (response as { selectedValue: string }).selectedValue
      : response;

  const selectedOption = question.options.find((opt) => opt.value === selectedValue);
  return selectedOption?.branchRule || null;
}

/**
 * 테이블 응답의 분기 규칙 찾기
 * 테이블의 각 셀에서 선택된 값의 branchRule 확인
 */
function getBranchRuleForTable(question: Question, response: unknown): BranchRule | null {
  if (!question.tableRowsData || typeof response !== "object" || response === null) return null;

  // 테이블 응답은 { rowId: { cellId: value } } 형태
  const tableResponse = response as Record<string, Record<string, unknown>>;

  for (const row of question.tableRowsData) {
    const rowResponse = tableResponse[row.id];
    if (!rowResponse) continue;

    for (const cell of row.cells) {
      const cellValue = rowResponse[cell.id];
      if (!cellValue) continue;

      // Select 타입 셀 처리
      if (cell.type === "select" && cell.selectOptions) {
        const selectedOption = cell.selectOptions.find((opt) => opt.value === cellValue);
        if (selectedOption?.branchRule) {
          return selectedOption.branchRule;
        }
      }

      // Radio 타입 셀 처리
      if (cell.type === "radio" && cell.radioOptions) {
        const selectedValue =
          typeof cellValue === "object" &&
          cellValue !== null &&
          "selectedValue" in cellValue
            ? (cellValue as { selectedValue: string }).selectedValue
            : cellValue;

        const selectedOption = cell.radioOptions.find((opt) => opt.value === selectedValue);
        if (selectedOption?.branchRule) {
          return selectedOption.branchRule;
        }
      }

      // Checkbox 타입 셀 처리 (첫 번째 체크된 옵션의 branchRule 사용)
      if (cell.type === "checkbox" && cell.checkboxOptions && Array.isArray(cellValue)) {
        const checkedValues = cellValue.map((val: unknown) =>
          typeof val === "object" && val !== null && "selectedValue" in val
            ? (val as { selectedValue: string }).selectedValue
            : val
        );

        for (const option of cell.checkboxOptions) {
          if (checkedValues.includes(option.value) && option.branchRule) {
            return option.branchRule;
          }
        }
      }
    }
  }

  return null;
}

/**
 * 질문 ID로 질문 배열에서 인덱스 찾기
 */
export function findQuestionIndexById(questions: Question[], questionId: string): number {
  return questions.findIndex((q) => q.id === questionId);
}

/**
 * 다음 질문 인덱스 결정 (분기 규칙 고려)
 * @returns 다음 질문 인덱스, 또는 -1 (설문 종료)
 */
export function getNextQuestionIndex(
  questions: Question[],
  currentIndex: number,
  currentResponse: unknown
): number {
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return -1;

  // 분기 규칙 확인
  const branchRule = getBranchRuleForResponse(currentQuestion, currentResponse);

  if (branchRule) {
    if (branchRule.action === "end") {
      // 설문 종료
      return -1;
    } else if (branchRule.action === "goto" && branchRule.targetQuestionId) {
      // 특정 질문으로 이동
      const targetIndex = findQuestionIndexById(questions, branchRule.targetQuestionId);
      return targetIndex !== -1 ? targetIndex : currentIndex + 1;
    }
  }

  // 분기 규칙이 없으면 순차적으로 다음 질문
  return currentIndex + 1 < questions.length ? currentIndex + 1 : -1;
}

/**
 * 질문 번호를 ID로 변환 (예: 10번 → question-10)
 */
export function questionNumberToId(questionNumber: number): string {
  return `question-${questionNumber}`;
}

/**
 * 질문 ID를 번호로 변환 (예: question-10 → 10)
 */
export function questionIdToNumber(questionId: string): number | null {
  const match = questionId.match(/question-(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
