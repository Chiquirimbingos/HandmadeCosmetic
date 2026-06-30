import './styles.css'
import { login, logout, getSession, onAuthChange } from './auth.js'
import {
  getIngredients, getIngredientsByCategory,
  addIngredient, updateIngredient, deleteIngredient,
  stockStatus,
} from './inventory.js'
import { getRecipes, addRecipe, deleteRecipe, calcMaxUnits, validateProduction } from './recipes.js'
import { loadRecipesForSimulator, getLoadedRecipes, simulate, dashboardSummary } from './simulator.js'

// ─── Estado global ────────────────────────────────────────────
let allIngredients = []
let currentStockCat = 'all'
let editIngId = null        // null = crear nuevo, string = editar existente
let recipeIngRows = []      // filas temporales del modal de receta

// ─── Toast ────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const c = document.getElementById('toast-container')
  const el = document.createElement('div')
  el.className = `toast ${type}`
  el.textContent = msg
  c.appendChild(el)
  setTimeout(() => el.remove(), 3000)
}

// ─── Navegación ───────────────────────────────────────────────
function nav(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  document.getElementById('page-' + page)?.classList.add('active')
  document.querySelector(`.nav-item[data-page="${page}"]`)?.classList.add('active')

  if (page === 'dashboard') buildDashboard()
  if (page === 'stock')     buildStockTable()
  if (page === 'recipes')   buildRecipes()
  if (page === 'simulate')  buildSimulator()
}

document.querySelectorAll('.nav-item[data-page]').forEach(el => {
  el.addEventListener('click', () => nav(el.dataset.page))
})

// ─── Auth ─────────────────────────────────────────────────────
const authScreen = document.getElementById('auth-screen')
const appScreen  = document.getElementById('app-screen')

function showApp(user) {
  authScreen.style.display = 'none'
  appScreen.classList.add('visible')
  document.getElementById('user-email-label').textContent = user.email
  loadAll()
}

function showLogin() {
  authScreen.style.display = 'flex'
  appScreen.classList.remove('visible')
}

document.getElementById('login-btn').addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  const errEl    = document.getElementById('auth-error')
  errEl.classList.remove('visible')

  if (!email || !password) {
    errEl.textContent = 'Ingresa tu correo y contraseña.'
    errEl.classList.add('visible')
    return
  }

  const btn = document.getElementById('login-btn')
  btn.disabled = true
  btn.textContent = 'Ingresando...'

  try {
    const user = await login(email, password)
    showApp(user)
  } catch (err) {
    errEl.textContent = 'Correo o contraseña incorrectos.'
    errEl.classList.add('visible')
  } finally {
    btn.disabled = false
    btn.textContent = 'Ingresar'
  }
})

// Enter en campos de login
document.getElementById('login-password').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('login-btn').click()
})

document.getElementById('logout-btn').addEventListener('click', async () => {
  await logout()
  showLogin()
})

// ─── Cargar todos los datos ───────────────────────────────────
async function loadAll() {
  try {
    allIngredients = await getIngredients()
    await loadRecipesForSimulator()
    buildDashboard()
  } catch (err) {
    toast('Error al cargar datos: ' + err.message, 'error')
  }
}

