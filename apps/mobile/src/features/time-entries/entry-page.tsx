import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EntryForm } from './entry-form';

export function EntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const mode = id ? 'edit' : 'new';

  return (
    <EntryForm
      mode={mode}
      entryId={id}
      onSaved={() => navigate('/')}
      onCancel={() => navigate('/')}
    />
  );
}
