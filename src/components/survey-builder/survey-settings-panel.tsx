'use client';

import React from 'react';

import { Globe, Lock } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { GroupManager } from '@/components/survey-builder/group-manager';
import { useSurveyBuilderStore } from '@/stores/survey-store';

interface SurveySettingsPanelProps {
  slugInput: string;
  onAutoGenerateSlug: () => void;
  className?: string;
}

export const SurveySettingsPanel = React.memo(function SurveySettingsPanel({
  slugInput,
  onAutoGenerateSlug,
  className,
}: SurveySettingsPanelProps) {
  const { updateSurveySettings } = useSurveyBuilderStore(
    useShallow((s) => ({ updateSurveySettings: s.updateSurveySettings })),
  );
  const surveySettings = useSurveyBuilderStore(
    useShallow((s) => s.currentSurvey.settings),
  );

  return (
    <div
      className={`max-h-[calc(100vh-140px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${className || ''}`}
    >
      <h3 className="mb-6 text-lg font-semibold text-gray-900">설정</h3>

      <div className="space-y-6">
        {/* 설문 설정 */}
        <div>
          <h4 className="mb-3 text-sm font-medium text-gray-700">설문 설정</h4>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {surveySettings.isPublic ? (
                  <Globe className="h-4 w-4 text-green-600" />
                ) : (
                  <Lock className="h-4 w-4 text-gray-500" />
                )}
                <label className="text-sm text-gray-600">공개 설문</label>
              </div>
              <input
                type="checkbox"
                checked={surveySettings.isPublic}
                onChange={(e) => {
                  updateSurveySettings({ isPublic: e.target.checked });
                  // 공개로 전환 시 자동 슬러그 생성
                  if (e.target.checked && !slugInput) {
                    onAutoGenerateSlug();
                  }
                }}
                className="rounded"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">진행률 표시</label>
              <input
                type="checkbox"
                checked={surveySettings.showProgressBar}
                onChange={(e) => updateSurveySettings({ showProgressBar: e.target.checked })}
                className="rounded"
              />
            </div>
          </div>
        </div>

        {/* 그룹 관리 */}
        <div className="border-t border-gray-200 pt-6">
          <GroupManager className="max-h-[400px]" />
        </div>
      </div>
    </div>
  );
});
