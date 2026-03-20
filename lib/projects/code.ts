import type { SupabaseClient } from '@supabase/supabase-js'

// Generates the next project code in the format ENE-{YEAR}-{NNN}.
// Reads existing codes for the current year and increments.
// Runs server-side only inside a Server Action (never called from the client).
export async function generateProjectCode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>
): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `ENE-${year}-`

  const { data } = await supabase
    .from('projects')
    .select('project_code')
    .like('project_code', `${prefix}%`)
    .order('project_code', { ascending: false })
    .limit(1)

  if (!data || data.length === 0) {
    return `${prefix}001`
  }

  const last = (data[0] as { project_code: string }).project_code
  const lastNum = parseInt(last.replace(prefix, ''), 10)
  const nextNum = (lastNum + 1).toString().padStart(3, '0')

  return `${prefix}${nextNum}`
}
