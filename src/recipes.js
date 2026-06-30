import { supabase } from './supabase.js'

// ─── Leer todas las recetas (con sus ingredientes) ───────────
export async function getRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients (
        qty,
        ingredient_id,
        ingredients ( id, name, unit, stock )
      )
    `)
    .order('name')
  if (error) throw error
  return data
}

// ─── Leer una receta por ID ───────────────────────────────────
export async function getRecipe(id) {
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients (
        qty,
        ingredient_id,
        ingredients ( id, name, unit, stock )
      )
    `)
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ─── Crear receta con sus ingredientes ───────────────────────
// ingredientRows: [{ ingredient_id, qty }]
export async function addRecipe({ name, type, yield_qty, ingredientRows }) {
  // 1. Insertar receta
  const { data: recipe, error: recipeError } = await supabase
    .from('recipes')
    .insert([{ name, type, yield_qty }])
    .select()
    .single()
  if (recipeError) throw recipeError

  // 2. Insertar filas de ingredientes
  if (ingredientRows.length > 0) {
    const rows = ingredientRows.map(r => ({
      recipe_id: recipe.id,
      ingredient_id: r.ingredient_id,
      qty: r.qty,
    }))
    const { error: ingError } = await supabase.from('recipe_ingredients').insert(rows)
    if (ingError) throw ingError
  }

  return recipe
}

// ─── Eliminar receta (y sus filas por cascade) ───────────────
export async function deleteRecipe(id) {
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) throw error
}

// ─── Calcular máximo producible para una receta ──────────────
// recipe debe venir con recipe_ingredients[].ingredients.stock y qty
export function calcMaxUnits(recipe) {
  if (!recipe.recipe_ingredients || recipe.recipe_ingredients.length === 0) return { max: 0, limiting: null }

  let min = Infinity
  let limitingIng = null

  for (const ri of recipe.recipe_ingredients) {
    const ing = ri.ingredients
    if (!ing) continue
    const possible = ri.qty > 0 ? Math.floor(ing.stock / ri.qty) : Infinity
    if (possible < min) {
      min = possible
      limitingIng = ing
    }
  }

  return { max: min === Infinity ? 0 : min, limiting: limitingIng }
}

// ─── Validar si se pueden producir N unidades ────────────────
export function validateProduction(recipe, units) {
  const items = (recipe.recipe_ingredients || []).map(ri => {
    const ing = ri.ingredients
    const needed = ri.qty * units
    const available = ing?.stock ?? 0
    const ok = available >= needed
    return {
      name: ing?.name ?? '?',
      unit: ing?.unit ?? 'g',
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
