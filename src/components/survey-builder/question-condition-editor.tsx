"use client";

import React, { useState } from "react";
import {
  QuestionConditionGroup,
  QuestionCondition,
  ConditionLogicType,
  Question,
} from "@/types/survey";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, AlertCircle, Eye } from "lucide-react";

interface QuestionConditionEditorProps {
  question: Question;
  onUpdate: (conditionGroup: QuestionConditionGroup | undefined) => void;
  allQuestions: Question[];
}

export function QuestionConditionEditor({
  question,
  onUpdate,
  allQuestions,
}: QuestionConditionEditorProps) {
  const [conditionGroup, setConditionGroup] = useState<QuestionConditionGroup | undefined>(
    question.displayCondition
  );

  const [isEnabled, setIsEnabled] = useState(!!question.displayCondition);

  const toggleEnabled = () => {
    if (isEnabled) {
      setIsEnabled(false);
      setConditionGroup(undefined);
      onUpdate(undefined);
    } else {
      setIsEnabled(true);
      const newGroup: QuestionConditionGroup = {
        conditions: [],
        logicType: "AND",
      };
      setConditionGroup(newGroup);
      onUpdate(newGroup);
    }
  };

  const addCondition = () => {
    const newCondition: QuestionCondition = {
      id: `condition-${Date.now()}`,
      sourceQuestionId: "",
      conditionType: "table-cell-check",
      logicType: "AND",
    };

    const updatedGroup: QuestionConditionGroup = {
      ...conditionGroup,
      conditions: [...(conditionGroup?.conditions || []), newCondition],
      logicType: conditionGroup?.logicType || "AND",
    };

    setConditionGroup(updatedGroup);
    onUpdate(updatedGroup);
  };

  const removeCondition = (conditionId: string) => {
    if (!conditionGroup) return;

    const updatedGroup: QuestionConditionGroup = {
      ...conditionGroup,
      conditions: conditionGroup.conditions.filter((c) => c.id !== conditionId),
    };

    setConditionGroup(updatedGroup);
    onUpdate(updatedGroup);
  };

  const updateCondition = (conditionId: string, updates: Partial<QuestionCondition>) => {
    if (!conditionGroup) return;

    const updatedGroup: QuestionConditionGroup = {
      ...conditionGroup,
      conditions: conditionGroup.conditions.map((c) =>
        c.id === conditionId ? { ...c, ...updates } : c
      ),
    };

    setConditionGroup(updatedGroup);
    onUpdate(updatedGroup);
  };

  const updateGroupLogic = (logicType: ConditionLogicType) => {
    if (!conditionGroup) return;

    const updatedGroup: QuestionConditionGroup = {
      ...conditionGroup,
      logicType,
    };

    setConditionGroup(updatedGroup);
    onUpdate(updatedGroup);
  };

  const toggleRowId = (conditionId: string, rowId: string) => {
    const condition = conditionGroup?.conditions.find((c) => c.id === conditionId);
    if (!condition) return;

    // tableConditions가 없으면 초기화
    const currentRowIds = condition.tableConditions?.rowIds || [];
    const updatedRowIds = currentRowIds.includes(rowId)
      ? currentRowIds.filter((id) => id !== rowId)
      : [...currentRowIds, rowId];

    updateCondition(conditionId, {
      tableConditions: {
        rowIds: updatedRowIds,
        checkType: condition.tableConditions?.checkType || "any",
        cellColumnIndex: condition.tableConditions?.cellColumnIndex,
      },
    });
  };

  // 이전 질문들만 필터링 (현재 질문보다 앞에 있는 질문만)
  const previousQuestions = allQuestions.filter((q) => {
    const qIndex = allQuestions.findIndex((question) => question.id === q.id);
    const currentIndex = allQuestions.findIndex((q) => q.id === question.id);
    return qIndex < currentIndex;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">질문 표시 조건</h3>
          <p className="text-sm text-gray-600">
            이전 질문의 응답에 따라 이 질문을 표시하거나 숨김
          </p>
        </div>
        <Button
          onClick={toggleEnabled}
          variant={isEnabled ? "destructive" : "default"}
          size="sm"
        >
          <Eye className="w-4 h-4 mr-2" />
          {isEnabled ? "조건 비활성화" : "조건 활성화"}
        </Button>
      </div>

      {!isEnabled && (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>표시 조건이 비활성화되어 있습니다. 이 질문은 항상 표시됩니다.</p>
          </CardContent>
        </Card>
      )}

      {isEnabled && (
        <>
          {/* 조건 결합 방식 */}
          {conditionGroup && conditionGroup.conditions.length > 1 && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <Label>여러 조건 결합 방식</Label>
                  <select
                    value={conditionGroup.logicType}
                    onChange={(e) => updateGroupLogic(e.target.value as ConditionLogicType)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="AND">AND - 모든 조건을 만족해야 함</option>
                    <option value="OR">OR - 하나라도 만족하면 됨</option>
                    <option value="NOT">NOT - 모든 조건을 만족하지 않아야 함</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 조건 추가 버튼 */}
          <div className="flex justify-end">
            <Button onClick={addCondition} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              조건 추가
            </Button>
          </div>

          {conditionGroup && conditionGroup.conditions.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p>조건이 없습니다. 조건을 추가해보세요.</p>
              </CardContent>
            </Card>
          )}

          {/* 조건 목록 */}
          {conditionGroup?.conditions.map((condition, index) => {
            const sourceQuestion = previousQuestions.find((q) => q.id === condition.sourceQuestionId);

            return (
              <Card key={condition.id} className="border-l-4 border-l-green-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">조건 {index + 1}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCondition(condition.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* 참조할 질문 선택 */}
                  <div className="space-y-2">
                    <Label htmlFor={`source-${condition.id}`}>참조할 질문</Label>
                    <select
                      id={`source-${condition.id}`}
                      value={condition.sourceQuestionId}
                      onChange={(e) => {
                        const selectedQ = previousQuestions.find((q) => q.id === e.target.value);
                        // 질문 타입에 따라 conditionType 자동 설정
                        const autoConditionType =
                          selectedQ?.type === "table" ? "table-cell-check" : "value-match";
                        updateCondition(condition.id, {
                          sourceQuestionId: e.target.value,
                          conditionType: autoConditionType,
                        });
                      }}
                      className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">질문 선택...</option>
                      {previousQuestions.map((q, idx) => (
                        <option key={q.id} value={q.id}>
                          {idx + 1}. {q.title} ({q.type})
                        </option>
                      ))}
                    </select>
                    {!condition.sourceQuestionId && (
                      <p className="text-xs text-red-600">질문을 선택해주세요</p>
                    )}
                  </div>

                  {/* 조건 타입 */}
                  {condition.sourceQuestionId && (
                    <div className="space-y-2">
                      <Label htmlFor={`type-${condition.id}`}>조건 타입</Label>
                      <select
                        id={`type-${condition.id}`}
                        value={condition.conditionType}
                        onChange={(e) =>
                          updateCondition(condition.id, {
                            conditionType: e.target.value as "value-match" | "table-cell-check" | "custom",
                          })
                        }
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="value-match">값 일치 (radio, select, checkbox)</option>
                        <option value="table-cell-check">테이블 셀 체크 확인</option>
                      </select>
                    </div>
                  )}

                  {/* 테이블 셀 체크 조건 */}
                  {condition.conditionType === "table-cell-check" && sourceQuestion?.type === "table" && (
                    <>
                      <div className="space-y-2">
                        <Label>체크 확인할 행 선택</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-md p-3">
                          {sourceQuestion.tableRowsData?.map((row) => (
                            <div key={row.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`cond-row-${condition.id}-${row.id}`}
                                checked={condition.tableConditions?.rowIds.includes(row.id) || false}
                                onChange={() => toggleRowId(condition.id, row.id)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <label
                                htmlFor={`cond-row-${condition.id}-${row.id}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                {row.label}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`check-type-${condition.id}`}>체크 조건</Label>
                        <select
                          id={`check-type-${condition.id}`}
                          value={condition.tableConditions?.checkType || "any"}
                          onChange={(e) =>
                            updateCondition(condition.id, {
                              tableConditions: {
                                rowIds: condition.tableConditions?.rowIds || [],
                                checkType: e.target.value as "any" | "all" | "none",
                                cellColumnIndex: condition.tableConditions?.cellColumnIndex,
                              },
                            })
                          }
                          className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="any">하나라도 체크됨</option>
                          <option value="all">모두 체크됨</option>
                          <option value="none">모두 체크 안됨</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`col-index-${condition.id}`}>특정 열만 확인 (선택)</Label>
                        <Input
                          id={`col-index-${condition.id}`}
                          type="number"
                          min="0"
                          value={condition.tableConditions?.cellColumnIndex ?? ""}
                          onChange={(e) =>
                            updateCondition(condition.id, {
                              tableConditions: {
                                rowIds: condition.tableConditions?.rowIds || [],
                                checkType: condition.tableConditions?.checkType || "any",
                                cellColumnIndex: e.target.value ? parseInt(e.target.value) : undefined,
                              },
                            })
                          }
                          placeholder="전체 열 확인 (비워두면 모든 열)"
                        />
                        <p className="text-xs text-gray-500">
                          0부터 시작 (0 = 첫 번째 열)
                        </p>
                      </div>
                    </>
                  )}

                  {/* 값 일치 조건 */}
                  {condition.conditionType === "value-match" && (
                    <div className="space-y-2">
                      <Label htmlFor={`values-${condition.id}`}>필요한 값들 (쉼표로 구분)</Label>
                      <Input
                        id={`values-${condition.id}`}
                        value={(condition.requiredValues || []).join(", ")}
                        onChange={(e) => {
                          const values = e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter((v) => v);
                          updateCondition(condition.id, { requiredValues: values });
                        }}
                        placeholder="예: 옵션1, 옵션2"
                      />
                      <p className="text-xs text-gray-500">
                        참조 질문의 응답이 이 값들 중 하나와 일치하면 조건 만족
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}

