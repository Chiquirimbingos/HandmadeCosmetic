import { getRecipes, getCapacidadProduccion, calcularMaximoProduccion, validateProduction } from './recipes.js'

// ─────────────────────────────────────────────────────────────
// El simulador delega el cálculo de "máximo producible" a la
// función SQL calcular_maximo_produccion() vía RPC, y el resumen
// del dashboard a la vista v_capacidad_produccion. Solo la
// validación de "¿puedo fabricar N unidades?" se resuelve en JS
// (no requiere ir a la base, usa el stock ya cargado en memoria).
// ─────────────────────────────────────────────────────────────

let recipes = []

// ─── Cargar recetas (con su detalle de ingredientes) ───────────
export async function loadRecipesForSimulator() {
  recipes = await getRecipes()
  return recipes
}

export function getLoadedRecipes() {
  return recipes
}

// ─── Simular producción de una receta ──────────────────────────
// recipeId: UUID
// unidades: number | null (null = calcular máximo vía RPC)
export async function simulate(recipeId, unidades) {
  const recipe = recipes.find(r => r.id === recipeId)
  if (!recipe) return null

  // Siempre consultamos el máximo real vía la función SQL
  const calc = await calcularMaximoProduccion(recipeId)
  const max = calc.max_unidades
  const limitingNombre = calc.ingrediente_limitante

  if (unidades && unidades > 0) {
    // Validación local de la cantidad solicitada
    const validation = validateProduction(recipe, unidades)
    return {
      mode: 'validate',
      unidades,
      max,
      possible: validation.possible,
      items: validation.items,
      limitingNombre,
    }
  } else {
    // Desglose por ingrediente para el modo "máximo"
    const items = (recipe.receta_ingredientes || []).map(ri => {
      const ing = ri.ingredientes
      const possible = ri.cantidad > 0 ? Math.floor((ing?.stock ?? 0) / ri.cantidad) : Infinity
      return {
        nombre: ing?.nombre ?? '?',
        unidad: ing?.unidad ?? 'g',
        cantidadPorUnidad: ri.cantidad,
        stock: ing?.stock ?? 0,
        possible,
        isLimiting: ing?.id === calc.ingrediente_limitante_id,
      }
    })
    return {
      mode: 'max',
      max,
      limitingNombre,
      items,
    }
  }
}

// ─── Resumen para el dashboard ──────────────────────────────────
// Usa directamente v_capacidad_produccion (ya calculada en SQL),
// en vez de recorrer recetas en JS.
export async function dashboardSummary() {
  const filas = await getCapacidadProduccion()
  return filas.map(f => {
    const status = f.max_unidades === 0 ? 'danger' : f.max_unidades <= 3 ? 'warn' : 'ok'
    return {
      id: f.receta_id,
      nombre: f.receta,
      tipo: f.tipo,
      max: f.max_unidades,
      limitingNombre: f.ingrediente_limitante,
      status,
    }
  })
}
