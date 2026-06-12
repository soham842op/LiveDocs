// Server-side data fetching — plain async functions, not server actions.
// Call these from Server Components only. For mutations, use app/actions.ts.
import { supabase, type Doc } from './supabase'

export async function listDocuments(): Promise<Doc[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, updated_at')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`listDocuments: ${error.message}`)
  return data ?? []
}

export async function getDocument(id: string): Promise<Doc | null> {
  const { data } = await supabase
    .from('documents')
    .select('id, title, updated_at')
    .eq('id', id)
    .single()

  return data ?? null
}
