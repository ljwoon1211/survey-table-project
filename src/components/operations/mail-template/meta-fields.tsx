'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface MetaFieldValues {
  name: string;
  subject: string;
  fromLocal: string;
  fromName: string;
  replyTo: string;
}

interface Props {
  values: MetaFieldValues;
  onChange: (next: MetaFieldValues) => void;
  fromDomain: string;
}

export function MetaFields({ values, onChange, fromDomain }: Props) {
  const set = <K extends keyof MetaFieldValues>(key: K, v: MetaFieldValues[K]) => {
    onChange({ ...values, [key]: v });
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <Field label="템플릿 이름" required>
        <Input
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="예: 한국전시산업진흥회 초대 메일"
          maxLength={100}
        />
      </Field>

      <Field label="메일 제목" required hint="변수 토큰 사용 가능 — 예: {{수행기관}} 안내">
        <Input
          value={values.subject}
          onChange={(e) => set('subject', e.target.value)}
          maxLength={255}
        />
      </Field>

      <Field label="보낸이 표시명" required hint="변수 토큰 가능 — 예: {{수행기관}}">
        <Input
          value={values.fromName}
          onChange={(e) => set('fromName', e.target.value)}
          placeholder="예: 한국전시산업진흥회"
          maxLength={100}
        />
      </Field>

      <Field label="보낸이 계정" required>
        <div className="flex items-stretch">
          <Input
            value={values.fromLocal}
            onChange={(e) => set('fromLocal', e.target.value)}
            placeholder="예: survey"
            maxLength={64}
            className="rounded-r-none"
          />
          <span className="flex items-center rounded-r-md border border-l-0 border-gray-200 bg-gray-50 px-3 text-sm text-gray-500">
            @{fromDomain}
          </span>
        </div>
      </Field>

      <Field label="답장 받을 메일" required hint="발송 후 받는 사람이 답장하면 이 주소로 갑니다">
        <Input
          type="email"
          value={values.replyTo}
          onChange={(e) => set('replyTo', e.target.value)}
          placeholder="예: info@kotra.or.kr"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-3">
      <Label className="pt-2 text-sm">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      <div className="space-y-1">
        {children}
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}
