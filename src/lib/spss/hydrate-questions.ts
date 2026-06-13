import type { QuestionVariant } from '@/lib/question';
import { isCodedChoiceType } from '@/types/question-types';
import type { Question } from '@/types/survey';
import { generateAllOptionCodes } from '@/utils/option-code-generator';
import { generateAllCellCodes } from '@/utils/table-cell-code-generator';

/**
 * DB에 strip 저장된 파생 필드(cellCode, exportLabel, optionCode)를 복원한다.
 * SPSS 변수명 생성(generateSPSSColumns) 전에 반드시 거쳐야 한다 —
 * export route와 publish 검증 게이트가 공유.
 *
 * 입출력이 QuestionVariant[] 다 — normalizeQuestions 가 산출한 판별 유니언을 export
 * 파이프라인(generateSPSSColumns)까지 보존한다(이전엔 여기서 flat Question[] 으로
 * 넓혀 유형 정보를 흘렸다). 본문은 strip 파생 필드 복원이라 평면 접근이 자연스럽고,
 * tableRowsData/options 만 같은 타입으로 교체하므로 variant 형태가 유지된다.
 */
export function hydrateQuestionsForSpss(questions: QuestionVariant[]): QuestionVariant[] {
  return questions.map((question): QuestionVariant => {
    let next: Question = question;
    if (question.type === 'table' && question.tableRowsData && question.tableColumns) {
      next = {
        ...next,
        tableRowsData: generateAllCellCodes(
          question.questionCode ?? undefined, question.title, question.tableColumns, question.tableRowsData,
        ),
      };
    }
    // options 발번 게이트는 CODED_CHOICE(radio/checkbox/select/multiselect)다.
    // multiselect 는 variant 어휘상 options 가 없지만(selectLevels 소유), 레거시 오염
    // 데이터(운영 0건)를 위해 평면 뷰로 접근해 거동을 보존한다 — question-types
    // CODED_CHOICE 주석의 긴장. 후속 wave 에서 selectLevels 발번 경로 정리 시 해소.
    const opts = next.options;
    if (opts && isCodedChoiceType(next.type)) {
      // 테이블 분기에서 이미 새 객체가 만들어졌으면 spread 불필요
      if (next === question) next = { ...next };
      next = { ...next, options: generateAllOptionCodes(opts) };
    }
    // next 는 평면 뷰지만 입력이 variant 였고 in-shape 필드(tableRowsData/options)만
    // 교체했으므로 출력도 그 variant 형태를 유지한다. flat Question→QuestionVariant 할당은
    // TS 가 분배 매칭으로 무검증 허용하므로 이 캐스트는 형태를 검증하지 않는 경계 의도 표시다.
    return next as QuestionVariant;
  });
}
