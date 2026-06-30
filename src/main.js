import './styles.css'
import { login, logout, getSession, onAuthChange } from './auth.js'
import {
  getIngredients, getCategorias,
  addIngredient, updateIngredient, deleteIngredient,
  stockStatus,
} from './inventory.js'
import {
  addRecipe, deleteRecipe, ejecutarProduccion,
} from './recipes.js'
import {
  loadRecipesForSimulator, getLoadedRecipes,
  simulate, dashboardSummary,
} from './simulator.js'

// ─── Estado global ────────────────────────────────────────────
let allIngredients = []   // filas de v_inventario
let categorias = []       // filas de tabla categorias
let currentStockCat = 'all'
let editIngId = null
let recipeIngRows = []

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
    ;[allIngredients, categorias] = await Promise.all([
      getIngredients(),
      getCategorias(),
    ])
    await loadRecipesForSimulator()
    buildDashboard()
    buildStockTabs()
  } catch (err) {
    toast('Error al cargar datos: ' + err.message, 'error')
  }
}

// Construye las pestañas de categoría dinámicamente desde la BD
function buildStockTabs() {
  const tabsEl = document.getElementById('stock-tabs')
  tabsEl.innerHTML = `<div class="tab active" data-cat="all">Todos</div>` +
    categorias.map(c => `<div class="tab" data-cat="${c.nombre}">${c.nombre}</div>`).join('')
}

// ─── DASHBOARD ────────────────────────────────────────────────
async function buildDashboard() {
  const totalIng   = allIngredients.length
  const criticals  = allIngredients.filter(i => stockStatus(i) === 'critical').length
  const lows       = allIngredients.filter(i => stockStatus(i) === 'low').length

  let summary = []
  try {
    summary = await dashboardSummary()
  } catch (err) {
    toast('Error al calcular capacidad: ' + err.message, 'error')
  }
  const canProduce = summary.filter(r => r.max > 0).length

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
      <div class="value">${canProduce}<span style="font-size:16px;color:var(--text-muted)">/${summary.length}</span></div>
      <div class="sub">con stock disponible</div>
    </div>
  `

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

  const tbody = document.getElementById('dashboard-table')
  if (summary.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">Sin recetas registradas</td></tr>'
    return
  }
  tbody.innerHTML = summary.map(r => {
    const badgeCls = r.status === 'ok' ? 'badge-ok' : r.status === 'warn' ? 'badge-low' : 'badge-critical'
    const label    = r.status === 'ok' ? 'OK' : r.status === 'warn' ? 'Stock bajo' : 'Sin stock'
    return `<tr>
      <td class="fw-600">${r.nombre}</td>
      <td><span class="badge badge-type">${r.tipo}</span></td>
      <td class="fw-600">${r.max}</td>
      <td>${r.limitingNombre ? `<span style="color:var(--warn)">${r.limitingNombre}</span>` : '—'}</td>
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
    const list = cat === 'all' ? allIngredients : allIngredients.filter(i => i.categoria === cat)

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">Sin ingredientes en esta categoría</td></tr>'
      return
    }

    tbody.innerHTML = list.map(ing => {
      const status = stockStatus(ing)
      const ratio  = ing.stock_minimo > 0 ? Math.min(ing.stock / ing.stock_minimo, 1) : 1
      const pct    = Math.round(ratio * 100)
      const barCls = status === 'ok' ? 'green' : status === 'low' ? 'amber' : 'red'
      const badgeCls = status === 'ok' ? 'badge-ok' : status === 'low' ? 'badge-low' : 'badge-critical'
      const statusLabel = status === 'ok' ? 'OK' : status === 'low' ? 'Bajo' : 'Crítico'
      const unitBadge = ing.unidad === 'ml' ? 'badge-ml' : 'badge-g'

      return `<tr>
        <td class="fw-600">${ing.nombre}</td>
        <td><span class="badge badge-type">${ing.categoria ?? '—'}</span></td>
        <td>${ing.stock} <span class="badge ${unitBadge}">${ing.unidad}</span></td>
        <td>${ing.stock_minimo} ${ing.unidad}</td>
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
            <button class="btn btn-danger text-sm" style="padding:.25rem .6rem" onclick="confirmDeleteIngredient('${ing.id}', '${ing.nombre.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`
    }).join('')
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:var(--danger);padding:1rem">${err.message}</td></tr>`
  }
}

