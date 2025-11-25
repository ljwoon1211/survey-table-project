import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Question, SavedQuestion, QuestionCategory, DEFAULT_CATEGORIES } from '@/types/survey';

// 프리셋 질문 데이터
const PRESET_QUESTIONS: Omit<SavedQuestion, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // 인구통계 - 성별
  {
    name: '성별 질문',
    description: '응답자의 성별을 묻는 기본 질문입니다.',
    category: 'demographics',
    tags: ['기본정보', '필수'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-gender',
      type: 'radio',
      title: '귀하의 성별은 무엇입니까?',
      required: true,
      order: 0,
      options: [
        { id: 'opt-male', label: '남성', value: '남성' },
        { id: 'opt-female', label: '여성', value: '여성' },
      ],
    },
  },
  // 인구통계 - 연령대
  {
    name: '연령대 질문',
    description: '응답자의 연령대를 묻는 질문입니다.',
    category: 'demographics',
    tags: ['기본정보', '필수'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-age',
      type: 'radio',
      title: '귀하의 연령대는 어떻게 되십니까?',
      required: true,
      order: 0,
      options: [
        { id: 'opt-age-10', label: '10대', value: '10대' },
        { id: 'opt-age-20', label: '20대', value: '20대' },
        { id: 'opt-age-30', label: '30대', value: '30대' },
        { id: 'opt-age-40', label: '40대', value: '40대' },
        { id: 'opt-age-50', label: '50대', value: '50대' },
        { id: 'opt-age-60', label: '60대 이상', value: '60대 이상' },
      ],
    },
  },
  // 인구통계 - 직업
  {
    name: '직업 질문',
    description: '응답자의 직업을 묻는 질문입니다.',
    category: 'demographics',
    tags: ['기본정보'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-job',
      type: 'select',
      title: '귀하의 직업은 무엇입니까?',
      required: false,
      order: 0,
      allowOtherOption: true,
      options: [
        { id: 'opt-job-1', label: '학생', value: '학생' },
        { id: 'opt-job-2', label: '회사원', value: '회사원' },
        { id: 'opt-job-3', label: '자영업', value: '자영업' },
        { id: 'opt-job-4', label: '전문직', value: '전문직' },
        { id: 'opt-job-5', label: '공무원', value: '공무원' },
        { id: 'opt-job-6', label: '주부', value: '주부' },
        { id: 'opt-job-7', label: '무직/구직중', value: '무직/구직중' },
      ],
    },
  },
  // 인구통계 - 거주지역
  {
    name: '거주지역 질문',
    description: '응답자의 거주지역을 묻는 질문입니다.',
    category: 'demographics',
    tags: ['기본정보'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-region',
      type: 'select',
      title: '현재 거주하시는 지역은 어디입니까?',
      required: false,
      order: 0,
      options: [
        { id: 'opt-region-1', label: '서울', value: '서울' },
        { id: 'opt-region-2', label: '경기', value: '경기' },
        { id: 'opt-region-3', label: '인천', value: '인천' },
        { id: 'opt-region-4', label: '부산', value: '부산' },
        { id: 'opt-region-5', label: '대구', value: '대구' },
        { id: 'opt-region-6', label: '대전', value: '대전' },
        { id: 'opt-region-7', label: '광주', value: '광주' },
        { id: 'opt-region-8', label: '울산', value: '울산' },
        { id: 'opt-region-9', label: '세종', value: '세종' },
        { id: 'opt-region-10', label: '강원', value: '강원' },
        { id: 'opt-region-11', label: '충북', value: '충북' },
        { id: 'opt-region-12', label: '충남', value: '충남' },
        { id: 'opt-region-13', label: '전북', value: '전북' },
        { id: 'opt-region-14', label: '전남', value: '전남' },
        { id: 'opt-region-15', label: '경북', value: '경북' },
        { id: 'opt-region-16', label: '경남', value: '경남' },
        { id: 'opt-region-17', label: '제주', value: '제주' },
      ],
    },
  },
  // 만족도 - 5점 척도
  {
    name: '5점 만족도 질문',
    description: '5점 척도로 만족도를 측정하는 질문입니다.',
    category: 'satisfaction',
    tags: ['만족도', '5점척도'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-satisfaction-5',
      type: 'radio',
      title: '전반적인 만족도는 어떠십니까?',
      required: true,
      order: 0,
      options: [
        { id: 'opt-sat-1', label: '매우 불만족', value: '1' },
        { id: 'opt-sat-2', label: '불만족', value: '2' },
        { id: 'opt-sat-3', label: '보통', value: '3' },
        { id: 'opt-sat-4', label: '만족', value: '4' },
        { id: 'opt-sat-5', label: '매우 만족', value: '5' },
      ],
    },
  },
  // 만족도 - 7점 척도
  {
    name: '7점 만족도 질문',
    description: '7점 척도로 만족도를 측정하는 질문입니다.',
    category: 'satisfaction',
    tags: ['만족도', '7점척도'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-satisfaction-7',
      type: 'radio',
      title: '서비스에 대한 전반적인 만족도를 평가해 주세요.',
      required: true,
      order: 0,
      options: [
        { id: 'opt-sat7-1', label: '1 - 매우 불만족', value: '1' },
        { id: 'opt-sat7-2', label: '2', value: '2' },
        { id: 'opt-sat7-3', label: '3', value: '3' },
        { id: 'opt-sat7-4', label: '4 - 보통', value: '4' },
        { id: 'opt-sat7-5', label: '5', value: '5' },
        { id: 'opt-sat7-6', label: '6', value: '6' },
        { id: 'opt-sat7-7', label: '7 - 매우 만족', value: '7' },
      ],
    },
  },
  // NPS 질문
  {
    name: 'NPS 추천 의향',
    description: 'Net Promoter Score를 측정하는 표준 질문입니다. (0-10점)',
    category: 'nps',
    tags: ['NPS', '추천의향', '11점척도'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-nps',
      type: 'radio',
      title: '이 서비스를 주변 지인에게 추천할 의향이 얼마나 되십니까?',
      description: '0점(전혀 추천하지 않음)부터 10점(적극 추천)까지 선택해 주세요.',
      required: true,
      order: 0,
      options: [
        { id: 'opt-nps-0', label: '0', value: '0' },
        { id: 'opt-nps-1', label: '1', value: '1' },
        { id: 'opt-nps-2', label: '2', value: '2' },
        { id: 'opt-nps-3', label: '3', value: '3' },
        { id: 'opt-nps-4', label: '4', value: '4' },
        { id: 'opt-nps-5', label: '5', value: '5' },
        { id: 'opt-nps-6', label: '6', value: '6' },
        { id: 'opt-nps-7', label: '7', value: '7' },
        { id: 'opt-nps-8', label: '8', value: '8' },
        { id: 'opt-nps-9', label: '9', value: '9' },
        { id: 'opt-nps-10', label: '10', value: '10' },
      ],
    },
  },
  // 피드백 - 개선점
  {
    name: '개선점 피드백',
    description: '서비스 개선점에 대한 의견을 수집하는 질문입니다.',
    category: 'feedback',
    tags: ['피드백', '개선'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-improvement',
      type: 'textarea',
      title: '서비스 개선을 위한 의견이 있으시면 자유롭게 작성해 주세요.',
      description: '귀하의 소중한 의견은 서비스 개선에 큰 도움이 됩니다.',
      required: false,
      order: 0,
    },
  },
  // 피드백 - 좋았던 점/아쉬운 점
  {
    name: '장단점 피드백',
    description: '좋았던 점과 아쉬운 점을 묻는 질문입니다.',
    category: 'feedback',
    tags: ['피드백', '장단점'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-pros-cons',
      type: 'checkbox',
      title: '서비스 이용 중 좋았던 점을 모두 선택해 주세요.',
      required: false,
      order: 0,
      allowOtherOption: true,
      options: [
        { id: 'opt-pros-1', label: '사용하기 쉬움', value: '사용하기 쉬움' },
        { id: 'opt-pros-2', label: '빠른 속도', value: '빠른 속도' },
        { id: 'opt-pros-3', label: '다양한 기능', value: '다양한 기능' },
        { id: 'opt-pros-4', label: '합리적인 가격', value: '합리적인 가격' },
        { id: 'opt-pros-5', label: '친절한 고객 서비스', value: '친절한 고객 서비스' },
        { id: 'opt-pros-6', label: '깔끔한 디자인', value: '깔끔한 디자인' },
      ],
    },
  },
  // 선호도 - 선호 기능
  {
    name: '선호 기능 질문',
    description: '가장 선호하는 기능을 묻는 질문입니다.',
    category: 'preference',
    tags: ['선호도', '기능'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-preferred-feature',
      type: 'radio',
      title: '가장 자주 사용하시는 기능은 무엇입니까?',
      required: true,
      order: 0,
      allowOtherOption: true,
      options: [
        { id: 'opt-feat-1', label: '기능 A', value: '기능 A' },
        { id: 'opt-feat-2', label: '기능 B', value: '기능 B' },
        { id: 'opt-feat-3', label: '기능 C', value: '기능 C' },
        { id: 'opt-feat-4', label: '기능 D', value: '기능 D' },
      ],
    },
  },
  // 선호도 - 이용 빈도
  {
    name: '이용 빈도 질문',
    description: '서비스 이용 빈도를 묻는 질문입니다.',
    category: 'preference',
    tags: ['이용빈도', '행동'],
    usageCount: 0,
    isPreset: true,
    question: {
      id: 'preset-frequency',
      type: 'radio',
      title: '서비스를 얼마나 자주 이용하십니까?',
      required: true,
      order: 0,
      options: [
        { id: 'opt-freq-1', label: '매일', value: '매일' },
        { id: 'opt-freq-2', label: '주 2-3회', value: '주 2-3회' },
        { id: 'opt-freq-3', label: '주 1회', value: '주 1회' },
        { id: 'opt-freq-4', label: '월 2-3회', value: '월 2-3회' },
        { id: 'opt-freq-5', label: '월 1회 이하', value: '월 1회 이하' },
      ],
    },
  },
];

