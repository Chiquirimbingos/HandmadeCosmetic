# Cosmética Artesanal · v2.0

Sistema de inventario y producción con Vite + Supabase + autenticación.

---

## Instalación

```bash
cd Cosmetica
npm install
npm run dev
```

La app abre en http://localhost:5173

---

## Variables de entorno

El archivo `.env` ya tiene tus credenciales. Nunca lo subas a git.
Agrega esto a `.gitignore`:
```
.env
node_modules/
dist/
```

---

## Supabase: tablas y RLS

Ejecuta este SQL en tu proyecto Supabase (SQL Editor):

```sql
-- TABLA: ingredients
CREATE TABLE public.ingredients (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text NOT NULL,
  unit        text NOT NULL DEFAULT 'g',
  stock       numeric NOT NULL DEFAULT 0,
  min_stock   numeric NOT NULL DEFAULT 100,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- TABLA: recipes
CREATE TABLE public.recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  type        text NOT NULL,
  yield_qty   integer NOT NULL DEFAULT 1,
  created_at  timestamptz DEFAULT now()
);

-- TABLA: recipe_ingredients (relación many-to-many)
CREATE TABLE public.recipe_ingredients (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id     uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id uuid REFERENCES public.ingredients(id) ON DELETE RESTRICT,
  qty           numeric NOT NULL DEFAULT 0
);

-- ÍNDICES
CREATE INDEX ON public.recipe_ingredients(recipe_id);
CREATE INDEX ON public.recipe_ingredients(ingredient_id);

-- RLS: solo usuarios autenticados pueden leer y escribir
ALTER TABLE public.ingredients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all" ON public.ingredients
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON public.recipes
  FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "auth_all" ON public.recipe_ingredients
  FOR ALL USING (auth.role() = 'authenticated');
```

---

## Crear usuarios

En Supabase → Authentication → Users → "Add user"
Solo las personas que crees ahí podrán ingresar.

---

## Estructura del proyecto

```
Cosmetica/
├── .env                ← credenciales (NO subir a git)
├── package.json
├── vite.config.js
├── README.md
└── src/
    ├── index.html      ← entry point (= App.html)
    ├── App.html        ← HTML principal
    ├── main.js         ← orquesta todo: auth, nav, eventos
    ├── supabase.js     ← cliente Supabase (único lugar)
    ├── auth.js         ← login / logout / sesión
    ├── inventory.js    ← CRUD de ingredientes
    ├── recipes.js      ← CRUD de recetas + lógica de cálculo
    ├── simulator.js    ← simulador de producción
    └── styles.css      ← estilos globales
```