document.getElementById('stock-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab')
  if (!tab) return
  document.querySelectorAll('#stock-tabs .tab').forEach(t => t.classList.remove('active'))
  tab.classList.add('active')
  buildStockTable(tab.dataset.cat)
})

// ─── MODAL INGREDIENTE ────────────────────────────────────────
function fillCategoriaSelect(selectedId = null) {
  const sel = document.getElementById('ing-cat')
  sel.innerHTML = categorias.map(c =>
    `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.nombre}</option>`
  ).join('')
}

function openAddIngredient() {
  editIngId = null
  document.getElementById('modal-ing-title').textContent = 'Agregar ingrediente'
  ;['ing-name','ing-stock','ing-min'].forEach(id => document.getElementById(id).value = '')
  fillCategoriaSelect(categorias[0]?.id ?? null)
  document.getElementById('ing-unit').value = 'g'
  document.getElementById('modal-ingredient').classList.add('open')
}

window.openEditIngredient = async function(id) {
  const ing = allIngredients.find(i => i.id === id)
  if (!ing) return
  editIngId = id
  document.getElementById('modal-ing-title').textContent = 'Editar ingrediente'
  document.getElementById('ing-name').value  = ing.nombre
  const categoriaActual = categorias.find(c => c.nombre === ing.categoria)
  fillCategoriaSelect(categoriaActual?.id ?? null)
  document.getElementById('ing-unit').value  = ing.unidad
  document.getElementById('ing-stock').value = ing.stock
  document.getElementById('ing-min').value   = ing.stock_minimo
  document.getElementById('modal-ingredient').classList.add('open')
}

window.confirmDeleteIngredient = async function(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`)) return
  try {
    await deleteIngredient(id)
    allIngredients = allIngredients.filter(i => i.id !== id)
    buildStockTable()
    buildDashboard()
    toast(`"${nombre}" eliminado`)
  } catch (err) {
    toast('Error al eliminar: ' + err.message, 'error')
  }
}

document.getElementById('btn-add-ingredient').addEventListener('click', openAddIngredient)

document.getElementById('btn-save-ing').addEventListener('click', async () => {
  const nombre        = document.getElementById('ing-name').value.trim()
  const categoria_id  = parseInt(document.getElementById('ing-cat').value)
  const unidad        = document.getElementById('ing-unit').value
  const stock         = parseFloat(document.getElementById('ing-stock').value) || 0
  const stock_minimo  = parseFloat(document.getElementById('ing-min').value) || 100

  if (!nombre) { toast('Ingresa un nombre para el ingrediente.', 'error'); return }

  const btn = document.getElementById('btn-save-ing')
  btn.disabled = true

  try {
    if (editIngId) {
      await updateIngredient(editIngId, { nombre, categoria_id, unidad, stock, stock_minimo })
      toast('Ingrediente actualizado')
    } else {
      await addIngredient({ nombre, categoria_id, unidad, stock, stock_minimo })
      toast('Ingrediente agregado')
    }
    allIngredients = await getIngredients()
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

    // Pedimos el máximo de cada receta vía la función SQL (en paralelo)
    const { calcularMaximoProduccion } = await import('./recipes.js')
    const calculos = await Promise.all(recipes.map(r => calcularMaximoProduccion(r.id)))

    grid.innerHTML = recipes.map((r, idx) => {
      const calc = calculos[idx]
      const max = calc.max_unidades
      const limitanteNombre = calc.ingrediente_limitante
      const maxCls = max === 0 ? 'var(--danger)' : max <= 3 ? 'var(--warn)' : 'var(--accent-dark)'
      const ingList = (r.receta_ingredientes || [])
        .map(ri => `${ri.ingredientes?.nombre ?? '?'} (${ri.cantidad} ${ri.ingredientes?.unidad ?? 'g'})`)
        .join(', ')

      return `<div class="recipe-card" onclick="navToSimulate('${r.id}')">
        <h4>${r.nombre}</h4>
        <div class="meta"><span class="badge badge-type">${r.tipo}</span></div>
        <div class="max-units" style="color:${maxCls}">${max} <span style="font-size:13px;font-weight:400">unidades</span></div>
        ${limitanteNombre ? `<div class="limiting-text">⚠ Limitado por ${limitanteNombre}</div>` : ''}
        <div class="recipe-ing-list">${ingList || 'Sin ingredientes'}</div>
        <div class="flex gap-2 mt-2">
          <button class="btn text-sm" style="padding:.2rem .5rem" onclick="event.stopPropagation();openProduceModal('${r.id}','${r.nombre.replace(/'/g,"\\'")}',${max})">Producir</button>
          <button class="btn btn-danger text-sm" style="padding:.2rem .5rem" onclick="event.stopPropagation();confirmDeleteRecipe('${r.id}','${r.nombre.replace(/'/g,"\\'")}')">Eliminar</button>
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