interface QuestionLibraryState {
  // 보관함 목록
  savedQuestions: SavedQuestion[];

  // 카테고리 목록
  categories: QuestionCategory[];

  // 프리셋 초기화 여부
  presetsInitialized: boolean;

  // 액션들
  initializePresets: () => void;
  saveQuestion: (
    question: Question,
    metadata: {
      name: string;
      description?: string;
      category: string;
      tags?: string[];
    }
  ) => SavedQuestion;
  updateSavedQuestion: (id: string, updates: Partial<SavedQuestion>) => void;
  deleteSavedQuestion: (id: string) => void;

  // 조회
  getQuestionsByCategory: (category: string) => SavedQuestion[];
  searchQuestions: (query: string) => SavedQuestion[];
  getRecentlyUsed: (limit?: number) => SavedQuestion[];
  getMostUsed: (limit?: number) => SavedQuestion[];
  getAllTags: () => string[];
  getQuestionsByTag: (tag: string) => SavedQuestion[];

  // 사용 - 새 ID로 복제된 Question 반환 + usageCount 증가
  applyQuestion: (id: string, targetGroupId?: string) => Question | null;
  applyMultipleQuestions: (ids: string[], targetGroupId?: string) => Question[];

  // 카테고리 관리
  addCategory: (name: string, color?: string) => void;
  updateCategory: (id: string, updates: Partial<QuestionCategory>) => void;
  deleteCategory: (id: string) => void;

