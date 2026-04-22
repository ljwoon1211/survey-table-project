'use client';

import { Input } from '@/components/ui/input';
import { convertHtmlImageUrlsToProxy } from '@/lib/image-utils';
import { isEmptyHtml } from '@/lib/utils';
import { Question } from '@/types/survey';

import { NoticeRenderer } from './notice-renderer';
import { TablePreview } from './table-preview';
import { UserDefinedMultiLevelSelectPreview } from './user-defined-multi-level-select';

export function QuestionPreview({ question }: { question: Question }) {
  switch (question.type) {
    case 'text':
      return (
        <Input
          placeholder={question.placeholder || '답변을 입력하세요...'}
          disabled
          className="bg-white"
        />
      );

    case 'textarea':
      return (
        <textarea
          className="w-full resize-none rounded-md border border-gray-200 bg-white p-3"
          rows={3}
          placeholder="답변을 입력하세요..."
          disabled
        />
      );

    case 'radio':
    case 'checkbox':
      return (
        <div className="space-y-2">
          {question.options?.map((option) => (
            <div key={option.id} className="flex items-center space-x-2">
              <input type={question.type} name={question.id} disabled className="text-blue-500" />
              <label className="text-sm text-gray-700">{option.label}</label>
            </div>
          ))}
        </div>
      );

    case 'select':
      return (
        <select disabled className="w-full rounded-md border border-gray-200 bg-white p-3">
          <option>선택하세요...</option>
          {question.options?.map((option) => (
            <option key={option.id}>{option.label}</option>
          ))}
          <option>기타</option>
        </select>
      );

    case 'multiselect':
      return question.selectLevels ? (
        <UserDefinedMultiLevelSelectPreview levels={question.selectLevels} />
      ) : (
        <div className="text-sm text-gray-400">다단계 Select가 설정되지 않았습니다.</div>
      );

    case 'ranking': {
      const positions = Math.max(1, question.rankingConfig?.positions ?? 3);
      const optionsCount = question.options?.length ?? 0;
      const renderPositions = Math.min(positions, Math.max(optionsCount, 1));
      return (
        <div className="space-y-2">
          {Array.from({ length: renderPositions }, (_, i) => i + 1).map((rank) => (
            <div key={rank} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-sm font-medium text-gray-700">{rank}순위</span>
              <select
                disabled
                className="w-full rounded-md border border-gray-200 bg-white p-2 text-sm"
              >
                <option>선택하세요...</option>
                {question.options?.map((o) => (
                  <option key={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    case 'table':
      return question.tableColumns && question.tableRowsData ? (
        <TablePreview
          tableTitle={question.tableTitle}
          columns={question.tableColumns}
          rows={question.tableRowsData}
          tableHeaderGrid={question.tableHeaderGrid}
          className="border-0 shadow-none"
          hideColumnLabels={question.hideColumnLabels}
        />
      ) : (
        <div className="py-4 text-center text-sm text-gray-400">테이블이 구성되지 않았습니다.</div>
      );

    case 'notice':
      return question.noticeContent ? (
        <NoticeRenderer
          content={question.noticeContent}
          requiresAcknowledgment={question.requiresAcknowledgment}
          value={false}
          isTestMode={false}
        />
      ) : (
        <div className="py-4 text-center text-sm text-gray-400">공지사항 내용이 없습니다.</div>
      );

    default:
      return <div className="text-sm text-gray-400">미리보기 준비 중...</div>;
  }
}
