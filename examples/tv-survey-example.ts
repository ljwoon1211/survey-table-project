/**
 * TV 보유 현황 설문 예시
 * 디지털TV 또는 UHD TV 보유자만 A8번 질문 표시
 */

import { Question, QuestionConditionGroup } from '@/types/survey';

// 질문 17: TV 보유 현황 (테이블)
export const question17_TVOwnership: Question = {
  id: "question-17",
  type: "table",
  title: "귀댁에서 보유하고 있는 TV종류는 어떤 것입니까?",
  description: "해당되는 것을 모두 응답해 주세요. 또 이들 TV는 몇 대를 보유하고 있습니까?",
  required: true,
  order: 17,
  tableTitle: "",
  tableColumns: [
    { id: "col-1", label: "보유 TV종류(√)", width: 200 },
    { id: "col-2", label: "보유하고 있는 TV종류", width: 750 },
    { id: "col-3", label: "보유대수", width: 150 }
  ],
  tableRowsData: [
    {
      id: "row-digital-tv",  // ⭐ 중요: 이 ID를 A8번 조건에서 사용
      label: "디지털 TV",
      height: 60,
      minHeight: 40,
      cells: [
        {
          id: "cell-dtv-check",
          type: "checkbox",
          content: "",
          checkboxOptions: [
            { id: "dtv-own", label: "보유", value: "보유" }
          ]
        },
        {
          id: "cell-dtv-desc",
          type: "text",
          content: "디지털 TV (지상파 디지털 방송 수신 가능)"
        },
        {
          id: "cell-dtv-count",
          type: "input",
          content: "",
          placeholder: "대수 입력",
          inputMaxLength: 3
        }
      ]
    },
    {
      id: "row-uhd-tv",  // ⭐ 중요: 이 ID를 A8번 조건에서 사용
      label: "UHD TV",
      height: 60,
      minHeight: 40,
      cells: [
        {
          id: "cell-uhd-check",
          type: "checkbox",
          content: "",
          checkboxOptions: [
            { id: "uhd-own", label: "보유", value: "보유" }
          ]
        },
        {
          id: "cell-uhd-desc",
          type: "text",
          content: "UHD TV (4K 화질 지원)"
        },
        {
          id: "cell-uhd-count",
          type: "input",
          content: "",
          placeholder: "대수 입력",
          inputMaxLength: 3
        }
      ]
    },
    {
      id: "row-analog-tv",
      label: "아날로그 TV",
      height: 60,
      minHeight: 40,
      cells: [
        {
          id: "cell-analog-check",
          type: "checkbox",
          content: "",
          checkboxOptions: [
            { id: "analog-own", label: "보유", value: "보유" }
          ]
        },
        {
          id: "cell-analog-desc",
          type: "text",
          content: "아날로그 TV (구형 TV)"
        },
        {
          id: "cell-analog-count",
          type: "input",
          content: "",
          placeholder: "대수 입력",
          inputMaxLength: 3
        }
      ]
    }
    // ... 다른 TV 종류들
  ],
  // 검증 규칙: 아날로그 TV만 있는 경우 설문 중단
  tableValidationRules: [
    {
      id: "rule-analog-only",
      type: "exclusive-check",
      description: "아날로그 TV만 있는 경우 설문 중단",
      conditions: {
        checkType: "checkbox",
        rowIds: ["row-analog-tv"],
        cellColumnIndex: 0  // 첫 번째 열(보유 체크박스 열)
      },
      action: "end"
    }
  ]
};

