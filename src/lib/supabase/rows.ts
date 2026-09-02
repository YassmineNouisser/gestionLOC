/**
 * Sans types générés depuis la base, supabase-js déduit les relations
 * imbriquées comme des tableaux, même pour une relation « vers un ».
 * Ces helpers rétablissent le type réel côté application.
 */
export function rows<T>(data: unknown): T[] {
  return (data ?? []) as T[]
}

export function row<T>(data: unknown): T | null {
  return (data ?? null) as T | null
}
