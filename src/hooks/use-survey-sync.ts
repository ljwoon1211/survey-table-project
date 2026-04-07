'use client';

import { useCallback, useState, useTransition } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import {
  calculateResponseSummary,
  getResponsesBySurvey,
  getSurveyListWithCounts,
  getSurveyWithDetails,
} from '@/actions/query-actions';
import {
  completeResponse as completeResponseAction,
  startResponse as startResponseAction,
  updateQuestionResponse as updateQuestionResponseAction,
} from '@/actions/response-actions';
import {
  deleteSurvey as deleteSurveyAction,
  duplicateSurvey as duplicateSurveyAction,
} from '@/actions/survey-crud-actions';
import {
  saveSurveyDiff,
  saveSurveyWithDetails,
} from '@/actions/survey-save-actions';
import type { SurveyDiffPayload } from '@/actions/survey-save-actions';
import { surveyKeys } from '@/hooks/queries/use-surveys';
import {
  useSurveyBuilderStore,
  useSurveyListStore,
  useSurveyResponseStore,
  useSurveyUIStore,
  useTestResponseStore,
} from '@/stores';

/**
 * 설문 빌더와 DB를 동기화하는 훅
 */
export function useSurveySync() {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const { resetSurvey, markClean } = useSurveyBuilderStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  // Diff 기반 저장: 변경분만 서버에 전송
  const saveSurvey = useCallback(
    async () => {
      const store = useSurveyBuilderStore.getState();

      if (!store.currentSurvey.id) {
        console.error('설문 ID가 없습니다.');
        return null;
      }

      if (isSaving) {
        console.log('이미 저장 중입니다. 중복 저장을 방지합니다.');
        return null;
      }

      // 변경 없으면 저장 스킵
      if (!store.isDirty) {
        return { surveyId: store.currentSurvey.id };
      }

      setIsSaving(true);
      setSaveError(null);

      // 스냅샷: 현재 changeset을 캡처하고 초기화 (저장 중 새 변경은 새 changeset에 쌓임)
      const snapshot = store.snapshotChanges();

      try {
        const survey = useSurveyBuilderStore.getState().currentSurvey;
        const { questionChanges: qc, isMetadataDirty } = snapshot;

        const hasQuestionChanges =
          Object.keys(qc.added).length > 0 ||
          Object.keys(qc.updated).length > 0 ||
          Object.keys(qc.deleted).length > 0 ||
          qc.reordered;

        // 변경분이 전혀 없으면 스킵
        if (!isMetadataDirty && !hasQuestionChanges) {
          markClean();
          return { surveyId: survey.id };
        }

        // diff payload 구성
        const payload: SurveyDiffPayload = { surveyId: survey.id };

        if (isMetadataDirty) {
          payload.metadata = {
            title: survey.title,
            description: survey.description,
            slug: survey.slug,
            privateToken: survey.privateToken,
            settings: survey.settings,
            thankYouMessage: survey.settings.thankYouMessage,
          };
          payload.groups = survey.groups;
        }

        if (hasQuestionChanges) {
          const dirtyIds = new Set([
            ...Object.keys(qc.added),
            ...Object.keys(qc.updated),
          ]);
          const upserted = survey.questions.filter((q) => dirtyIds.has(q.id));

          payload.questionChanges = {
            upserted,
            deleted: Object.keys(qc.deleted),
            reorderedIds: qc.reordered
              ? survey.questions.map((q) => q.id)
              : undefined,
          };
        }

        const result = await saveSurveyDiff(payload);
        markClean();
        // 저장 후 TanStack Query 캐시 무효화 → 다음 로드 시 DB에서 최신 데이터 사용
        queryClient.invalidateQueries({ queryKey: surveyKeys.detail(survey.id) });
        queryClient.invalidateQueries({ queryKey: surveyKeys.lists() });
        return result;
      } catch (error) {
        // 실패 시 스냅샷을 현재 changeset에 merge back
        useSurveyBuilderStore.getState().mergeChangesBack(snapshot);
        const err = error instanceof Error ? error : new Error('설문 저장 실패');
        console.error('설문 저장 실패:', err);
        setSaveError(err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, markClean, queryClient],
  );

  // DB에서 설문 불러오기
  const loadSurvey = useCallback(async (surveyId: string) => {
    try {
      const survey = await getSurveyWithDetails(surveyId);
      if (survey) {
        // Zustand store 업데이트 (changeset도 함께 리셋)
        useSurveyBuilderStore.getState().setSurvey(survey);

        // UI 상태 초기화
        const { selectQuestion, setTestMode } = useSurveyUIStore.getState();
        selectQuestion(null);
        setTestMode(false);

        // 테스트 응답 초기화
        useTestResponseStore.getState().clearTestResponses();
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

    // UI 및 테스트 응답 초기화
    const { selectQuestion, setTestMode } = useSurveyUIStore.getState();
    selectQuestion(null);
    setTestMode(false);
    useTestResponseStore.getState().clearTestResponses();

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
      // 로컬 store에서 선택 해제 (목록에서 삭제는 쿼리 무효화로 처리됨)
      useSurveyListStore.getState().deselectSurvey(surveyId);
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
    [],
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
