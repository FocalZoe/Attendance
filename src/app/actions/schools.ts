'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function createSchoolAction(formData: FormData): Promise<void> {
  const name = formData.get('name') as string;
  const code = formData.get('code') as string;

  if (!name || !code) {
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase.from('schools').insert({
    name: name.trim(),
    code: code.trim().toUpperCase(),
  });

  if (error) {
    console.error('Error creating school:', error);
    return;
  }

  revalidatePath('/dashboard/sys-admin');
}