// A8번 질문: 디지털/UHD TV 관련 질문
export const questionA8_DigitalTVSatisfaction: Question = {
  id: "question-a8",
  type: "radio",
  title: "A8. 보유하신 디지털 TV 또는 UHD TV에 대해 얼마나 만족하십니까?",
  description: "가장 자주 사용하는 TV를 기준으로 응답해주세요.",
  required: true,
  order: 18,
  options: [
    { id: "opt-1", label: "매우 만족", value: "very-satisfied" },
    { id: "opt-2", label: "만족", value: "satisfied" },
    { id: "opt-3", label: "보통", value: "neutral" },
    { id: "opt-4", label: "불만족", value: "dissatisfied" },
    { id: "opt-5", label: "매우 불만족", value: "very-dissatisfied" }
  ],
  
  // ⭐⭐⭐ 핵심: 표시 조건 설정
  displayCondition: {
    conditions: [
      {
        id: "cond-has-digital-or-uhd",
        sourceQuestionId: "question-17",  // TV 보유 현황 질문 참조
        conditionType: "table-cell-check",
        tableConditions: {
          rowIds: ["row-digital-tv", "row-uhd-tv"],  // 디지털 TV와 UHD TV 행
          cellColumnIndex: 0,  // 첫 번째 열(보유 체크박스)
          checkType: "any"  // 둘 중 하나라도 체크되면 조건 만족
        },
        logicType: "AND"
      }
    ],
    logicType: "AND"  // 단일 조건이므로 AND
  }
};

/**
 * 동작 방식:
 * 
 * 1. 사용자가 질문 17에서 응답:
 *    - ✅ 디지털 TV 체크 → A8번 질문 표시
 *    - ✅ UHD TV 체크 → A8번 질문 표시
 *    - ✅ 디지털 TV + UHD TV 둘 다 체크 → A8번 질문 표시
 *    - ❌ 디지털/UHD 둘 다 체크 안함 → A8번 질문 건너뛰기
 * 
 * 2. shouldDisplayQuestion 함수가 자동으로 확인:
 *    - 질문 17의 응답에서 row-digital-tv 또는 row-uhd-tv가 체크되었는지 확인
 *    - 하나라도 체크되어 있으면 true 반환 → 질문 표시
 *    - 둘 다 체크 안되어 있으면 false 반환 → 질문 건너뛰기
 */

// 더 복잡한 예시: "디지털 TV와 UHD TV 둘 다" 보유한 경우만 표시
export const questionA9_BothTVComparison: Question = {
  id: "question-a9",
  type: "textarea",
  title: "A9. 디지털 TV와 UHD TV를 모두 보유하고 계십니다. 두 TV의 화질 차이를 체감하십니까?",
  required: false,
  order: 19,
  
  // 디지털 TV "AND" UHD TV 둘 다 체크한 경우만 표시
  displayCondition: {
    conditions: [
      {
        id: "cond-has-both",
        sourceQuestionId: "question-17",
        conditionType: "table-cell-check",
        tableConditions: {
          rowIds: ["row-digital-tv", "row-uhd-tv"],
          cellColumnIndex: 0,
          checkType: "all"  // ⭐ 둘 다 체크되어야 함
        },
        logicType: "AND"
      }
    ],
    logicType: "AND"
  }
};

// 여러 조건 결합 예시: "디지털 TV 보유" OR "별도로 성별이 여성"
export const questionA10_ComplexCondition: Question = {
  id: "question-a10",
  type: "radio",
  title: "A10. 여성 또는 디지털 TV 보유자 대상 질문",
  required: false,
  order: 20,
  options: [
    { id: "opt-yes", label: "예", value: "yes" },
    { id: "opt-no", label: "아니오", value: "no" }
  ],
  
  // 복합 조건: (디지털 TV 보유) OR (성별이 여성)
  displayCondition: {
    conditions: [
      {
        id: "cond-digital-tv",
        sourceQuestionId: "question-17",
        conditionType: "table-cell-check",
        tableConditions: {
          rowIds: ["row-digital-tv"],
          cellColumnIndex: 0,
          checkType: "any"
        },
        logicType: "OR"
      },
      {
        id: "cond-female",
        sourceQuestionId: "question-gender",  // 가정: 성별 질문
        conditionType: "value-match",
        requiredValues: ["여성", "female"],
        logicType: "OR"
      }
    ],
    logicType: "OR"  // ⭐ 둘 중 하나만 만족하면 표시
  }
};

/**
 * 사용 방법:
 * 
 * 1. 설문 빌더에서 직접 설정:
 *    - A8번 질문 편집 → "표시 조건" 탭 → 조건 설정
 * 
 * 2. 프로그래밍 방식:
 *    - addPreparedQuestion(questionA8_DigitalTVSatisfaction)
 * 
 * 3. OTT 설문 생성기 활용:
 *    - generateOTTSurvey() 함수에서 자동 생성 시 displayCondition 포함
 */