// ─── DASHBOARD ────────────────────────────────────────────────
async function buildDashboard() {
  // KPIs
  const totalIng    = allIngredients.length
  const criticals   = allIngredients.filter(i => stockStatus(i) === 'critical').length
  const lows        = allIngredients.filter(i => stockStatus(i) === 'low').length
  const recipes     = getLoadedRecipes()
  const summary     = dashboardSummary()
  const canProduce  = summary.filter(r => r.max > 0).length

  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi">
      <div class="label">Ingredientes</div>
      <div class="value">${totalIng}</div>
      <div class="sub">en inventario</div>
    </div>
    <div class="kpi ${criticals > 0 ? 'danger' : ''}">
      <div class="label">Sin stock</div>
      <div class="value">${criticals}</div>
      <div class="sub">ingrediente${criticals !== 1 ? 's' : ''} crítico${criticals !== 1 ? 's' : ''}</div>
    </div>
    <div class="kpi ${lows > 0 ? 'warn' : ''}">
      <div class="label">Stock bajo</div>
      <div class="value">${lows}</div>
      <div class="sub">bajo el mínimo</div>
    </div>
    <div class="kpi">
      <div class="label">Recetas activas</div>
      <div class="value">${canProduce}<span style="font-size:16px;color:var(--text-muted)">/${recipes.length}</span></div>
      <div class="sub">con stock disponible</div>
    </div>
  `

  // Alertas
  const alertZone = document.getElementById('alert-zone')
  alertZone.innerHTML = ''
  if (criticals > 0) {
    alertZone.innerHTML += `<div class="alert alert-danger">
      ⚠ ${criticals} ingrediente${criticals !== 1 ? 's' : ''} sin stock suficiente. Revisa el inventario.
    </div>`
  }
  if (lows > 0) {
    alertZone.innerHTML += `<div class="alert alert-warn">
      ⚡ ${lows} ingrediente${lows !== 1 ? 's están' : ' está'} bajo el mínimo recomendado.
    </div>`
  }

  // Tabla de capacidad
  const tbody = document.getElementById('dashboard-table')
  if (summary.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Sin recetas registradas</td></tr>'
    return
  }
  tbody.innerHTML = summary.map(r => {
    const badgeCls = r.status === 'ok' ? 'badge-ok' : r.status === 'warn' ? 'badge-low' : 'badge-critical'
    const label    = r.status === 'ok' ? 'OK' : r.status === 'warn' ? 'Stock bajo' : 'Sin stock'
    return `<tr>
      <td class="fw-600">${r.name}</td>
      <td><span class="badge badge-type">${r.type}</span></td>
      <td class="fw-600">${r.max}</td>
      <td>${r.limitingName ? `<span style="color:var(--warn)">${r.limitingName}</span>` : '—'}</td>
      <td><span class="badge ${badgeCls}">${label}</span></td>
    </tr>`
  }).join('')
}

// ─── INVENTARIO ───────────────────────────────────────────────
async function buildStockTable(cat = currentStockCat) {
  currentStockCat = cat
  const tbody = document.getElementById('stock-table')
  tbody.innerHTML = '<tr><td colspan="7" class="loading"><div class="spinner"></div>Cargando...</td></tr>'

  try {
    const list = cat === 'all' ? allIngredients : allIngredients.filter(i => i.category === cat)

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">Sin ingredientes en esta categoría</td></tr>'
      return
    }

    tbody.innerHTML = list.map(ing => {
      const status = stockStatus(ing)
      const ratio  = ing.min_stock > 0 ? Math.min(ing.stock / ing.min_stock, 1) : 1
      const pct    = Math.round(ratio * 100)
      const barCls = status === 'ok' ? 'green' : status === 'low' ? 'amber' : 'red'
      const badgeCls = status === 'ok' ? 'badge-ok' : status === 'low' ? 'badge-low' : 'badge-critical'
      const statusLabel = status === 'ok' ? 'OK' : status === 'low' ? 'Bajo' : 'Crítico'
      const unitBadge = ing.unit === 'ml' ? 'badge-ml' : 'badge-g'

      return `<tr>
        <td class="fw-600">${ing.name}</td>
        <td><span class="badge badge-type">${ing.category}</span></td>
        <td>${ing.stock} <span class="badge ${unitBadge}">${ing.unit}</span></td>
        <td>${ing.min_stock} ${ing.unit}</td>
        <td><span class="badge ${badgeCls}">${statusLabel}</span></td>
        <td>
          <div class="flex items-center gap-2">
            <div class="bar-wrap"><div class="bar-fill ${barCls}" style="width:${pct}%"></div></div>
            <span class="text-muted text-sm">${pct}%</span>
          </div>
        </td>
        <td>
          <div class="flex gap-2">
            <button class="btn text-sm" style="padding:.25rem .6rem" onclick="openEditIngredient('${ing.id}')">Editar</button>
            <button class="btn btn-danger text-sm" style="padding:.25rem .6rem" onclick="confirmDeleteIngredient('${ing.id}', '${ing.name.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`
    }).join('')
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger);padding:1rem">${err.message}</td></tr>`
  }
}

