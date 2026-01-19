'use client';

import React, { useState } from 'react';

import { AlertCircle, ChevronDown, ChevronUp, Plus, Trash2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { generateId } from '@/lib/utils';
import { Question, TableValidationRule, TableValidationType } from '@/types/survey';
import { getMergedRowIds, getRowMergeInfo } from '@/utils/table-merge-helpers';

import { TableOptionSelector } from './table-option-selector';

interface TableValidationEditorProps {
  question: Question;
  onUpdate: (rules: TableValidationRule[]) => void;
  allQuestions: Question[];
}

export function TableValidationEditor({
  question,
  onUpdate,
  allQuestions,
}: TableValidationEditorProps) {
  const [rules, setRules] = useState<TableValidationRule[]>(question.tableValidationRules || []);
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());

  const validationTypes: { value: TableValidationType; label: string; description: string }[] = [
    {
      value: 'exclusive-check',
      label: '독점 체크',
      description: '지정한 행만 체크되고 다른 행은 모두 체크 안됨 (예: 아날로그TV만 있는 경우)',
    },
    {
      value: 'any-of',
      label: '하나라도 체크',
      description: '지정한 행 중 최소 1개 이상 체크됨 (예: A 또는 B 중 하나라도 선택)',
    },
    {
      value: 'all-of',
      label: '모두 체크',
      description: '지정한 행이 모두 체크됨 (예: A와 B 모두 선택. 다른 행도 체크 가능)',
    },
    {
      value: 'none-of',
      label: '모두 미체크',
      description: '지정한 행이 모두 체크 안됨 (예: A와 B 둘 다 선택 안함)',
    },
    {
      value: 'required-combination',
      label: '필수 조합',
      description: '지정한 행들이 모두 체크되어야 함 (all-of와 동일)',
    },
  ];

  const addRule = () => {
    const newRule: TableValidationRule = {
      id: generateId(),
      type: 'exclusive-check',
      description: '',
      conditions: {
        checkType: 'checkbox',
        rowIds: [],
        cellColumnIndex: 0,
      },
      action: 'end',
    };
    const updatedRules = [...rules, newRule];
    setRules(updatedRules);
    onUpdate(updatedRules);
    // 새 규칙 추가 시 자동으로 펼치기
    setExpandedRules((prev) => new Set([...prev, newRule.id]));
  };

  const removeRule = (ruleId: string) => {
    const updatedRules = rules.filter((r) => r.id !== ruleId);
    setRules(updatedRules);
    onUpdate(updatedRules);
  };

  const updateRule = (ruleId: string, updates: Partial<TableValidationRule>) => {
    const updatedRules = rules.map((r) => (r.id === ruleId ? { ...r, ...updates } : r));
    setRules(updatedRules);
    onUpdate(updatedRules);
  };

  const toggleRowId = (ruleId: string, rowId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const colIndex = rule.conditions.cellColumnIndex;
    // 병합된 행 ID들 가져오기
    const mergedRowIds = getMergedRowIds(rowId, question.tableRowsData, colIndex);

    const currentRowIds = rule.conditions.rowIds;

    // 병합된 행 중 하나라도 선택되어 있으면 모두 제거, 아니면 모두 추가
    const isAnyMergedRowSelected = mergedRowIds.some((id) => currentRowIds.includes(id));

    let updatedRowIds: string[];
    if (isAnyMergedRowSelected) {
      // 병합된 행들 모두 제거
      updatedRowIds = currentRowIds.filter((id) => !mergedRowIds.includes(id));
    } else {
      // 병합된 행들 모두 추가 (중복 제거)
      updatedRowIds = [...new Set([...currentRowIds, ...mergedRowIds])];
    }

    updateRule(ruleId, {
      conditions: {
        ...rule.conditions,
        rowIds: updatedRowIds,
      },
    });
  };

  const toggleRuleExpanded = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">테이블 검증 규칙</h3>
          <p className="text-sm text-gray-600">
            특정 조건 만족 시 설문 중단 또는 다른 질문으로 이동
          </p>
        </div>
        <Button onClick={addRule} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          규칙 추가
        </Button>
      </div>

      {rules.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-gray-400" />
            <p>검증 규칙이 없습니다. 규칙을 추가해보세요.</p>
          </CardContent>
        </Card>
      )}

      {rules.map((rule, index) => {
        const isExpanded = expandedRules.has(rule.id);

        return (
          <Card key={rule.id} className="border-l-4 border-l-blue-500">
            <Collapsible open={isExpanded} onOpenChange={() => toggleRuleExpanded(rule.id)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer transition-colors hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                      <CardTitle className="text-base">
                        규칙 {index + 1}
                        {rule.description && (
                          <span className="ml-2 text-sm font-normal">- {rule.description}</span>
                        )}
                        {!rule.description && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            ({validationTypes.find((t) => t.value === rule.type)?.label})
                          </span>
                        )}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRule(rule.id);
                        }}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  {/* 규칙 설명 */}
                  <div className="space-y-2">
                    <Label htmlFor={`description-${rule.id}`}>규칙 설명 (선택)</Label>
                    <Input
                      id={`description-${rule.id}`}
                      value={rule.description || ''}
                      onChange={(e) => updateRule(rule.id, { description: e.target.value })}
                      placeholder="예: 아날로그 TV만 있는 경우 설문 중단"
                    />
                  </div>

                  {/* 검증 타입 */}
                  <div className="space-y-2">
                    <Label htmlFor={`type-${rule.id}`}>검증 타입</Label>
                    <select
                      id={`type-${rule.id}`}
                      value={rule.type}
                      onChange={(e) =>
                        updateRule(rule.id, { type: e.target.value as TableValidationType })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      {validationTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label} - {type.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 체크할 행 선택 */}
                  <div className="space-y-2">
                    <Label>체크할 행 선택</Label>
                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3">
                      {question.tableRowsData?.map((row, rowIndex) => {
                        const colIndex = rule.conditions.cellColumnIndex;
                        const mergeInfo = getRowMergeInfo(row.id, question.tableRowsData, colIndex);
                        const isSelected = rule.conditions.rowIds.includes(row.id);
                        const isMergeStart = mergeInfo.mergeStartRowId === row.id;

                        return (
                          <div
                            key={row.id}
                            className={`flex items-center gap-2 ${
                              mergeInfo.isMerged && !isMergeStart ? 'opacity-60' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              id={`row-${rule.id}-${row.id}`}
                              checked={isSelected}
                              onChange={() => toggleRowId(rule.id, row.id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              disabled={mergeInfo.isMerged && !isMergeStart}
                            />
                            <label
                              htmlFor={`row-${rule.id}-${row.id}`}
                              className={`flex-1 cursor-pointer text-sm ${
                                mergeInfo.isMerged && !isMergeStart ? 'cursor-not-allowed' : ''
                              }`}
                            >
                              {row.label}
                              {mergeInfo.isMerged && (
                                <span className="ml-2 text-xs text-blue-600">
                                  {isMergeStart
                                    ? `(행${rowIndex + 1}-${rowIndex + mergeInfo.mergedRowIds.length} 병합)`
                                    : `(병합됨)`}
                                </span>
                              )}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    {rule.conditions.rowIds.length === 0 && (
                      <p className="text-xs text-red-600">최소 1개 이상의 행을 선택해주세요</p>
                    )}
                    {rule.conditions.cellColumnIndex === undefined && (
                      <p className="text-xs text-gray-500">
                        💡 열을 먼저 선택하면 병합된 행 정보가 표시됩니다
                      </p>
                    )}
                  </div>

                  {/* 열 인덱스 (선택) */}
                  <div className="space-y-2">
                    <Label htmlFor={`col-${rule.id}`}>특정 열만 확인 (선택)</Label>
                    <Input
                      id={`col-${rule.id}`}
                      type="number"
                      min="0"
                      max={(question.tableColumns?.length || 1) - 1}
                      value={rule.conditions.cellColumnIndex ?? ''}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          conditions: {
                            ...rule.conditions,
                            cellColumnIndex: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      placeholder="전체 열 확인 (비워두면 모든 열 확인)"
                    />
                    <p className="text-xs text-gray-500">
                      0부터 시작 (0 = 첫 번째 열, 비워두면 모든 열 확인)
                    </p>
                  </div>

                  {/* 체크 타입 */}
                  <div className="space-y-2">
                    <Label htmlFor={`check-type-${rule.id}`}>체크 타입</Label>
                    <select
                      id={`check-type-${rule.id}`}
                      value={rule.conditions.checkType}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          conditions: {
                            ...rule.conditions,
                            checkType: e.target.value as 'checkbox' | 'radio' | 'select' | 'input',
                          },
                        })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="checkbox">체크박스</option>
                      <option value="radio">라디오 버튼</option>
                      <option value="select">드롭다운</option>
                      <option value="input">입력 필드</option>
                    </select>
                  </div>

                  {/* 기대 값 설정 */}
                  {rule.conditions.checkType !== 'checkbox' &&
                    rule.conditions.checkType !== 'radio' &&
                    rule.conditions.checkType !== 'select' && (
                      // input 타입: 직접 입력
                      <div className="space-y-2">
                        <Label htmlFor={`expected-values-${rule.id}`}>
                          기대하는 값들 (선택사항)
                        </Label>
                        <Input
                          id={`expected-values-${rule.id}`}
                          value={(rule.conditions.expectedValues || []).join(', ')}
                          onChange={(e) => {
                            const values = e.target.value
                              .split(',')
                              .map((v) => v.trim())
                              .filter((v) => v);
                            updateRule(rule.id, {
                              conditions: {
                                ...rule.conditions,
                                expectedValues: values.length > 0 ? values : undefined,
                              },
                            });
                          }}
                          placeholder="예: 5, 10, 15 (쉼표로 구분)"
                        />
                        <p className="text-xs text-gray-500">
                          입력 필드에 이 값들 중 하나가 입력되었는지 확인합니다. 비워두면 값이
                          있는지만 확인합니다.
                        </p>
                      </div>
                    )}

                  {/* checkbox/radio/select 타입: 실제 옵션에서 선택 */}
                  {(rule.conditions.checkType === 'checkbox' ||
                    rule.conditions.checkType === 'radio' ||
                    rule.conditions.checkType === 'select') &&
                    rule.conditions.rowIds.length > 0 &&
                    rule.conditions.cellColumnIndex !== undefined && (
                      <TableOptionSelector
                        question={question}
                        rowIds={rule.conditions.rowIds}
                        colIndex={rule.conditions.cellColumnIndex}
                        expectedValues={rule.conditions.expectedValues}
                        onChange={(values) => {
                          updateRule(rule.id, {
                            conditions: {
                              ...rule.conditions,
                              expectedValues: values,
                            },
                          });
                        }}
                        helpText={
                          rule.conditions.checkType === 'checkbox'
                            ? '선택한 옵션들 중 하나라도 체크되었는지 확인합니다. 비워두면 아무거나 체크되었는지만 확인합니다.'
                            : '선택한 옵션들 중 하나가 선택되었는지 확인합니다. 비워두면 아무거나 선택되었는지만 확인합니다.'
                        }
                        multipleRows={rule.conditions.rowIds.length > 1}
                      />
                    )}

                  {/* 추가 조건 설정 */}
                  <div className="space-y-3 border-t border-gray-200 pt-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">추가 조건 (선택)</Label>
                      <Switch
                        checked={!!rule.additionalConditions}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            updateRule(rule.id, {
                              additionalConditions: {
                                cellColumnIndex: 0,
                                checkType: 'radio',
                              },
                            });
                          } else {
                            updateRule(rule.id, { additionalConditions: undefined });
                          }
                        }}
                      />
                    </div>

                    {rule.additionalConditions && (
                      <div className="space-y-3 border-l-2 border-blue-200 pl-4">
                        {/* 추가 조건 열 인덱스 */}
                        <div className="space-y-2">
                          <Label htmlFor={`additional-col-${rule.id}`}>확인할 열 인덱스</Label>
                          <Input
                            id={`additional-col-${rule.id}`}
                            type="number"
                            min="0"
                            max={(question.tableColumns?.length || 1) - 1}
                            value={rule.additionalConditions.cellColumnIndex ?? ''}
                            onChange={(e) =>
                              updateRule(rule.id, {
                                additionalConditions: {
                                  ...rule.additionalConditions!,
                                  cellColumnIndex: e.target.value ? parseInt(e.target.value) : 0,
                                },
                              })
                            }
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500">0부터 시작 (0 = 첫 번째 열)</p>
                        </div>

                        {/* 추가 조건 체크 타입 */}
                        <div className="space-y-2">
                          <Label htmlFor={`additional-check-type-${rule.id}`}>체크 타입</Label>
                          <select
                            id={`additional-check-type-${rule.id}`}
                            value={rule.additionalConditions.checkType}
                            onChange={(e) =>
                              updateRule(rule.id, {
                                additionalConditions: {
                                  ...rule.additionalConditions!,
                                  checkType: e.target.value as
                                    | 'checkbox'
                                    | 'radio'
                                    | 'select'
                                    | 'input',
                                },
                              })
                            }
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="checkbox">체크박스</option>
                            <option value="radio">라디오 버튼</option>
                            <option value="select">드롭다운</option>
                            <option value="input">입력 필드</option>
                          </select>
                        </div>

                        {/* 추가 조건 확인할 옵션 선택 */}
                        {rule.additionalConditions.checkType !== 'input' &&
                          rule.additionalConditions.cellColumnIndex !== undefined && (
                            <TableOptionSelector
                              question={question}
                              rowIds={
                                rule.conditions.rowIds.length > 0
                                  ? rule.conditions.rowIds
                                  : question.tableRowsData?.map((r) => r.id) || []
                              }
                              colIndex={rule.additionalConditions.cellColumnIndex}
                              expectedValues={rule.additionalConditions.expectedValues}
                              onChange={(values) => {
                                updateRule(rule.id, {
                                  additionalConditions: {
                                    ...rule.additionalConditions!,
                                    expectedValues: values,
                                  },
                                });
                              }}
                              helpText="선택한 옵션들 중 하나가 선택되었는지 확인합니다. 비워두면 아무거나 선택되었는지만 확인합니다."
                              multipleRows={
                                rule.conditions.rowIds.length > 1 || !rule.conditions.rowIds.length
                              }
                            />
                          )}
                      </div>
                    )}
                  </div>

                  {/* 분기 동작 */}
                  <div className="space-y-2">
                    <Label htmlFor={`action-${rule.id}`}>조건 만족 시 동작</Label>
                    <select
                      id={`action-${rule.id}`}
                      value={rule.action}
                      onChange={(e) =>
                        updateRule(rule.id, { action: e.target.value as 'goto' | 'end' })
                      }
                      className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="end">설문 종료</option>
                      <option value="goto">특정 질문으로 이동</option>
                    </select>
                  </div>

                  {/* 이동할 질문 선택 (goto인 경우) */}
                  {rule.action === 'goto' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>분기 방식</Label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              updateRule(rule.id, { targetQuestionMap: undefined });
                            }}
                            className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm transition-all ${
                              !rule.targetQuestionMap
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            고정 질문
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!rule.targetQuestionMap) {
                                updateRule(rule.id, { targetQuestionMap: {} });
                              }
                            }}
                            className={`flex-1 rounded-lg border-2 px-3 py-2 text-sm transition-all ${
                              rule.targetQuestionMap
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            동적 분기
                          </button>
                        </div>
                      </div>

                      {!rule.targetQuestionMap ? (
                        // 고정 질문 선택
                        <div className="space-y-2">
                          <Label htmlFor={`target-${rule.id}`}>이동할 질문</Label>
                          <select
                            id={`target-${rule.id}`}
                            value={rule.targetQuestionId || ''}
                            onChange={(e) =>
                              updateRule(rule.id, { targetQuestionId: e.target.value })
                            }
                            className="w-full rounded-md border border-gray-300 p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          >
                            <option value="">질문 선택...</option>
                            {allQuestions
                              .filter((q) => q.id !== question.id)
                              .map((q, idx) => (
                                <option key={q.id} value={q.id}>
                                  {idx + 1}. {q.title}
                                </option>
                              ))}
                          </select>
                        </div>
                      ) : (
                        // 동적 분기: 값-질문 매핑
                        <div className="space-y-2">
                          <Label>값별 질문 매핑</Label>
                          <div className="space-y-2 rounded-md border border-gray-200 p-3">
                            {Object.entries(rule.targetQuestionMap).map(([value, questionId]) => (
                              <div key={value} className="flex items-center gap-2">
                                <div className="grid flex-1 grid-cols-2 gap-2">
                                  <Input
                                    value={value}
                                    onChange={(e) => {
                                      const newMap = { ...rule.targetQuestionMap! };
                                      const oldValue = value;
                                      const newValue = e.target.value;
                                      if (newValue !== oldValue) {
                                        delete newMap[oldValue];
                                        newMap[newValue] = questionId;
                                      }
                                      updateRule(rule.id, { targetQuestionMap: newMap });
                                    }}
                                    placeholder="옵션 값 (예: 디지털 TV)"
                                    className="text-sm"
                                  />
                                  <select
                                    value={questionId}
                                    onChange={(e) => {
                                      const newMap = { ...rule.targetQuestionMap! };
                                      newMap[value] = e.target.value;
                                      updateRule(rule.id, { targetQuestionMap: newMap });
                                    }}
                                    className="rounded-md border border-gray-300 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                  >
                                    <option value="">질문 선택...</option>
                                    {allQuestions
                                      .filter((q) => q.id !== question.id)
                                      .map((q, idx) => (
                                        <option key={q.id} value={q.id}>
                                          {idx + 1}. {q.title}
                                        </option>
                                      ))}
                                  </select>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newMap = { ...rule.targetQuestionMap! };
                                    delete newMap[value];
                                    updateRule(rule.id, { targetQuestionMap: newMap });
                                  }}
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newMap = { ...rule.targetQuestionMap!, '': '' };
                                updateRule(rule.id, { targetQuestionMap: newMap });
                              }}
                              className="w-full"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              매핑 추가
                            </Button>
                          </div>
                          <p className="text-xs text-gray-500">
                            추가 조건에서 선택된 값에 따라 다른 질문으로 이동합니다. 값은 옵션의
                            value 필드와 일치해야 합니다.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 오류 메시지 (선택) */}
                  <div className="space-y-2">
                    <Label htmlFor={`error-${rule.id}`}>오류 메시지 (선택)</Label>
                    <Input
                      id={`error-${rule.id}`}
                      value={rule.errorMessage || ''}
                      onChange={(e) => updateRule(rule.id, { errorMessage: e.target.value })}
                      placeholder="조건 불만족 시 표시할 메시지"
                    />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
