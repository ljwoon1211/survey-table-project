import { describe, expect, it } from 'vitest';

import { buildSurveySnapshot } from '@/lib/versioning/snapshot-builder';
import type { Survey } from '@/types/survey';

/**
 * Phase 2: 스냅샷 빌더 테스트
 *
 * buildSurveySnapshot 순수 함수 검증
 */

const mockSurvey: Survey = {
  id: 'survey-001',
  title: '테스트 설문',
  description: '설문 설명',
  slug: 'test-survey',
  questions: [
    {
      id: 'q-2',
      type: 'radio',
      title: '성별',
      required: true,
      order: 2,
      options: [
        { id: 'opt-1', label: '남', value: 'male' },
        { id: 'opt-2', label: '여', value: 'female' },
      ],
    },
    {
      id: 'q-1',
      type: 'text',
      title: '이름',
      required: true,
      order: 1,
    },
    {
      id: 'q-3',
      type: 'checkbox',
      title: '관심사',
      required: false,
      order: 3,
      options: [
        { id: 'opt-a', label: '스포츠', value: 'sports' },
        { id: 'opt-b', label: '음악', value: 'music' },
      ],
    },
  ],
  groups: [
    {
      id: 'g-2',
      surveyId: 'survey-001',
      name: '그룹 B',
      order: 2,
    },
    {
      id: 'g-1',
      surveyId: 'survey-001',
      name: '그룹 A',
      order: 1,
    },
  ],
  settings: {
    isPublic: true,
    allowMultipleResponses: false,
    showProgressBar: true,
    shuffleQuestions: false,
    requireLogin: false,
    endDate: new Date('2026-12-31T23:59:59Z'),
    maxResponses: 100,
    thankYouMessage: '감사합니다!',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('buildSurveySnapshot', () => {
  it('질문을 order 순으로 정렬', () => {
    const snapshot = buildSurveySnapshot(mockSurvey);

    expect(snapshot.questions).toHaveLength(3);
    expect(snapshot.questions[0].id).toBe('q-1');
    expect(snapshot.questions[1].id).toBe('q-2');
    expect(snapshot.questions[2].id).toBe('q-3');
  });

  it('그룹을 order 순으로 정렬', () => {
    const snapshot = buildSurveySnapshot(mockSurvey);

    expect(snapshot.groups).toHaveLength(2);
    expect(snapshot.groups[0].id).toBe('g-1');
    expect(snapshot.groups[1].id).toBe('g-2');
  });

  it('설문 제목과 설명을 포함', () => {
    const snapshot = buildSurveySnapshot(mockSurvey);

    expect(snapshot.title).toBe('테스트 설문');
    expect(snapshot.description).toBe('설문 설명');
  });

  it('설정을 올바르게 복사 (endDate를 ISO string으로 변환)', () => {
    const snapshot = buildSurveySnapshot(mockSurvey);

    expect(snapshot.settings.isPublic).toBe(true);
    expect(snapshot.settings.allowMultipleResponses).toBe(false);
    expect(snapshot.settings.endDate).toBe('2026-12-31T23:59:59.000Z');
    expect(snapshot.settings.maxResponses).toBe(100);
    expect(snapshot.settings.thankYouMessage).toBe('감사합니다!');
  });

  it('endDate가 없으면 undefined', () => {
    const surveyNoEndDate: Survey = {
      ...mockSurvey,
      settings: { ...mockSurvey.settings, endDate: undefined },
    };
    const snapshot = buildSurveySnapshot(surveyNoEndDate);

    expect(snapshot.settings.endDate).toBeUndefined();
  });

  it('런타임 필드(createdAt, updatedAt, slug, privateToken) 제거', () => {
    const snapshot = buildSurveySnapshot(mockSurvey);

    expect(snapshot).not.toHaveProperty('createdAt');
    expect(snapshot).not.toHaveProperty('updatedAt');
    expect(snapshot).not.toHaveProperty('slug');
    expect(snapshot).not.toHaveProperty('id');
  });

  it('질문의 options, tableColumns 등 세부 속성 보존', () => {
    const snapshot = buildSurveySnapshot(mockSurvey);

    const radioQ = snapshot.questions.find((q) => q.id === 'q-2');
    expect(radioQ!.options).toHaveLength(2);
    expect(radioQ!.options![0].value).toBe('male');
  });

  it('질문/그룹이 빈 배열이어도 정상 동작', () => {
    const emptySurvey: Survey = {
      ...mockSurvey,
      questions: [],
      groups: [],
    };
    const snapshot = buildSurveySnapshot(emptySurvey);

    expect(snapshot.questions).toEqual([]);
    expect(snapshot.groups).toEqual([]);
  });

  it('원본 배열을 변경하지 않음 (불변성)', () => {
    const originalOrder = mockSurvey.questions.map((q) => q.id);
    buildSurveySnapshot(mockSurvey);

    expect(mockSurvey.questions.map((q) => q.id)).toEqual(originalOrder);
  });
});
