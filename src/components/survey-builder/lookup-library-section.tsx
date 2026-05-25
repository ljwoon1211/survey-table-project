'use client';

import { useEffect, useState } from 'react';

import { Database, Plus, Upload } from 'lucide-react';

import {
  copySavedLookupToSurveyAction,
  createSavedLookupAction,
  listSavedLookupsAction,
} from '@/actions/lookup-actions';
import { Button } from '@/components/ui/button';
import { useSurveyBuilderStore } from '@/stores/survey-store';
import type { SavedLookup } from '@/types/survey';

import { LookupCsvImport } from './lookup-csv-import';
import { LookupEditModal } from './lookup-edit-modal';

type LookupDraft = Pick<
  SavedLookup,
  'name' | 'description' | 'category' | 'tags' | 'columns' | 'rows'
>;

interface CsvImportResult {
  columns: string[];
  rows: Array<Record<string, string | number>>;
}

export function LookupLibrarySection() {
  const surveyId = useSurveyBuilderStore((s) => s.currentSurvey.id);

  const [items, setItems] = useState<SavedLookup[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<Partial<LookupDraft> | undefined>(undefined);

  const reload = async () => {
    const list = await listSavedLookupsAction();
    setItems(list);
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleNew = () => {
    setEditInitial(undefined);
    setEditOpen(true);
  };

  const handleCsvImported = (result: CsvImportResult) => {
    setEditInitial({
      name: '',
      category: 'custom',
      tags: [],
      columns: result.columns,
      rows: result.rows,
    });
    setEditOpen(true);
  };

  const handleSave = async (draft: LookupDraft) => {
    await createSavedLookupAction(draft);
    setEditOpen(false);
    await reload();
  };

  const handleLoad = async (savedLookupId: string) => {
    if (!surveyId) return;
    await copySavedLookupToSurveyAction(surveyId, savedLookupId);
    await reload();
  };

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold">
        <Database size={14} />
        외부 데이터
      </div>

      <ul className="space-y-1 px-3 pb-2">
        {items.length === 0 ? (
          <li className="text-xs text-gray-400">등록된 LUT 없음</li>
        ) : (
          items.map((lut) => (
            <li key={lut.id} className="group flex items-center justify-between">
              <span className="truncate text-sm" title={lut.name}>
                {lut.name}
              </span>
              <button
                type="button"
                className="text-xs text-blue-600 opacity-0 hover:underline group-hover:opacity-100"
                onClick={() => void handleLoad(lut.id)}
              >
                불러오기
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="flex gap-2 px-3 pt-1">
        <Button variant="outline" size="sm" onClick={handleNew}>
          <Plus size={12} className="mr-1" />새 LUT
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
          <Upload size={12} className="mr-1" />
          엑셀 가져오기
        </Button>
      </div>

      <LookupEditModal
        isOpen={editOpen}
        initialValue={editInitial}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />
      <LookupCsvImport
        isOpen={csvOpen}
        onClose={() => setCsvOpen(false)}
        onImport={handleCsvImported}
      />
    </div>
  );
}
