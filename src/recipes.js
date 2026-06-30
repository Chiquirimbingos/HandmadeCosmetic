import { supabase } from './supabase.js'

// ─────────────────────────────────────────────────────────────
// Este módulo trabaja contra el esquema real cargado en Supabase:
// tablas `recetas` y `receta_ingredientes`, la vista
// `v_capacidad_produccion` y las funciones SQL
// `calcular_maximo_produccion()` y `ejecutar_produccion()`.
// Toda la lógica de cálculo vive en la base de datos: no se
// reimplementa aquí.
// ─────────────────────────────────────────────────────────────

// ─── Leer todas las recetas con su detalle de ingredientes ────
export async function getRecipes() {
  const { data, error } = await supabase
    .from('recetas')
    .select(`
      *,
      receta_ingredientes (
        cantidad,
        ingrediente_id,
        ingredientes ( id, nombre, unidad, stock )
      )
    `)
    .order('nombre')
  if (error) throw error
  return data
}

// ─── Leer una receta puntual ────────────────────────────────────
export async function getRecipe(id) {
  const { data, error } = await supabase
    .from('recetas')
    .select(`
      *,
      receta_ingredientes (
        cantidad,
        ingrediente_id,
        ingredientes ( id, nombre, unidad, stock )
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ─── Capacidad de producción de TODAS las recetas ──────────────
// Usa directamente la vista v_capacidad_produccion (ya resuelta
// en SQL vía calcular_maximo_produccion por cada receta).
export async function getCapacidadProduccion() {
  const { data, error } = await supabase
    .from('v_capacidad_produccion')
    .select('*')
    .order('receta')
  if (error) throw error
  return data
}

// ─── Máximo producible de UNA receta (llama la función SQL) ───
// Retorna { max_unidades, ingrediente_limitante_id, ingrediente_limitante }
export async function calcularMaximoProduccion(recetaId) {
  const { data, error } = await supabase
    .rpc('calcular_maximo_produccion', { p_receta_id: recetaId })
  if (error) throw error
  return data?.[0] ?? { max_unidades: 0, ingrediente_limitante_id: null, ingrediente_limitante: null }
}

// ─── Crear receta con sus ingredientes ─────────────────────────
// ingredientRows: [{ ingrediente_id, cantidad }]
export async function addRecipe({ nombre, tipo, rendimiento, unidad_salida, descripcion, ingredientRows }) {
  const { data: receta, error: recetaError } = await supabase
    .from('recetas')
    .insert([{ nombre, tipo, rendimiento, unidad_salida, descripcion }])
    .select()
    .single()
  if (recetaError) throw recetaError

  if (ingredientRows.length > 0) {
    const rows = ingredientRows.map(r => ({
      receta_id: receta.id,
      ingrediente_id: r.ingrediente_id,
      cantidad: r.cantidad,
    }))
    const { error: ingError } = await supabase.from('receta_ingredientes').insert(rows)
    if (ingError) throw ingError
  }

  return receta
}

// ─── Eliminar receta (cascada elimina receta_ingredientes) ─────
export async function deleteRecipe(id) {
  const { error } = await supabase.from('recetas').delete().eq('id', id)
  if (error) throw error
}

// ─── Ejecutar producción real: descuenta stock + registra todo ─
// Llama a la función SQL ejecutar_produccion(), que valida
// capacidad, crea la orden y descuenta el stock atómicamente.
export async function ejecutarProduccion(recetaId, unidades, nota = null) {
  const { data, error } = await supabase
    .rpc('ejecutar_produccion', {
      p_receta_id: recetaId,
      p_unidades: unidades,
      p_nota: nota,
    })
  if (error) throw error
  return data // UUID de la orden creada
}

// ─── Validar si se pueden producir N unidades (cálculo en JS) ──
// Esto SÍ se calcula en el cliente porque es una simulación
// de "qué pasaría si" sin tocar la base de datos. El cálculo
// real y autoritativo de máximo producible sigue viviendo en
// calcular_maximo_produccion() vía RPC.
export function validateProduction(recipe, unidades) {
  const items = (recipe.receta_ingredientes || []).map(ri => {
    const ing = ri.ingredientes
    const needed = ri.cantidad * unidades
    const available = ing?.stock ?? 0
    const ok = available >= needed
    return {
      nombre: ing?.nombre ?? '?',
      unidad: ing?.unidad ?? 'g',
      needed,
      available,
      deficit: ok ? 0 : needed - available,
      ok,
    }
  })
  return {
    possible: items.every(i => i.ok),
    items,
  }
}
