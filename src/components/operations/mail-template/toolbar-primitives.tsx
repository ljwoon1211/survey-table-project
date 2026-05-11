'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface ToolBtnProps {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
}

export function ToolBtn({
  children,
  onClick,
  active,
  disabled,
  title,
  className,
}: ToolBtnProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${active ? 'bg-gray-200' : ''} ${className ?? ''}`}
    >
      {children}
    </Button>
  );
}

export function Sep() {
  return <div className="h-6 w-px bg-gray-300" />;
}