window.confirmDeleteRecipe = async function(id, nombre) {
  if (!confirm(`¿Eliminar la receta "${nombre}"?`)) return
  try {
    await deleteRecipe(id)
    await loadRecipesForSimulator()
    buildRecipes()
    buildDashboard()
    toast(`"${nombre}" eliminada`)
  } catch (err) {
    toast('Error al eliminar: ' + err.message, 'error')
  }
}

// ─── Producción real (usa ejecutar_produccion vía RPC) ─────────
window.openProduceModal = function(recipeId, nombre, max) {
  if (max <= 0) { toast(`Sin stock suficiente para producir "${nombre}".`, 'error'); return }
  const unidades = prompt(`¿Cuántas unidades de "${nombre}" deseas producir? (máximo ${max})`, '1')
  if (!unidades) return
  const n = parseInt(unidades)
  if (!n || n <= 0) { toast('Ingresa un número válido de unidades.', 'error'); return }
  if (n > max) { toast(`Máximo producible: ${max} unidades.`, 'error'); return }
  ejecutarProduccionUI(recipeId, n, nombre)
}

async function ejecutarProduccionUI(recipeId, unidades, nombre) {
  try {
    await ejecutarProduccion(recipeId, unidades, `Producción desde panel · ${new Date().toLocaleDateString('es-CL')}`)
    toast(`Producción registrada: ${unidades} unidad(es) de "${nombre}"`)
    allIngredients = await getIngredients()
    await loadRecipesForSimulator()
    buildRecipes()
    buildStockTable()
    buildDashboard()
  } catch (err) {
    toast('Error al producir: ' + err.message, 'error')
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
        ${allIngredients.map(i => `<option value="${i.id}" ${i.id === row.ingId ? 'selected' : ''}>${i.nombre}</option>`).join('')}
      </select>
      <div style="display:flex;gap:4px;align-items:center">
        <input type="number" class="form-control" style="width:70px" placeholder="qty"
          value="${row.qty || ''}" oninput="recipeIngRows[${idx}].qty=parseFloat(this.value)||0">
        <span class="text-muted text-sm">${allIngredients.find(i => i.id === row.ingId)?.unidad || 'g'}</span>
      </div>
      <button class="btn" style="padding:.25rem .4rem" onclick="recipeIngRows.splice(${idx},1);renderRecipeIngRows()">✕</button>
    </div>
  `).join('')
}

document.getElementById('btn-save-recipe').addEventListener('click', async () => {
  const nombre        = document.getElementById('rec-name').value.trim()
  const tipo          = document.getElementById('rec-type').value
  const rendimiento   = parseInt(document.getElementById('rec-yield').value) || 1

  if (!nombre) { toast('Ingresa un nombre para la receta.', 'error'); return }
  if (recipeIngRows.length === 0) { toast('Agrega al menos un ingrediente.', 'error'); return }

  const btn = document.getElementById('btn-save-recipe')
  btn.disabled = true

  try {
    await addRecipe({
      nombre, tipo, rendimiento, unidad_salida: 'unidad',
      ingredientRows: recipeIngRows.map(r => ({ ingrediente_id: r.ingId, cantidad: r.qty })),
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
    recipes.map(r => `<option value="${r.id}" ${r.id === current ? 'selected' : ''}>${r.nombre}</option>`).join('')
}

document.getElementById('sim-recipe').addEventListener('change', runSimulate)
document.getElementById('sim-units').addEventListener('input',  runSimulate)

async function runSimulate() {
  const recipeId = document.getElementById('sim-recipe').value
  const unidades = parseInt(document.getElementById('sim-units').value) || 0
  const resultEl = document.getElementById('sim-result')
  const breakdown = document.getElementById('breakdown-card')

  if (!recipeId) { resultEl.innerHTML = ''; breakdown.classList.add('hidden'); return }

  resultEl.innerHTML = '<div class="loading"><div class="spinner"></div>Calculando...</div>'

  let result
  try {
    result = await simulate(recipeId, unidades > 0 ? unidades : null)
  } catch (err) {
    resultEl.innerHTML = `<div class="alert alert-danger">${err.message}</div>`
    return
  }
  if (!result) return

  if (result.mode === 'validate') {
    const cls  = result.possible ? 'ok' : 'danger'
    const icon = result.possible ? '✓' : '✗'
    resultEl.innerHTML = `<div class="result-box result-${cls}">
      <div class="result-num">${icon} ${result.possible ? 'Producción posible' : 'Sin stock suficiente'}</div>
      <div class="result-label">${result.possible
        ? `Puedes fabricar ${unidades} unidades. Capacidad restante: ${result.max - unidades} unidades.`
        : `Solo puedes fabricar ${result.max} unidades. Revisa los ingredientes marcados en rojo.`
      }</div>
    </div>`
    document.getElementById('ing-breakdown').innerHTML = result.items.map(it => `
      <div class="ing-row ${it.ok ? '' : 'missing'}">
        <span>${it.nombre}</span>
        <span>
          Necesitas: <strong>${it.needed} ${it.unidad}</strong> &nbsp;·&nbsp;
          Stock: <span class="${it.ok ? 'ing-ok-text' : 'ing-bad-text'}">${it.available} ${it.unidad}</span>
          ${!it.ok ? ` &nbsp;·&nbsp; <span class="ing-bad-text">Falta: ${it.deficit.toFixed(1)} ${it.unidad}</span>` : ''}
        </span>
      </div>`).join('')
  } else {
    const cls = result.max > 5 ? 'ok' : result.max > 0 ? 'warn' : 'danger'
    resultEl.innerHTML = `<div class="result-box result-${cls}">
      <div class="result-num">${result.max} ${result.max === 1 ? 'unidad' : 'unidades'}</div>
      <div class="result-label">Máximo producible con el stock actual</div>
      ${result.limitingNombre ? `<div class="limiting-row">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        Ingrediente limitante: <strong>${result.limitingNombre}</strong>
      </div>` : ''}
    </div>`
    document.getElementById('ing-breakdown').innerHTML = result.items.map(it => `
      <div class="ing-row ${it.isLimiting ? 'limiting' : ''}">
        <span ${it.isLimiting ? 'style="font-weight:600"' : ''}>${it.nombre}${it.isLimiting ? ' ⚠' : ''}</span>
        <span>Por unidad: ${it.cantidadPorUnidad} ${it.unidad} &nbsp;·&nbsp; Permite: <strong>${it.possible} u.</strong> &nbsp;·&nbsp; Stock: ${it.stock} ${it.unidad}</span>
      </div>`).join('')
  }

  breakdown.classList.remove('hidden')
}

// ─── UTILS ────────────────────────────────────────────────────
function closeModal(id) { document.getElementById(id).classList.remove('open') }

document.querySelectorAll('.modal-bg').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open') })
})

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

  onAuthChange((event, session) => {
    if (event === 'SIGNED_IN' && session)  showApp(session.user)
    if (event === 'SIGNED_OUT')            showLogin()
  })
})()