  // 내보내기/가져오기
  exportLibrary: () => string;
  importLibrary: (json: string) => void;

  // 분기 로직 체크
  hasBranchLogic: (question: Question) => boolean;
  removeBranchLogic: (question: Question) => Question;
}

// 질문에 분기 로직이 있는지 확인
function checkHasBranchLogic(question: Question): boolean {
  // options에 분기 규칙이 있는지 확인
  if (question.options?.some(opt => opt.branchRule)) {
    return true;
  }

  // 테이블 검증 규칙이 있는지 확인
  if (question.tableValidationRules?.length) {
    return true;
  }

  // 테이블 셀에 분기 규칙이 있는지 확인
  if (question.tableRowsData) {
    for (const row of question.tableRowsData) {
      for (const cell of row.cells) {
        if (cell.checkboxOptions?.some(opt => opt.branchRule)) return true;
        if (cell.radioOptions?.some(opt => opt.branchRule)) return true;
        if (cell.selectOptions?.some(opt => opt.branchRule)) return true;
      }
    }
  }

  // 표시 조건이 있는지 확인
  if (question.displayCondition?.conditions?.length) {
    return true;
  }

  return false;
}

// 질문에서 분기 로직 제거
function stripBranchLogic(question: Question): Question {
  const cleanedQuestion = { ...question };

  // options에서 분기 규칙 제거
  if (cleanedQuestion.options) {
    cleanedQuestion.options = cleanedQuestion.options.map(opt => {
      const { branchRule: _br, ...rest } = opt;
      return rest;
    });
  }

  // 테이블 검증 규칙 제거
  delete cleanedQuestion.tableValidationRules;

  // 테이블 셀에서 분기 규칙 제거
  if (cleanedQuestion.tableRowsData) {
    cleanedQuestion.tableRowsData = cleanedQuestion.tableRowsData.map(row => ({
      ...row,
      cells: row.cells.map(cell => {
        const cleanedCell = { ...cell };
        if (cleanedCell.checkboxOptions) {
          cleanedCell.checkboxOptions = cleanedCell.checkboxOptions.map(opt => {
            const { branchRule: _br1, ...rest } = opt;
            return rest;
          });
        }
        if (cleanedCell.radioOptions) {
          cleanedCell.radioOptions = cleanedCell.radioOptions.map(opt => {
            const { branchRule: _br2, ...rest } = opt;
            return rest;
          });
        }
        if (cleanedCell.selectOptions) {
          cleanedCell.selectOptions = cleanedCell.selectOptions.map(opt => {
            const { branchRule: _br3, ...rest } = opt;
            return rest;
          });
        }
        return cleanedCell;
      }),
    }));
  }

  // 표시 조건 제거
  delete cleanedQuestion.displayCondition;

  return cleanedQuestion;
}

