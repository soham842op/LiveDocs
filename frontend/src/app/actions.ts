'use server'

// Server Actions — mutations only. Called from Client Components (e.g. NewDocButton).
// 'use server' at the file level makes every export a Server Function:
// callable from client components, but always executes on the server.
// Data fetching (reads) lives in lib/documents.ts — kept separate to clarify intent.

import { revalidatePath } from 'next/cache'
import { supabase } from '@/lib/supabase'

export async function createDocument(): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('documents')
    .insert({ title: 'Untitled Document' })
    .select('id')
    .single()

  if (error || !data) throw new Error(`createDocument: ${error?.message}`)

  // Revalidate the document list so the sidebar refreshes on next visit.
  revalidatePath('/')
  return { id: data.id }
}
