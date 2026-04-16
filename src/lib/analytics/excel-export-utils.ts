/**
 * Excel Export 공용 유틸리티
 *
 * flat / compact / semi-long 등 여러 export 파일에서 공유하는 헬퍼.
 */
import type { TableCell } from '@/types/survey';

/** 사용자 입력이 가능한 셀 타입인지 판별 */
export function isCellInputable(cell: TableCell): boolean {
  return cell.type === 'checkbox' || cell.type === 'radio' || cell.type === 'select' || cell.type === 'input';
}
