import { generateId } from '@/lib/utils';
import type { CheckboxOption, QuestionOption, RadioOption, TableCell } from '@/types/survey';

/**
 * 셀을 보관함에 저장할 때 위치/메타/이미지 필드를 제거한다.
 */
export function sanitizeCellForLibrary(cell: TableCell): Partial<TableCell> {
  const {
    // 제거 대상: 위치/메타
    id: _id,
    cellCode: _cellCode,
    isCustomCellCode: _isCustomCellCode,
    exportLabel: _exportLabel,
    isCustomExportLabel: _isCustomExportLabel,
    // 제거 대상: 병합
    rowspan: _rowspan,
    colspan: _colspan,
    isHidden: _isHidden,
    // 제거 대상: 이미지 (원본 삭제 시 깨짐 방지)
    imageUrl: _imageUrl,
    // 제거 대상: 라디오 그룹명 (테이블 위치에 종속)
    radioGroupName: _radioGroupName,
    // 보존 대상
    ...rest
  } = cell;

  // 옵션 내 branchRule 제거
  const sanitized: Partial<TableCell> = { ...rest };

  if (sanitized.checkboxOptions) {
    sanitized.checkboxOptions = sanitized.checkboxOptions.map(
      ({ branchRule: _br, ...opt }) => opt as CheckboxOption,
    );
  }
  if (sanitized.radioOptions) {
    sanitized.radioOptions = sanitized.radioOptions.map(
      ({ branchRule: _br, ...opt }) => opt as RadioOption,
    );
  }
  if (sanitized.selectOptions) {
    sanitized.selectOptions = sanitized.selectOptions.map(
      ({ branchRule: _br, ...opt }) => opt as QuestionOption,
    );
  }

  return sanitized;
}

/**
 * 보관함에서 셀 데이터를 불러올 때, 대상 셀의 구조적 속성을 보존하며 머지한다.
 */
export function restoreCellFromLibrary(
  savedCellData: Partial<TableCell>,
  targetCell: TableCell,
): TableCell {
  // 옵션에 새 UUID 생성
  const data = { ...savedCellData };

  if (data.checkboxOptions) {
    data.checkboxOptions = data.checkboxOptions.map((opt) => ({
      ...opt,
      id: generateId(),
    }));
  }
  if (data.radioOptions) {
    data.radioOptions = data.radioOptions.map((opt) => ({
      ...opt,
      id: generateId(),
    }));
  }
  if (data.selectOptions) {
    data.selectOptions = data.selectOptions.map((opt) => ({
      ...opt,
      id: generateId(),
    }));
  }

  return {
    // 보관함에서 가져오는 속성 (기본값 포함)
    type: 'text',
    content: '',
    ...data,
    // 대상 셀에서 보존하는 구조적 속성
    id: targetCell.id,
    cellCode: targetCell.cellCode,
    isCustomCellCode: targetCell.isCustomCellCode,
    exportLabel: targetCell.exportLabel,
    isCustomExportLabel: targetCell.isCustomExportLabel,
    rowspan: targetCell.rowspan,
    colspan: targetCell.colspan,
    isHidden: targetCell.isHidden,
    radioGroupName: targetCell.radioGroupName,
  } as TableCell;
}

/**
 * 셀 내용을 미리보기 텍스트로 변환한다.
 */
export function getCellPreviewText(cell: Partial<TableCell>): string {
  switch (cell.type) {
    case 'checkbox':
      if (cell.checkboxOptions && cell.checkboxOptions.length > 0) {
        return cell.checkboxOptions.map((o) => `□ ${o.label}`).join(' ');
      }
      return '(빈 체크박스)';
    case 'radio':
      if (cell.radioOptions && cell.radioOptions.length > 0) {
        return cell.radioOptions.map((o) => `○ ${o.label}`).join(' ');
      }
      return '(빈 라디오)';
    case 'select':
      if (cell.selectOptions && cell.selectOptions.length > 0) {
        return `▾ ${cell.selectOptions.map((o) => o.label).join(', ')}`;
      }
      return '(빈 선택)';
    case 'input':
      return cell.placeholder || '(텍스트 입력)';
    case 'image':
      return '(이미지)';
    case 'video':
      return cell.content ? cell.content.slice(0, 30) : '(비디오)';
    case 'text':
    default:
      return cell.content ? cell.content.slice(0, 30) : '';
  }
}

/**
 * 셀이 보관함에 저장 가능한지 판단한다.
 * - 빈 text 셀 (content 빈 문자열 + 옵션 없음): 저장 불가
 * - image 타입 셀: imageUrl 제거 시 콘텐츠 없어짐 → 저장 불가
 */
export function isCellSaveable(cell: TableCell): boolean {
  // image 타입은 저장 불가 (imageUrl 제거 시 빈 셀)
  if (cell.type === 'image') return false;

  // 빈 text 셀 저장 불가
  if (cell.type === 'text') {
    return (cell.content ?? '').trim().length > 0;
  }

  // checkbox/radio/select는 옵션이 있으면 저장 가능
  if (cell.type === 'checkbox') {
    return (cell.checkboxOptions?.length ?? 0) > 0;
  }
  if (cell.type === 'radio') {
    return (cell.radioOptions?.length ?? 0) > 0;
  }
  if (cell.type === 'select') {
    return (cell.selectOptions?.length ?? 0) > 0;
  }

  // input, video 등은 항상 저장 가능
  return true;
}

/** 셀 타입 한글 라벨 */
export const CELL_TYPE_LABELS: Record<TableCell['type'], string> = {
  text: '텍스트',
  image: '이미지',
  video: '동영상',
  input: '단답형',
  checkbox: '체크박스',
  radio: '라디오',
  select: '선택',
};
