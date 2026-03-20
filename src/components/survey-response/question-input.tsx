'use client';

import { useEffect, useMemo, useState } from 'react';

import { InteractiveTableResponse } from '@/components/survey-builder/interactive-table-response';
import { NoticeRenderer } from '@/components/survey-builder/notice-renderer';
import { UserDefinedMultiLevelSelect } from '@/components/survey-builder/user-defined-multi-level-select';
import { Input } from '@/components/ui/input';
import { Question, QuestionOption } from '@/types/survey';

// 타입 정의
export type OtherChoiceValue = {
  selectedValue: string;
  otherValue?: string;
  hasOther: true;
};

export function isOtherChoiceValue(value: unknown): value is OtherChoiceValue {
  if (!value || typeof value !== 'object') return false;
  return (
    'selectedValue' in value &&
    typeof (value as { selectedValue: unknown }).selectedValue === 'string' &&
    'hasOther' in value &&
    (value as { hasOther: unknown }).hasOther === true
  );
}

export type SingleChoiceResponse = string | null | OtherChoiceValue;
export type MultiChoiceResponse = Array<string | OtherChoiceValue>;

// 질문 유형별 입력 라우터
export function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (question.type) {
    case 'notice': {
      const noticeVal = value && typeof value === 'object' && 'agreed' in (value as Record<string, unknown>)
        ? (value as { agreed: boolean; agreedAt?: string })
        : { agreed: typeof value === 'boolean' ? value : false };
      return (
        <NoticeRenderer
          content={question.noticeContent || ''}
          requiresAcknowledgment={question.requiresAcknowledgment}
          value={noticeVal.agreed}
          onChange={(v) =>
            onChange(v ? { agreed: true, agreedAt: new Date().toISOString() } : { agreed: false })
          }
          isTestMode={false}
        />
      );
    }

    case 'text':
      return (
        <Input
          placeholder={question.placeholder || '답변을 입력하세요...'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full text-base"
        />
      );

    case 'textarea':
      return (
        <textarea
          className="w-full resize-none rounded-lg border border-gray-300 p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder="답변을 입력하세요..."
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'radio':
      return (
        <RadioQuestion
          question={question}
          value={(value ?? null) as SingleChoiceResponse}
          onChange={onChange}
        />
      );

    case 'checkbox':
      return (
        <CheckboxQuestion
          question={question}
          value={value as MultiChoiceResponse | unknown}
          onChange={onChange}
        />
      );

    case 'select':
      return (
        <SelectQuestion
          question={question}
          value={(value ?? '') as SingleChoiceResponse}
          onChange={onChange}
        />
      );

    case 'multiselect':
      return question.selectLevels ? (
        <UserDefinedMultiLevelSelect
          levels={question.selectLevels}
          values={Array.isArray(value) ? (value as string[]) : []}
          onChange={(v) => onChange(v)}
          className="w-full"
        />
      ) : (
        <div className="py-4 text-center text-gray-500">다단계 선택이 구성되지 않았습니다.</div>
      );

    case 'table':
      return question.tableColumns && question.tableRowsData ? (
        <InteractiveTableResponse
          questionId={question.id}
          tableTitle={question.tableTitle}
          columns={question.tableColumns}
          rows={question.tableRowsData}
          value={
            typeof value === 'object' && value !== null
              ? (value as Record<string, unknown>)
              : undefined
          }
          onChange={(v) => onChange(v)}
          isTestMode={false}
          className="border-0 shadow-none"
        />
      ) : (
        <div className="py-4 text-center text-gray-500">테이블이 구성되지 않았습니다.</div>
      );

    default:
      return <div className="py-4 text-center text-gray-500">지원하지 않는 질문 유형입니다.</div>;
  }
}

// 단일선택(Radio) 질문 컴포넌트
function RadioQuestion({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: SingleChoiceResponse;
  onChange: (value: SingleChoiceResponse) => void;
}) {
  const [otherInput, setOtherInput] = useState('');

  useEffect(() => {
    if (isOtherChoiceValue(value) && value.otherValue) {
      setOtherInput(value.otherValue);
    }
  }, [value]);

  const handleOptionChange = (optionValue: string, optionId: string) => {
    const isOtherOption = optionId === 'other-option';

    if (isSelected(optionValue)) {
      onChange(null);
      return;
    }

    if (isOtherOption) {
      onChange({
        selectedValue: optionValue,
        otherValue: otherInput,
        hasOther: true,
      });
    } else {
      onChange(optionValue);
    }
  };

  const handleOtherInputChange = (inputValue: string) => {
    setOtherInput(inputValue);
    if (isOtherChoiceValue(value)) {
      onChange({
        ...value,
        otherValue: inputValue,
      });
    }
  };

  const isSelected = (optionValue: string) => {
    if (isOtherChoiceValue(value)) {
      return value.selectedValue === optionValue;
    }
    return value === optionValue;
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option: QuestionOption) => (
        <div key={option.id} className="space-y-2">
          <div className="flex items-center space-x-3">
            <input
              type="radio"
              id={`${question.id}-${option.id}`}
              name={question.id}
              value={option.value}
              checked={isSelected(option.value)}
              onChange={() => handleOptionChange(option.value, option.id)}
              onClick={() => handleOptionChange(option.value, option.id)}
              className="h-4 w-4 cursor-pointer border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor={`${question.id}-${option.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleOptionChange(option.value, option.id);
              }}
              className="flex-1 cursor-pointer text-base text-gray-700"
            >
              {option.label}
            </label>
          </div>
          {option.id === 'other-option' && isSelected(option.value) && (
            <div className="ml-7">
              <Input
                placeholder="기타 내용을 입력하세요..."
                value={otherInput}
                onChange={(e) => handleOtherInputChange(e.target.value)}
                className="w-full"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 다중선택(Checkbox) 질문 컴포넌트
function CheckboxQuestion({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (value: MultiChoiceResponse) => void;
}) {
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});

  const currentValues = useMemo<MultiChoiceResponse>(
    () => (Array.isArray(value) ? (value as MultiChoiceResponse) : []),
    [value],
  );

  useEffect(() => {
    const newOtherInputs: Record<string, string> = {};
    currentValues.forEach((val) => {
      if (isOtherChoiceValue(val)) {
        newOtherInputs[val.selectedValue] = val.otherValue || '';
      }
    });
    setOtherInputs(newOtherInputs);
  }, [currentValues]);

  const handleOptionChange = (optionValue: string, optionId: string, isChecked: boolean) => {
    let newValues = [...currentValues];
    const isOtherOption = optionId === 'other-option';

    if (isChecked) {
      const maxSelections = question.maxSelections;
      if (maxSelections !== undefined && maxSelections > 0) {
        const currentCount = newValues.length;
        if (currentCount >= maxSelections) {
          return;
        }
      }

      if (isOtherOption) {
        newValues.push({
          selectedValue: optionValue,
          otherValue: otherInputs[optionValue] || '',
          hasOther: true,
        });
      } else {
        newValues.push(optionValue);
      }
    } else {
      newValues = newValues.filter((val) => {
        if (isOtherChoiceValue(val)) {
          return val.selectedValue !== optionValue;
        }
        return val !== optionValue;
      });
    }

    onChange(newValues);
  };

  const handleOtherInputChange = (optionValue: string, inputValue: string) => {
    const newOtherInputs = { ...otherInputs, [optionValue]: inputValue };
    setOtherInputs(newOtherInputs);

    const newValues = currentValues.map((val) => {
      if (isOtherChoiceValue(val) && val.selectedValue === optionValue) {
        return { ...val, otherValue: inputValue };
      }
      return val;
    });

    onChange(newValues);
  };

  const isChecked = (optionValue: string) => {
    return currentValues.some((val) => {
      if (isOtherChoiceValue(val)) {
        return val.selectedValue === optionValue;
      }
      return val === optionValue;
    });
  };

  const currentCount = currentValues.length;
  const maxSelections = question.maxSelections;
  const minSelections = question.minSelections;
  const isMaxReached =
    maxSelections !== undefined && maxSelections > 0 && currentCount >= maxSelections;
  const isMinNotMet =
    minSelections !== undefined && minSelections > 0 && currentCount < minSelections;

  const canSelect = (optionValue: string) => {
    if (isChecked(optionValue)) return true;
    if (isMaxReached) return false;
    return true;
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option: QuestionOption) => {
        const checked = isChecked(option.value);
        const disabled = !canSelect(option.value);

        return (
          <div key={option.id} className="space-y-2">
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`${question.id}-${option.id}`}
                checked={checked}
                disabled={disabled}
                onChange={(e) => handleOptionChange(option.value, option.id, e.target.checked)}
                className={`h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 ${
                  disabled ? 'cursor-not-allowed opacity-50' : ''
                }`}
              />
              <label
                htmlFor={`${question.id}-${option.id}`}
                className={`flex-1 text-base text-gray-700 ${
                  disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                }`}
              >
                {option.label}
              </label>
            </div>
            {option.id === 'other-option' && checked && (
              <div className="ml-7">
                <Input
                  placeholder="기타 내용을 입력하세요..."
                  value={otherInputs[option.value] || ''}
                  onChange={(e) => handleOtherInputChange(option.value, e.target.value)}
                  className="w-full"
                />
              </div>
            )}
          </div>
        );
      })}

      {(maxSelections !== undefined || minSelections !== undefined) && (
        <div className="border-t border-gray-200 pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              {maxSelections !== undefined && maxSelections > 0
                ? `${currentCount}/${maxSelections}개 선택됨`
                : `${currentCount}개 선택됨`}
            </span>
            {isMinNotMet && (
              <span className="text-orange-600">최소 {minSelections}개 이상 선택해주세요</span>
            )}
            {isMaxReached && <span className="text-blue-600">최대 선택 개수에 도달했습니다</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// 드롭다운(Select) 질문 컴포넌트
function SelectQuestion({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: SingleChoiceResponse;
  onChange: (value: SingleChoiceResponse) => void;
}) {
  const [otherInput, setOtherInput] = useState('');
  const [selectedValue, setSelectedValue] = useState<string>('');

  useEffect(() => {
    if (isOtherChoiceValue(value)) {
      setSelectedValue(value.selectedValue);
      setOtherInput(value.otherValue || '');
    } else {
      setSelectedValue(value || '');
      setOtherInput('');
    }
  }, [value]);

  const handleSelectChange = (newValue: string) => {
    setSelectedValue(newValue);
    const selectedOption = question.options?.find((opt) => opt.value === newValue);

    if (selectedOption?.id === 'other-option') {
      onChange({
        selectedValue: newValue,
        otherValue: otherInput,
        hasOther: true,
      });
    } else {
      onChange(newValue);
    }
  };

  const handleOtherInputChange = (inputValue: string) => {
    setOtherInput(inputValue);
    if (selectedValue) {
      const selectedOption = question.options?.find((opt) => opt.value === selectedValue);
      if (selectedOption?.id === 'other-option') {
        onChange({
          selectedValue,
          otherValue: inputValue,
          hasOther: true,
        });
      }
    }
  };

  const showOtherInput = () => {
    if (!selectedValue) return false;
    const selectedOption = question.options?.find((opt) => opt.value === selectedValue);
    return selectedOption?.id === 'other-option';
  };

  return (
    <div className="space-y-3">
      <select
        value={selectedValue}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 p-3 text-base focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
      >
        <option value="">선택하세요...</option>
        {question.options?.map((option: QuestionOption) => (
          <option key={option.id} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {showOtherInput() && (
        <div>
          <Input
            placeholder="기타 내용을 입력하세요..."
            value={otherInput}
            onChange={(e) => handleOtherInputChange(e.target.value)}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