// 새 ID로 질문 복제
function cloneQuestionWithNewIds(question: Question, targetGroupId?: string): Question {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);

  const clonedQuestion: Question = {
    ...question,
    id: `question-${timestamp}-${random}`,
    groupId: targetGroupId,
    order: 0, // order는 추가하는 쪽에서 설정
  };

  // options ID 재생성
  if (clonedQuestion.options) {
    clonedQuestion.options = clonedQuestion.options.map((opt, idx) => ({
      ...opt,
      id: `opt-${timestamp}-${idx}`,
    }));
  }

  // selectLevels ID 재생성
  if (clonedQuestion.selectLevels) {
    clonedQuestion.selectLevels = clonedQuestion.selectLevels.map((level, levelIdx) => ({
      ...level,
      id: `level-${timestamp}-${levelIdx}`,
      options: level.options.map((opt, optIdx) => ({
        ...opt,
        id: `opt-${timestamp}-${levelIdx}-${optIdx}`,
      })),
    }));
  }

  // tableColumns ID 재생성
  if (clonedQuestion.tableColumns) {
    clonedQuestion.tableColumns = clonedQuestion.tableColumns.map((col, idx) => ({
      ...col,
      id: `col-${timestamp}-${idx}`,
    }));
  }

  // tableRowsData ID 재생성
  if (clonedQuestion.tableRowsData) {
    clonedQuestion.tableRowsData = clonedQuestion.tableRowsData.map((row, rowIdx) => ({
      ...row,
      id: `row-${timestamp}-${rowIdx}`,
      cells: row.cells.map((cell, cellIdx) => ({
        ...cell,
        id: `cell-${timestamp}-${rowIdx}-${cellIdx}`,
        checkboxOptions: cell.checkboxOptions?.map((opt, optIdx) => ({
          ...opt,
          id: `chk-${timestamp}-${rowIdx}-${cellIdx}-${optIdx}`,
        })),
        radioOptions: cell.radioOptions?.map((opt, optIdx) => ({
          ...opt,
          id: `rad-${timestamp}-${rowIdx}-${cellIdx}-${optIdx}`,
        })),
        selectOptions: cell.selectOptions?.map((opt, optIdx) => ({
          ...opt,
          id: `sel-${timestamp}-${rowIdx}-${cellIdx}-${optIdx}`,
        })),
      })),
    }));
  }

  return clonedQuestion;
}