// Tabs de categoría
document.getElementById('stock-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab')
  if (!tab) return
  document.querySelectorAll('#stock-tabs .tab').forEach(t => t.classList.remove('active'))
  tab.classList.add('active')
  buildStockTable(tab.dataset.cat)
})

// ─── MODAL INGREDIENTE ────────────────────────────────────────
function openAddIngredient() {
  editIngId = null
  document.getElementById('modal-ing-title').textContent = 'Agregar ingrediente'
  ;['ing-name','ing-stock','ing-min'].forEach(id => document.getElementById(id).value = '')
  document.getElementById('ing-cat').value  = 'Aceites'
  document.getElementById('ing-unit').value = 'g'
  document.getElementById('modal-ingredient').classList.add('open')
}

window.openEditIngredient = async function(id) {
  const ing = allIngredients.find(i => i.id === id)
  if (!ing) return
  editIngId = id
  document.getElementById('modal-ing-title').textContent = 'Editar ingrediente'
  document.getElementById('ing-name').value  = ing.name
  document.getElementById('ing-cat').value   = ing.category
  document.getElementById('ing-unit').value  = ing.unit
  document.getElementById('ing-stock').value = ing.stock
  document.getElementById('ing-min').value   = ing.min_stock
  document.getElementById('modal-ingredient').classList.add('open')
}

window.confirmDeleteIngredient = async function(id, name) {
  if (!confirm(`¿Eliminar "${name}"? Esta acción no se puede deshacer.`)) return
  try {
    await deleteIngredient(id)
    allIngredients = allIngredients.filter(i => i.id !== id)
    buildStockTable()
    buildDashboard()
    toast(`"${name}" eliminado`)
  } catch (err) {
    toast('Error al eliminar: ' + err.message, 'error')
  }
}

document.getElementById('btn-add-ingredient').addEventListener('click', openAddIngredient)

document.getElementById('btn-save-ing').addEventListener('click', async () => {
  const name      = document.getElementById('ing-name').value.trim()
  const category  = document.getElementById('ing-cat').value
  const unit      = document.getElementById('ing-unit').value
  const stock     = parseFloat(document.getElementById('ing-stock').value) || 0
  const min_stock = parseFloat(document.getElementById('ing-min').value) || 100

  if (!name) { toast('Ingresa un nombre para el ingrediente.', 'error'); return }

  const btn = document.getElementById('btn-save-ing')
  btn.disabled = true

  try {
    if (editIngId) {
      const updated = await updateIngredient(editIngId, { name, category, unit, stock, min_stock })
      allIngredients = allIngredients.map(i => i.id === editIngId ? updated : i)
      toast('Ingrediente actualizado')
    } else {
      const created = await addIngredient({ name, category, unit, stock, min_stock })
      allIngredients.push(created)
      toast('Ingrediente agregado')
    }
    closeModal('modal-ingredient')
    buildStockTable()
    buildDashboard()
  } catch (err) {
    toast('Error al guardar: ' + err.message, 'error')
  } finally {
    btn.disabled = false
  }
})

document.getElementById('btn-cancel-ing').addEventListener('click', () => closeModal('modal-ingredient'))

// ─── RECETAS ──────────────────────────────────────────────────
async function buildRecipes() {
  const grid = document.getElementById('recipes-grid')
  grid.innerHTML = '<div class="loading"><div class="spinner"></div>Cargando recetas...</div>'

  try {
    const recipes = getLoadedRecipes()
    if (recipes.length === 0) {
      grid.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:2rem 0">Sin recetas registradas. Crea la primera con el botón de arriba.</div>'
      return
    }

    grid.innerHTML = recipes.map(r => {
      const { max, limiting } = calcMaxUnits(r)
      const maxCls = max === 0 ? 'var(--danger)' : max <= 3 ? 'var(--warn)' : 'var(--accent-dark)'
      const ingList = (r.recipe_ingredients || [])
        .map(ri => `${ri.ingredients?.name ?? '?'} (${ri.qty} ${ri.ingredients?.unit ?? 'g'})`)
        .join(', ')

      return `<div class="recipe-card" onclick="navToSimulate('${r.id}')">
        <h4>${r.name}</h4>
        <div class="meta"><span class="badge badge-type">${r.type}</span></div>
        <div class="max-units" style="color:${maxCls}">${max} <span style="font-size:13px;font-weight:400">unidades</span></div>
        ${limiting ? `<div class="limiting-text">⚠ Limitado por ${limiting.name}</div>` : ''}
        <div class="recipe-ing-list">${ingList || 'Sin ingredientes'}</div>
        <div class="flex gap-2 mt-2">
          <button class="btn btn-danger text-sm" style="padding:.2rem .5rem" onclick="event.stopPropagation();confirmDeleteRecipe('${r.id}','${r.name.replace(/'/g,"\\'")}')">Eliminar</button>
        </div>
      </div>`
    }).join('')
  } catch (err) {
    grid.innerHTML = `<div style="color:var(--danger)">${err.message}</div>`
  }
}

