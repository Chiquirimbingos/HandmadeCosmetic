import { supabase } from './supabase.js'

// ─── Leer todos los ingredientes ─────────────────────────────
export async function getIngredients() {
  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

// ─── Leer ingredientes por categoría ─────────────────────────
export async function getIngredientsByCategory(category) {
  const query = supabase.from('ingredients').select('*').order('name')
  if (category && category !== 'all') query.eq('category', category)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ─── Agregar ingrediente ──────────────────────────────────────
export async function addIngredient({ name, category, unit, stock, min_stock }) {
  const { data, error } = await supabase
    .from('ingredients')
    .insert([{ name, category, unit, stock, min_stock }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Actualizar stock de un ingrediente ──────────────────────
export async function updateStock(id, stock) {
  const { data, error } = await supabase
    .from('ingredients')
    .update({ stock, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Actualizar ingrediente completo ─────────────────────────
export async function updateIngredient(id, fields) {
  const { data, error } = await supabase
    .from('ingredients')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Eliminar ingrediente ─────────────────────────────────────
export async function deleteIngredient(id) {
  const { error } = await supabase
    .from('ingredients')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Calcular estado de stock ─────────────────────────────────
export function stockStatus(ingredient) {
  const ratio = ingredient.stock / ingredient.min_stock
  if (ratio <= 0)   return 'critical'   // sin stock
  if (ratio < 0.5)  return 'critical'   // < 50% del mínimo
  if (ratio < 1)    return 'low'        // entre 50% y 100% del mínimo
  return 'ok'
}
