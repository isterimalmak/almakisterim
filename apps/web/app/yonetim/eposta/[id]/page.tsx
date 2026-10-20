'use client';
import { use } from 'react';
import { MailEditor } from '@/components/mail/MailEditor';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <MailEditor key={id} id={Number(id)} />;
}