window.navToSimulate = function(recipeId) {
  nav('simulate')
  setTimeout(() => {
    const sel = document.getElementById('sim-recipe')
    sel.value = recipeId
    sel.dispatchEvent(new Event('change'))
  }, 50)
}

window.confirmDeleteRecipe = async function(id, name) {
  if (!confirm(`¿Eliminar la receta "${name}"?`)) return
  try {
    await deleteRecipe(id)
    await loadRecipesForSimulator()
    buildRecipes()
    buildDashboard()
    toast(`"${name}" eliminada`)
  } catch (err) {
    toast('Error al eliminar: ' + err.message, 'error')
  }
}

// ─── MODAL RECETA ─────────────────────────────────────────────
document.getElementById('btn-add-recipe').addEventListener('click', () => {
  document.getElementById('rec-name').value  = ''
  document.getElementById('rec-yield').value = ''
  recipeIngRows = []
  renderRecipeIngRows()
  document.getElementById('modal-recipe').classList.add('open')
})

document.getElementById('btn-add-recipe-ing').addEventListener('click', () => {
  recipeIngRows.push({ ingId: allIngredients[0]?.id || '', qty: 0 })
  renderRecipeIngRows()
})

function renderRecipeIngRows() {
  const container = document.getElementById('recipe-ings-list')
  container.innerHTML = recipeIngRows.map((row, idx) => `
    <div style="display:grid;grid-template-columns:1fr 120px 36px;gap:6px;align-items:center">
      <select class="form-control" onchange="recipeIngRows[${idx}].ingId=this.value">
        ${allIngredients.map(i => `<option value="${i.id}" ${i.id === row.ingId ? 'selected' : ''}>${i.name}</option>`).join('')}
      </select>
      <div style="display:flex;gap:4px;align-items:center">
        <input type="number" class="form-control" style="width:70px" placeholder="qty"
          value="${row.qty || ''}" oninput="recipeIngRows[${idx}].qty=parseFloat(this.value)||0">
        <span class="text-muted text-sm">${allIngredients.find(i => i.id === row.ingId)?.unit || 'g'}</span>
      </div>
      <button class="btn" style="padding:.25rem .4rem" onclick="recipeIngRows.splice(${idx},1);renderRecipeIngRows()">✕</button>
    </div>
  `).join('')
}

document.getElementById('btn-save-recipe').addEventListener('click', async () => {
  const name      = document.getElementById('rec-name').value.trim()
  const type      = document.getElementById('rec-type').value
  const yield_qty = parseInt(document.getElementById('rec-yield').value) || 1

  if (!name) { toast('Ingresa un nombre para la receta.', 'error'); return }
  if (recipeIngRows.length === 0) { toast('Agrega al menos un ingrediente.', 'error'); return }

  const btn = document.getElementById('btn-save-recipe')
  btn.disabled = true

  try {
    await addRecipe({
      name, type, yield_qty,
      ingredientRows: recipeIngRows.map(r => ({ ingredient_id: r.ingId, qty: r.qty })),
    })
    await loadRecipesForSimulator()
    closeModal('modal-recipe')
    buildRecipes()
    buildDashboard()
    toast('Receta guardada')
  } catch (err) {
    toast('Error al guardar: ' + err.message, 'error')
  } finally {
    btn.disabled = false
  }
})

