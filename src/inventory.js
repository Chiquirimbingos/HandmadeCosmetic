import { supabase } from './supabase.js'

// ─────────────────────────────────────────────────────────────
// Este módulo trabaja contra el esquema real cargado en Supabase
// (cosmetica_schema.sql): tablas `ingredientes` y `categorias`,
// y la vista `v_inventario` que ya calcula el estado de stock.
// ─────────────────────────────────────────────────────────────

// ─── Leer categorías ───────────────────────────────────────────
export async function getCategorias() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data
}

// ─── Leer inventario completo (usa la vista v_inventario) ─────
// La vista ya trae: id, nombre, categoria, unidad, stock,
// stock_minimo, porcentaje_minimo, estado, notas, actualizado_en
export async function getIngredients() {
  const { data, error } = await supabase
    .from('v_inventario')
    .select('*')
    .order('nombre')
  if (error) throw error
  return data
}

// ─── Leer ingredientes por categoría ───────────────────────────
export async function getIngredientsByCategory(categoria) {
  let query = supabase.from('v_inventario').select('*').order('nombre')
  if (categoria && categoria !== 'all') query = query.eq('categoria', categoria)
  const { data, error } = await query
  if (error) throw error
  return data
}

// ─── Agregar ingrediente ────────────────────────────────────────
// categoria_id se resuelve a partir del nombre de categoría
export async function addIngredient({ nombre, categoria_id, unidad, stock, stock_minimo, notas }) {
  const { data, error } = await supabase
    .from('ingredientes')
    .insert([{ nombre, categoria_id, unidad, stock, stock_minimo, notas }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Actualizar solo el stock de un ingrediente ────────────────
export async function updateStock(id, stock) {
  const { data, error } = await supabase
    .from('ingredientes')
    .update({ stock })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Actualizar ingrediente completo ───────────────────────────
export async function updateIngredient(id, fields) {
  const { data, error } = await supabase
    .from('ingredientes')
    .update(fields)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Eliminar ingrediente ───────────────────────────────────────
export async function deleteIngredient(id) {
  const { error } = await supabase
    .from('ingredientes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─── Registrar un movimiento de stock manual (entrada/ajuste) ──
export async function registrarMovimiento({ ingrediente_id, tipo, cantidad, nota }) {
  const { data, error } = await supabase
    .from('movimientos_stock')
    .insert([{ ingrediente_id, tipo, cantidad, nota }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ─── Mapear el campo `estado` de la vista a la nomenclatura de UI ─
// La vista retorna: 'sin_stock' | 'critico' | 'bajo' | 'ok'
export function stockStatus(ingredient) {
  const map = {
    sin_stock: 'critical',
    critico:   'critical',
    bajo:      'low',
    ok:        'ok',
  }
  return map[ingredient.estado] ?? 'ok'
}
