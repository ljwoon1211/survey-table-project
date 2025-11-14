import { 
  Question, 
  BranchRule, 
  TableValidationRule, 
  QuestionCondition,
  QuestionConditionGroup,
  SurveyResponse 
} from "@/types/survey";

/**
 * 질문과 응답을 기반으로 적용할 분기 규칙을 찾습니다
 */
export function getBranchRuleForResponse(
  question: Question,
  response: unknown
): BranchRule | null {
  if (!response) return null;

  // 테이블 질문인 경우 먼저 검증 규칙 확인
  if (question.type === "table") {
    const validationRule = getTableValidationBranchRule(question, response);
    if (validationRule) {
      return validationRule;
    }
  }

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

/**
 * 테이블 검증 규칙 확인
 * 테이블 응답이 특정 검증 규칙을 만족하는지 확인
 */
export function checkTableValidationRule(
  question: Question,
  response: unknown,
  rule: TableValidationRule
): boolean {
  if (!question.tableRowsData || typeof response !== "object" || response === null) {
    return false;
  }

  const tableResponse = response as Record<string, Record<string, unknown>>;
  const { conditions, type } = rule;
  const { rowIds, cellColumnIndex, checkType, expectedValues } = conditions;

  // 체크된 행들을 수집
  const checkedRows: string[] = [];
  
  for (const row of question.tableRowsData) {
    if (!rowIds.includes(row.id)) continue;

    const rowResponse = tableResponse[row.id];
    if (!rowResponse) continue;

    // 특정 열만 확인하거나 모든 셀 확인
    const cellsToCheck = cellColumnIndex !== undefined 
      ? [row.cells[cellColumnIndex]]
      : row.cells;

    for (const cell of cellsToCheck) {
      if (!cell) continue;
      
      const cellValue = rowResponse[cell.id];
      if (!cellValue) continue;

      // 체크 타입에 따라 체크 여부 확인
      let isChecked = false;

      switch (checkType) {
        case 'checkbox':
          // 체크박스: 배열에 값이 있으면 체크됨
          if (Array.isArray(cellValue) && cellValue.length > 0) {
            isChecked = true;
          }
          break;

        case 'radio':
          // 라디오: 값이 있으면 선택됨
          if (cellValue) {
            isChecked = true;
          }
          break;

        case 'select':
          // 셀렉트: 값이 있고, expectedValues가 있으면 그 값과 일치하는지 확인
          if (cellValue) {
            if (expectedValues && expectedValues.length > 0) {
              const selectedValue = typeof cellValue === "object" && cellValue !== null && "optionId" in cellValue
                ? (cellValue as { optionId: string }).optionId
                : cellValue;
              isChecked = expectedValues.includes(selectedValue as string);
            } else {
              isChecked = true;
            }
          }
          break;

        case 'input':
          // 입력: 값이 있고, expectedValues가 있으면 그 값과 일치하는지 확인
          if (cellValue) {
            if (expectedValues && expectedValues.length > 0) {
              isChecked = expectedValues.includes(cellValue as string);
            } else {
              isChecked = (cellValue as string).trim() !== '';
            }
          }
          break;
      }

      if (isChecked && !checkedRows.includes(row.id)) {
        checkedRows.push(row.id);
      }
    }
  }

  // 검증 타입에 따라 조건 확인
  switch (type) {
    case 'exclusive-check':
      // 특정 행만 체크된 경우 (다른 행은 체크 안됨)
      // 모든 행 중에서 rowIds에 지정된 행만 체크되어야 함
      const allCheckedRows: string[] = [];
      for (const row of question.tableRowsData) {
        const rowResponse = tableResponse[row.id];
        if (!rowResponse) continue;

        const cellsToCheck = cellColumnIndex !== undefined 
          ? [row.cells[cellColumnIndex]]
          : row.cells;

        for (const cell of cellsToCheck) {
          if (!cell) continue;
          const cellValue = rowResponse[cell.id];
          
          let isAnyChecked = false;
          if (checkType === 'checkbox' && Array.isArray(cellValue) && cellValue.length > 0) {
            isAnyChecked = true;
          } else if (cellValue && checkType !== 'checkbox') {
            isAnyChecked = true;
          }

          if (isAnyChecked && !allCheckedRows.includes(row.id)) {
            allCheckedRows.push(row.id);
            break;
          }
        }
      }

      // rowIds에 지정된 행들만 체크되고, 다른 행은 체크 안되어야 함
      const isOnlyTargetRowsChecked = 
        allCheckedRows.length > 0 &&
        allCheckedRows.every(id => rowIds.includes(id)) &&
        allCheckedRows.some(id => rowIds.includes(id));
      
      return isOnlyTargetRowsChecked;

    case 'any-of':
      // 여러 행 중 하나라도 체크된 경우
      return checkedRows.length > 0;

    case 'all-of':
      // 특정 행들이 모두 체크된 경우
      return rowIds.every(id => checkedRows.includes(id));

    case 'none-of':
      // 특정 행들이 모두 체크 안된 경우
      return checkedRows.length === 0;

    case 'required-combination':
      // 특정 조합이 체크된 경우 (모든 지정된 행이 체크되어야 함)
      return rowIds.every(id => checkedRows.includes(id));

    default:
      return false;
  }
}

/**
 * 테이블 검증 규칙들을 확인하고 적용할 분기 규칙 반환
 */
export function getTableValidationBranchRule(
  question: Question,
  response: unknown
): BranchRule | null {
  if (!question.tableValidationRules || question.tableValidationRules.length === 0) {
    return null;
  }

  // 모든 검증 규칙을 순서대로 확인
  for (const rule of question.tableValidationRules) {
    if (checkTableValidationRule(question, response, rule)) {
      // 조건을 만족하면 해당 분기 규칙 반환
      return {
        id: rule.id,
        value: 'table-validation',
        action: rule.action,
        targetQuestionId: rule.targetQuestionId,
      };
    }
  }

  return null;
}

/**
 * 질문 표시 조건 확인
 * 이전 응답들을 기반으로 현재 질문을 표시해야 하는지 판단
 */
export function shouldDisplayQuestion(
  question: Question,
  allResponses: Record<string, unknown>,
  allQuestions: Question[]
): boolean {
  // 표시 조건이 없으면 항상 표시
  if (!question.displayCondition) {
    return true;
  }

  const { conditions, logicType } = question.displayCondition;

  // 조건들을 평가
  const results = conditions.map(condition => 
    evaluateQuestionCondition(condition, allResponses, allQuestions)
  );

  // 논리 타입에 따라 결과 결합
  switch (logicType) {
    case 'AND':
      return results.every(result => result);
    case 'OR':
      return results.some(result => result);
    case 'NOT':
      return !results.some(result => result);
    default:
      return true;
  }
}

/**
 * 개별 질문 조건 평가
 */
function evaluateQuestionCondition(
  condition: QuestionCondition,
  allResponses: Record<string, unknown>,
  allQuestions: Question[]
): boolean {
  const sourceResponse = allResponses[condition.sourceQuestionId];
  if (!sourceResponse) {
    return false;
  }

  const sourceQuestion = allQuestions.find(q => q.id === condition.sourceQuestionId);
  if (!sourceQuestion) {
    return false;
  }

  switch (condition.conditionType) {
    case 'value-match':
      return checkValueMatch(sourceResponse, condition.requiredValues || []);

    case 'table-cell-check':
      return checkTableCellCondition(
        sourceQuestion,
        sourceResponse,
        condition.tableConditions
      );

    case 'custom':
      // 커스텀 조건은 확장 가능하도록 남겨둠
      return true;

    default:
      return false;
  }
}

/**
 * 값 일치 확인
 */
function checkValueMatch(response: unknown, requiredValues: string[]): boolean {
  if (requiredValues.length === 0) {
    return false;
  }

  // 단일 값 (radio, select 등)
  if (typeof response === 'string') {
    return requiredValues.includes(response);
  }

  // 객체 형태 (기타 옵션 포함)
  if (typeof response === 'object' && response !== null) {
    if ('selectedValue' in response) {
      return requiredValues.includes((response as { selectedValue: string }).selectedValue);
    }
    if ('optionId' in response) {
      return requiredValues.includes((response as { optionId: string }).optionId);
    }
  }

  // 배열 (checkbox 등)
  if (Array.isArray(response)) {
    return response.some(val => {
      if (typeof val === 'string') {
        return requiredValues.includes(val);
      }
      if (typeof val === 'object' && val !== null) {
        if ('selectedValue' in val) {
          return requiredValues.includes((val as { selectedValue: string }).selectedValue);
        }
        if ('optionId' in val) {
          return requiredValues.includes((val as { optionId: string }).optionId);
        }
      }
      return false;
    });
  }

  return false;
}

/**
 * 테이블 셀 조건 확인
 */
function checkTableCellCondition(
  question: Question,
  response: unknown,
  tableConditions?: {
    rowIds: string[];
    cellColumnIndex?: number;
    checkType: 'any' | 'all' | 'none';
  }
): boolean {
  if (!tableConditions || !question.tableRowsData) {
    return false;
  }

  if (typeof response !== 'object' || response === null) {
    return false;
  }

  const tableResponse = response as Record<string, Record<string, unknown>>;
  const { rowIds, cellColumnIndex, checkType } = tableConditions;

  // 체크된 행들 수집
  const checkedRows: string[] = [];

  for (const row of question.tableRowsData) {
    if (!rowIds.includes(row.id)) continue;

    const rowResponse = tableResponse[row.id];
    if (!rowResponse) continue;

    const cellsToCheck = cellColumnIndex !== undefined
      ? [row.cells[cellColumnIndex]]
      : row.cells;

    for (const cell of cellsToCheck) {
      if (!cell) continue;
      
      const cellValue = rowResponse[cell.id];
      if (!cellValue) continue;

      // 셀 타입에 따라 체크 여부 확인
      let isChecked = false;

      if (cell.type === 'checkbox' && Array.isArray(cellValue) && cellValue.length > 0) {
        isChecked = true;
      } else if (cell.type === 'radio' && cellValue) {
        isChecked = true;
      } else if (cell.type === 'select' && cellValue) {
        isChecked = true;
      } else if (cell.type === 'input' && typeof cellValue === 'string' && cellValue.trim() !== '') {
        isChecked = true;
      }

      if (isChecked && !checkedRows.includes(row.id)) {
        checkedRows.push(row.id);
        break;
      }
    }
  }

  // checkType에 따라 조건 확인
  switch (checkType) {
    case 'any':
      return checkedRows.length > 0;
    case 'all':
      return rowIds.every(id => checkedRows.includes(id));
    case 'none':
      return checkedRows.length === 0;
    default:
      return false;
  }
}
