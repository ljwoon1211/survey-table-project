import { generateId } from '@/lib/utils';
import { getMaxSpssCode } from '@/utils/option-code-generator';
import { Question, QuestionOption, SelectLevel } from '@/types/survey';

export const OTHER_OPTION_ID = 'other-option';
export const OTHER_OPTION_LABEL = '기타';

export function addOtherOptionIfNeeded(options: QuestionOption[]): QuestionOption[] {
  const hasOtherOption = options.some((option) => option.id === OTHER_OPTION_ID);
  if (!hasOtherOption) {
    return [
      ...options,
      {
        id: OTHER_OPTION_ID,
        label: OTHER_OPTION_LABEL,
        value: 'other',
        hasOther: true,
      },
    ];
  }
  return options;
}

export function removeOtherOption(options: QuestionOption[]): QuestionOption[] {
  return options.filter((option) => option.id !== OTHER_OPTION_ID);
}

// --- 아래 함수들은 setFormData를 인자로 받아 상태를 업데이트하는 헬퍼 ---

type SetFormData = React.Dispatch<React.SetStateAction<Partial<Question>>>;

export function createAddOption(setFormData: SetFormData) {
  return () => {
    setFormData((prev) => {
      const existingOptions = prev.options || [];
      const newOption: QuestionOption = {
        id: generateId(),
        label: `옵션 ${existingOptions.length + 1}`,
        value: `옵션${existingOptions.length + 1}`,
        spssNumericCode: getMaxSpssCode(existingOptions) + 1,
      };
      return {
        ...prev,
        options: [...existingOptions, newOption],
      };
    });
  };
}

export function createUpdateOption(setFormData: SetFormData) {
  return (optionId: string, updates: Partial<QuestionOption>) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options?.map((option) =>
        option.id === optionId ? { ...option, ...updates } : option,
      ),
    }));
  };
}

export function createRemoveOption(setFormData: SetFormData) {
  return (optionId: string) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options?.filter((option) => option.id !== optionId),
    }));
  };
}

export function createHandleOtherOptionToggle(setFormData: SetFormData) {
  return (enabled: boolean) => {
    setFormData((prev) => {
      const currentOptions = prev.options || [];
      const updatedOptions = enabled
        ? addOtherOptionIfNeeded(currentOptions)
        : removeOtherOption(currentOptions);

      return {
        ...prev,
        allowOtherOption: enabled,
        options: updatedOptions,
      };
    });
  };
}

export function createAddSelectLevel(setFormData: SetFormData) {
  return () => {
    setFormData((prev) => {
      const newLevel: SelectLevel = {
        id: generateId(),
        label: `레벨 ${(prev.selectLevels?.length || 0) + 1}`,
        placeholder: '',
        order: prev.selectLevels?.length || 0,
        options: [],
      };
      return {
        ...prev,
        selectLevels: [...(prev.selectLevels || []), newLevel],
      };
    });
  };
}

export function createUpdateSelectLevel(setFormData: SetFormData) {
  return (levelId: string, updates: Partial<SelectLevel>) => {
    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels?.map((level) =>
        level.id === levelId ? { ...level, ...updates } : level,
      ),
    }));
  };
}

export function createRemoveSelectLevel(setFormData: SetFormData) {
  return (levelId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels
        ?.filter((level) => level.id !== levelId)
        ?.map((level, index) => ({ ...level, order: index })),
    }));
  };
}

export function createAddLevelOption(setFormData: SetFormData) {
  return (levelId: string) => {
    setFormData((prev) => {
      const level = prev.selectLevels?.find((l) => l.id === levelId);
      if (!level) return prev;

      const levelIndex = prev.selectLevels?.findIndex((l) => l.id === levelId) || 0;
      const optionCount = level.options?.length || 0;

      const newOption: QuestionOption = {
        id: generateId(),
        label: `옵션 ${optionCount + 1}`,
        value: levelIndex === 0 ? `옵션${optionCount + 1}` : `상위옵션-옵션${optionCount + 1}`,
      };

      return {
        ...prev,
        selectLevels: prev.selectLevels?.map((l) =>
          l.id === levelId ? { ...l, options: [...(l.options || []), newOption] } : l,
        ),
      };
    });
  };
}

export function createUpdateOptionWithParent(setFormData: SetFormData) {
  return (levelId: string, optionId: string, parentValue: string, optionLabel: string) => {
    const sanitizedLabel = optionLabel.trim();
    const autoValue = `${parentValue}-${sanitizedLabel}`;

    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels?.map((level) =>
        level.id === levelId
          ? {
              ...level,
              options: level.options?.map((option) =>
                option.id === optionId
                  ? { ...option, label: optionLabel, value: autoValue }
                  : option,
              ),
            }
          : level,
      ),
    }));
  };
}

export function getParentLevelOptions(
  selectLevels: SelectLevel[] | undefined,
  currentLevelIndex: number,
): QuestionOption[] {
  if (currentLevelIndex === 0) return [];
  const parentLevel = selectLevels?.[currentLevelIndex - 1];
  return parentLevel?.options || [];
}

export function createUpdateLevelOption(setFormData: SetFormData) {
  return (levelId: string, optionId: string, updates: Partial<QuestionOption>) => {
    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels?.map((level) =>
        level.id === levelId
          ? {
              ...level,
              options: level.options?.map((option) =>
                option.id === optionId ? { ...option, ...updates } : option,
              ),
            }
          : level,
      ),
    }));
  };
}

export function createRemoveLevelOption(setFormData: SetFormData) {
  return (levelId: string, optionId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectLevels: prev.selectLevels?.map((level) =>
        level.id === levelId
          ? {
              ...level,
              options: level.options?.filter((option) => option.id !== optionId),
            }
          : level,
      ),
    }));
  };
}
