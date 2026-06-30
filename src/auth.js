import { supabase } from './supabase.js'

// ─── Iniciar sesión ───────────────────────────────────────────
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.user
}

// ─── Cerrar sesión ────────────────────────────────────────────
export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// ─── Obtener sesión activa ────────────────────────────────────
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ─── Obtener usuario actual ───────────────────────────────────
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// ─── Escuchar cambios de autenticación ───────────────────────
// callback recibe: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED'
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session)
  })
}
