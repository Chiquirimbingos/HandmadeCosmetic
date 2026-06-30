import { getRecipes, calcMaxUnits, validateProduction } from './recipes.js'

// ─── Estado del simulador ─────────────────────────────────────
let recipes = []

// ─── Cargar recetas desde Supabase ───────────────────────────
export async function loadRecipesForSimulator() {
  recipes = await getRecipes()
  return recipes
}

// ─── Obtener recetas cargadas ─────────────────────────────────
export function getLoadedRecipes() {
  return recipes
}

// ─── Simular producción ───────────────────────────────────────
// recipeId: string UUID
// units: number | null (null = calcular máximo)
// Retorna objeto con resultado listo para renderizar
export function simulate(recipeId, units) {
  const recipe = recipes.find(r => r.id === recipeId)
  if (!recipe) return null

  const { max, limiting } = calcMaxUnits(recipe)

  if (units && units > 0) {
    // Modo validación: ¿puedo fabricar N unidades?
    const validation = validateProduction(recipe, units)
    return {
      mode: 'validate',
      units,
      max,
      possible: validation.possible,
      items: validation.items,
      limiting,
    }
  } else {
    // Modo cálculo: ¿cuánto puedo fabricar como máximo?
    const items = (recipe.recipe_ingredients || []).map(ri => {
      const ing = ri.ingredients
      const possible = ri.qty > 0 ? Math.floor(ing.stock / ri.qty) : Infinity
      return {
        name: ing?.name ?? '?',
        unit: ing?.unit ?? 'g',
        qtyPerUnit: ri.qty,
        stock: ing?.stock ?? 0,
        possible,
        isLimiting: ing?.id === limiting?.id,
      }
    })
    return {
      mode: 'max',
      max,
      limiting,
      items,
    }
  }
}

// ─── Resumen rápido para el dashboard ────────────────────────
// Retorna array: [{ recipeName, max, limitingName, status }]
export function dashboardSummary() {
  return recipes.map(r => {
    const { max, limiting } = calcMaxUnits(r)
    const status = max === 0 ? 'danger' : max <= 3 ? 'warn' : 'ok'
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      max,
      limitingName: limiting?.name ?? null,
      status,
    }
  })
}