document.getElementById('btn-cancel-recipe').addEventListener('click', () => closeModal('modal-recipe'))

// ─── SIMULADOR ────────────────────────────────────────────────
function buildSimulator() {
  const sel = document.getElementById('sim-recipe')
  const current = sel.value
  const recipes = getLoadedRecipes()
  sel.innerHTML = '<option value="">Selecciona una receta...</option>' +
    recipes.map(r => `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${r.name}</option>`).join('')
}

document.getElementById('sim-recipe').addEventListener('change', runSimulate)
document.getElementById('sim-units').addEventListener('input',  runSimulate)

function runSimulate() {
  const recipeId = document.getElementById('sim-recipe').value
  const units    = parseInt(document.getElementById('sim-units').value) || 0
  const resultEl = document.getElementById('sim-result')
  const breakdown = document.getElementById('breakdown-card')

  if (!recipeId) { resultEl.innerHTML = ''; breakdown.classList.add('hidden'); return }

  const result = simulate(recipeId, units > 0 ? units : null)
  if (!result) return

  if (result.mode === 'validate') {
    const cls  = result.possible ? 'ok' : 'danger'
    const icon = result.possible ? '✓' : '✗'
    resultEl.innerHTML = `<div class="result-box result-${cls}">
      <div class="result-num">${icon} ${result.possible ? 'Producción posible' : 'Sin stock suficiente'}</div>
      <div class="result-label">${result.possible
        ? `Puedes fabricar ${units} unidades. Capacidad restante: ${result.max - units} unidades.`
        : `Solo puedes fabricar ${result.max} unidades. Revisa los ingredientes marcados en rojo.`
      }</div>
    </div>`
    document.getElementById('ing-breakdown').innerHTML = result.items.map(it => `
      <div class="ing-row ${it.ok ? '' : 'missing'}">
        <span>${it.name}</span>
        <span>
          Necesitas: <strong>${it.needed} ${it.unit}</strong> &nbsp;·&nbsp;
          Stock: <span class="${it.ok ? 'ing-ok-text' : 'ing-bad-text'}">${it.available} ${it.unit}</span>
          ${!it.ok ? ` &nbsp;·&nbsp; <span class="ing-bad-text">Falta: ${it.deficit.toFixed(1)} ${it.unit}</span>` : ''}
        </span>
      </div>`).join('')
  } else {
    const cls = result.max > 5 ? 'ok' : result.max > 0 ? 'warn' : 'danger'
    resultEl.innerHTML = `<div class="result-box result-${cls}">
      <div class="result-num">${result.max} ${result.max === 1 ? 'unidad' : 'unidades'}</div>
      <div class="result-label">Máximo producible con el stock actual</div>
      ${result.limiting ? `<div class="limiting-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        Ingrediente limitante: <strong>${result.limiting.name}</strong>
      </div>` : ''}
    </div>`
    document.getElementById('ing-breakdown').innerHTML = result.items.map(it => `
      <div class="ing-row ${it.isLimiting ? 'limiting' : ''}">
        <span ${it.isLimiting ? 'style="font-weight:600"' : ''}>${it.name}${it.isLimiting ? ' ⚠' : ''}</span>
        <span>Por unidad: ${it.qtyPerUnit} ${it.unit} &nbsp;·&nbsp; Permite: <strong>${it.possible} u.</strong> &nbsp;·&nbsp; Stock: ${it.stock} ${it.unit}</span>
      </div>`).join('')
  }

  breakdown.classList.remove('hidden')
}

// ─── UTILS ────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('open') }

document.querySelectorAll('.modal-bg').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open') })
})

// Exponer funciones necesarias en onclick="" del HTML
window.recipeIngRows = recipeIngRows
window.renderRecipeIngRows = renderRecipeIngRows

// ─── INIT ─────────────────────────────────────────────────────
;(async () => {
  const session = await getSession()
  if (session) {
    showApp(session.user)
  } else {
    showLogin()
  }

  // Escuchar cambios de sesión en tiempo real
  onAuthChange((event, session) => {
    if (event === 'SIGNED_IN' && session)  showApp(session.user)
    if (event === 'SIGNED_OUT')            showLogin()
  })
})()
