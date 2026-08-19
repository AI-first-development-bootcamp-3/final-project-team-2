import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LOCAL_DATE_PATTERN } from '@abra/contracts';
import { EntryForm } from './entry-form';

export function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const mode = id ? 'edit' : 'new';
  const dateParam = params.get('date');
  const defaultDate = dateParam && LOCAL_DATE_PATTERN.test(dateParam) ? dateParam : undefined;

  return (
    <EntryForm
      mode={mode}
      entryId={id}
      defaultDate={defaultDate}
      onSaved={() => navigate('/')}
      onCancel={() => navigate('/')}
    />
  );
}
