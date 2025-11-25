"use client";

import React, { useState } from "react";
import { TableValidationRule, TableValidationType, Question } from "@/types/survey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, AlertCircle } from "lucide-react";

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

  const validationTypes: { value: TableValidationType; label: string; description: string }[] = [
    {
      value: "exclusive-check",
      label: "독점 체크",
      description: "지정한 행만 체크되고 다른 행은 모두 체크 안됨 (예: 아날로그TV만 있는 경우)",
    },
    {
      value: "any-of",
      label: "하나라도 체크",
      description: "지정한 행 중 최소 1개 이상 체크됨 (예: A 또는 B 중 하나라도 선택)",
    },
    {
      value: "all-of",
      label: "모두 체크",
      description: "지정한 행이 모두 체크됨 (예: A와 B 모두 선택. 다른 행도 체크 가능)",
    },
    {
      value: "none-of",
      label: "모두 미체크",
      description: "지정한 행이 모두 체크 안됨 (예: A와 B 둘 다 선택 안함)",
    },
    {
      value: "required-combination",
      label: "필수 조합",
      description: "지정한 행들이 모두 체크되어야 함 (all-of와 동일)",
    },
  ];

  const addRule = () => {
    const newRule: TableValidationRule = {
      id: `rule-${Date.now()}`,
      type: "exclusive-check",
      description: "",
      conditions: {
        checkType: "checkbox",
        rowIds: [],
        cellColumnIndex: 0,
      },
      action: "end",
    };
    const updatedRules = [...rules, newRule];
    setRules(updatedRules);
    onUpdate(updatedRules);
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

    const currentRowIds = rule.conditions.rowIds;
    const updatedRowIds = currentRowIds.includes(rowId)
      ? currentRowIds.filter((id) => id !== rowId)
      : [...currentRowIds, rowId];

    updateRule(ruleId, {
      conditions: {
        ...rule.conditions,
        rowIds: updatedRowIds,
      },
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
          <Plus className="w-4 h-4 mr-2" />
          규칙 추가
        </Button>
      </div>

      {rules.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>검증 규칙이 없습니다. 규칙을 추가해보세요.</p>
          </CardContent>
        </Card>
      )}

      {rules.map((rule, index) => (
        <Card key={rule.id} className="border-l-4 border-l-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                규칙 {index + 1}
                {rule.description && (
                  <span className="text-sm font-normal ml-2">- {rule.description}</span>
                )}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeRule(rule.id)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 규칙 설명 */}
            <div className="space-y-2">
              <Label htmlFor={`description-${rule.id}`}>규칙 설명 (선택)</Label>
              <Input
                id={`description-${rule.id}`}
                value={rule.description || ""}
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
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                {question.tableRowsData?.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`row-${rule.id}-${row.id}`}
                      checked={rule.conditions.rowIds.includes(row.id)}
                      onChange={() => toggleRowId(rule.id, row.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label
                      htmlFor={`row-${rule.id}-${row.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {row.label}
                    </label>
                  </div>
                ))}
              </div>
              {rule.conditions.rowIds.length === 0 && (
                <p className="text-xs text-red-600">최소 1개 이상의 행을 선택해주세요</p>
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
                value={rule.conditions.cellColumnIndex ?? ""}
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
                      checkType: e.target.value as "checkbox" | "radio" | "select" | "input",
                    },
                  })
                }
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="checkbox">체크박스</option>
                <option value="radio">라디오 버튼</option>
                <option value="select">드롭다운</option>
                <option value="input">입력 필드</option>
              </select>
            </div>

            {/* 기대 값 설정 */}
            {rule.conditions.checkType !== "checkbox" &&
              rule.conditions.checkType !== "radio" &&
              rule.conditions.checkType !== "select" && (
                // input 타입: 직접 입력
                <div className="space-y-2">
                  <Label htmlFor={`expected-values-${rule.id}`}>기대하는 값들 (선택사항)</Label>
                  <Input
                    id={`expected-values-${rule.id}`}
                    value={(rule.conditions.expectedValues || []).join(", ")}
                    onChange={(e) => {
                      const values = e.target.value
                        .split(",")
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
                    입력 필드에 이 값들 중 하나가 입력되었는지 확인합니다. 비워두면 값이 있는지만
                    확인합니다.
                  </p>
                </div>
              )}

            {/* checkbox/radio/select 타입: 실제 옵션에서 선택 */}
            {(rule.conditions.checkType === "checkbox" ||
              rule.conditions.checkType === "radio" ||
              rule.conditions.checkType === "select") &&
              rule.conditions.rowIds.length > 0 &&
              rule.conditions.cellColumnIndex !== undefined && (
                <div className="space-y-2">
                  <Label>확인할 옵션 선택 (선택사항)</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                    {(() => {
                      // 선택된 행과 열에서 실제 옵션 가져오기
                      const rowId = rule.conditions.rowIds[0]; // 첫 번째 행 사용
                      const colIndex = rule.conditions.cellColumnIndex;
                      const row = question.tableRowsData?.find((r) => r.id === rowId);
                      const cell = row?.cells[colIndex];

                      if (!cell) {
                        return <p className="text-sm text-gray-500">행과 열을 먼저 선택해주세요</p>;
                      }

                      // 셀 타입에 따라 옵션 가져오기
                      let options: Array<{ id: string; label: string; value: string }> = [];

                      if (cell.type === "checkbox" && cell.checkboxOptions) {
                        options = cell.checkboxOptions;
                      } else if (cell.type === "radio" && cell.radioOptions) {
                        options = cell.radioOptions;
                      } else if (cell.type === "select" && cell.selectOptions) {
                        options = cell.selectOptions;
                      }

                      if (options.length === 0) {
                        return <p className="text-sm text-gray-500">이 셀에는 옵션이 없습니다</p>;
                      }

                      return options.map((option) => {
                        const isSelected =
                          rule.conditions.expectedValues?.includes(option.value) || false;

                        return (
                          <div key={option.id} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={`opt-${rule.id}-${option.id}`}
                              checked={isSelected}
                              onChange={(e) => {
                                const currentValues = rule.conditions.expectedValues || [];
                                const newValues = e.target.checked
                                  ? [...currentValues, option.value]
                                  : currentValues.filter((v) => v !== option.value);

                                updateRule(rule.id, {
                                  conditions: {
                                    ...rule.conditions,
                                    expectedValues: newValues.length > 0 ? newValues : undefined,
                                  },
                                });
                              }}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <label
                              htmlFor={`opt-${rule.id}-${option.id}`}
                              className="text-sm cursor-pointer flex-1"
                            >
                              {option.label}
                            </label>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  <p className="text-xs text-gray-500">
                    {rule.conditions.checkType === "checkbox"
                      ? "선택한 옵션들 중 하나라도 체크되었는지 확인합니다. 비워두면 아무거나 체크되었는지만 확인합니다."
                      : rule.conditions.checkType === "radio"
                      ? "선택한 옵션들 중 하나가 선택되었는지 확인합니다. 비워두면 아무거나 선택되었는지만 확인합니다."
                      : "선택한 옵션들 중 하나가 선택되었는지 확인합니다. 비워두면 아무거나 선택되었는지만 확인합니다."}
                  </p>
                </div>
              )}

            {/* 분기 동작 */}
            <div className="space-y-2">
              <Label htmlFor={`action-${rule.id}`}>조건 만족 시 동작</Label>
              <select
                id={`action-${rule.id}`}
                value={rule.action}
                onChange={(e) => updateRule(rule.id, { action: e.target.value as "goto" | "end" })}
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="end">설문 종료</option>
                <option value="goto">특정 질문으로 이동</option>
              </select>
            </div>

            {/* 이동할 질문 선택 (goto인 경우) */}
            {rule.action === "goto" && (
              <div className="space-y-2">
                <Label htmlFor={`target-${rule.id}`}>이동할 질문</Label>
                <select
                  id={`target-${rule.id}`}
                  value={rule.targetQuestionId || ""}
                  onChange={(e) => updateRule(rule.id, { targetQuestionId: e.target.value })}
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            )}

            {/* 오류 메시지 (선택) */}
            <div className="space-y-2">
              <Label htmlFor={`error-${rule.id}`}>오류 메시지 (선택)</Label>
              <Input
                id={`error-${rule.id}`}
                value={rule.errorMessage || ""}
                onChange={(e) => updateRule(rule.id, { errorMessage: e.target.value })}
                placeholder="조건 불만족 시 표시할 메시지"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