export const useQuestionLibraryStore = create<QuestionLibraryState>()(
  devtools(
    persist(
      (set, get) => ({
        savedQuestions: [],
        categories: DEFAULT_CATEGORIES,
        presetsInitialized: false,

        initializePresets: () => {
          if (get().presetsInitialized) return;

          const now = new Date();
          const presetQuestions: SavedQuestion[] = PRESET_QUESTIONS.map((preset, index) => ({
            ...preset,
            id: `preset-${index}-${Date.now()}`,
            createdAt: now,
            updatedAt: now,
          }));

          set((state) => ({
            savedQuestions: [...presetQuestions, ...state.savedQuestions],
            presetsInitialized: true,
          }));
        },

        saveQuestion: (question, metadata) => {
          const now = new Date();
          const newSavedQuestion: SavedQuestion = {
            id: `saved-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            question: { ...question },
            name: metadata.name,
            description: metadata.description,
            category: metadata.category,
            tags: metadata.tags || [],
            usageCount: 0,
            isPreset: false,
            createdAt: now,
            updatedAt: now,
          };

          set((state) => ({
            savedQuestions: [...state.savedQuestions, newSavedQuestion],
          }));

          return newSavedQuestion;
        },

        updateSavedQuestion: (id, updates) => {
          set((state) => ({
            savedQuestions: state.savedQuestions.map((sq) =>
              sq.id === id
                ? { ...sq, ...updates, updatedAt: new Date() }
                : sq
            ),
          }));
        },

        deleteSavedQuestion: (id) => {
          set((state) => ({
            savedQuestions: state.savedQuestions.filter((sq) => sq.id !== id),
          }));
        },

        getQuestionsByCategory: (category) => {
          return get().savedQuestions.filter((sq) => sq.category === category);
        },

        searchQuestions: (query) => {
          const lowerQuery = query.toLowerCase();
          return get().savedQuestions.filter(
            (sq) =>
              sq.name.toLowerCase().includes(lowerQuery) ||
              sq.description?.toLowerCase().includes(lowerQuery) ||
              sq.question.title.toLowerCase().includes(lowerQuery) ||
              sq.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
          );
        },

        getRecentlyUsed: (limit = 5) => {
          return [...get().savedQuestions]
            .filter((sq) => sq.usageCount > 0)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, limit);
        },

        getMostUsed: (limit = 5) => {
          return [...get().savedQuestions]
            .sort((a, b) => b.usageCount - a.usageCount)
            .slice(0, limit);
        },

        getAllTags: () => {
          const tagSet = new Set<string>();
          get().savedQuestions.forEach((sq) => {
            sq.tags.forEach((tag) => tagSet.add(tag));
          });
          return Array.from(tagSet).sort();
        },

        getQuestionsByTag: (tag) => {
          return get().savedQuestions.filter((sq) => sq.tags.includes(tag));
        },

        applyQuestion: (id, targetGroupId) => {
          const savedQuestion = get().savedQuestions.find((sq) => sq.id === id);
          if (!savedQuestion) return null;

          // usageCount 증가 및 updatedAt 갱신
          set((state) => ({
            savedQuestions: state.savedQuestions.map((sq) =>
              sq.id === id
                ? { ...sq, usageCount: sq.usageCount + 1, updatedAt: new Date() }
                : sq
            ),
          }));

          // 새 ID로 복제하여 반환
          return cloneQuestionWithNewIds(savedQuestion.question, targetGroupId);
        },

        applyMultipleQuestions: (ids, targetGroupId) => {
          const questions: Question[] = [];

          ids.forEach((id) => {
            const question = get().applyQuestion(id, targetGroupId);
            if (question) {
              questions.push(question);
            }
          });

          return questions;
        },

        addCategory: (name, color = 'bg-gray-100 text-gray-600') => {
          const categories = get().categories;
          const maxOrder = Math.max(...categories.map((c) => c.order), -1);

          const newCategory: QuestionCategory = {
            id: `cat-${Date.now()}`,
            name,
            color,
            order: maxOrder + 1,
          };

          set((state) => ({
            categories: [...state.categories, newCategory],
          }));
        },

        updateCategory: (id, updates) => {
          set((state) => ({
            categories: state.categories.map((cat) =>
              cat.id === id ? { ...cat, ...updates } : cat
            ),
          }));
        },

        deleteCategory: (id) => {
          // 해당 카테고리의 질문들을 'custom'으로 이동
          set((state) => ({
            categories: state.categories.filter((cat) => cat.id !== id),
            savedQuestions: state.savedQuestions.map((sq) =>
              sq.category === id ? { ...sq, category: 'custom' } : sq
            ),
          }));
        },

        exportLibrary: () => {
          const { savedQuestions, categories } = get();
          return JSON.stringify({ savedQuestions, categories }, null, 2);
        },

        importLibrary: (json) => {
          try {
            const data = JSON.parse(json);
            const now = new Date();

            if (data.savedQuestions) {
              const importedQuestions: SavedQuestion[] = data.savedQuestions.map(
                (sq: SavedQuestion) => ({
                  ...sq,
                  id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  isPreset: false,
                  createdAt: new Date(sq.createdAt),
                  updatedAt: now,
                })
              );

              set((state) => ({
                savedQuestions: [...state.savedQuestions, ...importedQuestions],
              }));
            }

            if (data.categories) {
              const existingIds = new Set(get().categories.map((c) => c.id));
              const newCategories = data.categories.filter(
                (c: QuestionCategory) => !existingIds.has(c.id)
              );

              set((state) => ({
                categories: [...state.categories, ...newCategories],
              }));
            }
          } catch (error) {
            console.error('Failed to import library:', error);
          }
        },

        hasBranchLogic: checkHasBranchLogic,
        removeBranchLogic: stripBranchLogic,
      }),
      {
        name: 'question-library-storage',
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            const { state } = JSON.parse(str);
            return {
              state: {
                ...state,
                savedQuestions: state.savedQuestions?.map((sq: SavedQuestion) => ({
                  ...sq,
                  createdAt: new Date(sq.createdAt),
                  updatedAt: new Date(sq.updatedAt),
                })) || [],
              },
            };
          },
          setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value));
          },
          removeItem: (name) => localStorage.removeItem(name),
        },
      }
    ),
    {
      name: 'question-library-store',
    }
  )
);

