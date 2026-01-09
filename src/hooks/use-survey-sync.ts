'use client';

import { useCallback, useTransition, useState } from 'react';
import { useSurveyBuilderStore, useSurveyListStore, useSurveyResponseStore } from '@/stores';
import {
  getSurveyWithDetails,
  getSurveyListWithCounts,
  getResponsesBySurvey,
  calculateResponseSummary,
} from '@/actions/query-actions';
import {
  saveSurveyWithDetails,
  deleteSurvey as deleteSurveyAction,
  duplicateSurvey as duplicateSurveyAction,
} from '@/actions/survey-actions';
import {
  startResponse as startResponseAction,
  updateQuestionResponse as updateQuestionResponseAction,
  completeResponse as completeResponseAction,
} from '@/actions/response-actions';
import type { Survey } from '@/types/survey';

/**
 * 설문 빌더와 DB를 동기화하는 훅
 */
export function useSurveySync() {
  const [isPending, startTransition] = useTransition();
  const { currentSurvey, resetSurvey, markClean } = useSurveyBuilderStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  // 현재 설문을 DB에 저장 (중복 저장 방지 포함)
  const saveSurvey = useCallback(async (surveyData?: Survey) => {
    // surveyData가 제공되면 그것을 사용, 아니면 currentSurvey 사용
    const surveyToSave = surveyData || currentSurvey;

    if (!surveyToSave.id) {
      console.error('설문 ID가 없습니다.');
      return null;
    }

    // 이미 저장 중이면 중복 저장 방지
    if (isSaving) {
      console.log('이미 저장 중입니다. 중복 저장을 방지합니다.');
      return null;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      // 저장 전에 최신 currentSurvey 상태 가져오기 (그룹의 displayCondition 포함)
      const latestSurvey = useSurveyBuilderStore.getState().currentSurvey;
      const finalSurvey = surveyData || latestSurvey;

      const result = await saveSurveyWithDetails(finalSurvey);
      // 저장 성공 시 dirty 플래그 초기화
      markClean();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('설문 저장 실패');
      console.error('설문 저장 실패:', err);
      setSaveError(err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [currentSurvey, isSaving, markClean]);

  // DB에서 설문 불러오기
  const loadSurvey = useCallback(async (surveyId: string) => {
    try {
      const survey = await getSurveyWithDetails(surveyId);
      if (survey) {
        // Zustand store 업데이트
        useSurveyBuilderStore.setState({
          currentSurvey: survey,
          selectedQuestionId: null,
          isTestMode: false,
          testResponses: {},
        });
      }
      return survey;
    } catch (error) {
      console.error('설문 불러오기 실패:', error);
      throw error;
    }
  }, []);

  // 새 설문 생성 (DB + Store)
  const createNewSurvey = useCallback(async () => {
    resetSurvey();
    const newSurvey = useSurveyBuilderStore.getState().currentSurvey;

    try {
      const result = await saveSurveyWithDetails(newSurvey);
      // 생성된 ID로 store 업데이트
      useSurveyBuilderStore.setState((state) => ({
        currentSurvey: {
          ...state.currentSurvey,
          id: result.surveyId,
        },
      }));
      return result.surveyId;
    } catch (error) {
      console.error('새 설문 생성 실패:', error);
      throw error;
    }
  }, [resetSurvey]);

  return {
    isPending,
    isSaving,
    saveError,
    saveSurvey,
    loadSurvey,
    createNewSurvey,
    startTransition,
  };
}

/**
 * 설문 목록과 DB를 동기화하는 훅
 */
export function useSurveyListSync() {
  const [isPending, startTransition] = useTransition();

  // DB에서 설문 목록 불러오기
  const loadSurveyList = useCallback(async () => {
    try {
      const surveys = await getSurveyListWithCounts();

      // Zustand store 업데이트 (선택사항 - 캐싱용)
      // useSurveyListStore.setState({ surveys: ... });

      return surveys;
    } catch (error) {
      console.error('설문 목록 불러오기 실패:', error);
      throw error;
    }
  }, []);

  // 설문 삭제
  const deleteSurvey = useCallback(async (surveyId: string) => {
    try {
      await deleteSurveyAction(surveyId);
      // 로컬 store에서도 삭제
      useSurveyListStore.getState().deleteSurvey(surveyId);
    } catch (error) {
      console.error('설문 삭제 실패:', error);
      throw error;
    }
  }, []);

  // 설문 복제
  const duplicateSurvey = useCallback(async (surveyId: string) => {
    try {
      const newSurvey = await duplicateSurveyAction(surveyId);
      return newSurvey;
    } catch (error) {
      console.error('설문 복제 실패:', error);
      throw error;
    }
  }, []);

  return {
    isPending,
    loadSurveyList,
    deleteSurvey,
    duplicateSurvey,
    startTransition,
  };
}

/**
 * 설문 응답과 DB를 동기화하는 훅
 */
export function useResponseSync() {
  const [isPending, startTransition] = useTransition();

  // 응답 시작
  const startResponse = useCallback(async (surveyId: string) => {
    try {
      const response = await startResponseAction(surveyId);
      return response;
    } catch (error) {
      console.error('응답 시작 실패:', error);
      throw error;
    }
  }, []);

  // 질문 응답 업데이트
  const updateQuestionResponse = useCallback(
    async (responseId: string, questionId: string, value: unknown) => {
      try {
        const updated = await updateQuestionResponseAction(responseId, questionId, value);
        return updated;
      } catch (error) {
        console.error('응답 업데이트 실패:', error);
        throw error;
      }
    },
    []
  );

  // 응답 완료
  const completeResponse = useCallback(async (responseId: string) => {
    try {
      const completed = await completeResponseAction(responseId);
      return completed;
    } catch (error) {
      console.error('응답 완료 실패:', error);
      throw error;
    }
  }, []);

  // 설문별 응답 목록 불러오기
  const loadResponses = useCallback(async (surveyId: string) => {
    try {
      const responses = await getResponsesBySurvey(surveyId);
      return responses;
    } catch (error) {
      console.error('응답 목록 불러오기 실패:', error);
      throw error;
    }
  }, []);

  // 응답 통계 불러오기
  const loadResponseSummary = useCallback(async (surveyId: string) => {
    try {
      const summary = await calculateResponseSummary(surveyId);
      return summary;
    } catch (error) {
      console.error('응답 통계 불러오기 실패:', error);
      throw error;
    }
  }, []);

  return {
    isPending,
    startResponse,
    updateQuestionResponse,
    completeResponse,
    loadResponses,
    loadResponseSummary,
    startTransition,
  };
}

/**
 * 자동 저장 훅 (디바운스 적용)
 */
export function useAutoSave(delay: number = 3000) {
  const { currentSurvey } = useSurveyBuilderStore();
  const { saveSurvey } = useSurveySync();

  // 디바운스된 자동 저장
  const autoSave = useCallback(async () => {
    if (!currentSurvey.id) return;

    try {
      await saveSurvey();
      console.log('자동 저장 완료');
    } catch (error) {
      console.error('자동 저장 실패:', error);
    }
  }, [currentSurvey.id, saveSurvey]);

  return { autoSave };
}
