import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { EmptyState } from './empty-state';

// Placeholder: 응답자 문의사항 카드. 백엔드는 후속 슬라이스. 현재는 빈 상태만 표시.
export function InquiriesEmptyCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">응답자 문의사항</CardTitle>
      </CardHeader>
      <CardContent>
        <EmptyState message="문의사항이 없습니다." />
      </CardContent>
    </Card>
  );
}
