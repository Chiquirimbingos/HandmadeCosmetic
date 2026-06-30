# Cosmética Artesanal · v2.0

Sistema de inventario y producción con Vite + Supabase + autenticación.

Esta versión está adaptada al esquema **real** que ya está cargado en Supabase
(`cosmetica_schema.sql`), en español, con vistas y funciones SQL que hacen
los cálculos pesados en la base de datos.

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

El archivo `.env` ya tiene tus credenciales reales. Nunca lo subas a git
(`.gitignore` ya lo excluye).

---

## Esquema de base de datos

**No es necesario ejecutar ningún SQL nuevo.** El esquema ya está cargado
en tu proyecto Supabase a partir de `cosmetica_schema.sql`, que incluye:

- Tablas: `categorias`, `ingredientes`, `recetas`, `receta_ingredientes`,
  `movimientos_stock`, `ordenes_produccion`
- Vista `v_inventario`: inventario con estado de stock ya calculado
  (`sin_stock`, `critico`, `bajo`, `ok`)
- Vista `v_capacidad_produccion`: capacidad máxima de cada receta, ya resuelta
- Función `calcular_maximo_produccion(p_receta_id)`: calcula cuántas unidades
  se pueden fabricar de una receta según el stock actual
- Función `ejecutar_produccion(p_receta_id, p_unidades, p_nota)`: valida
  capacidad, descuenta stock y registra el movimiento + la orden de
  producción, todo en una sola transacción
- RLS habilitado en todas las tablas: solo usuarios autenticados pueden
  leer y escribir

El código JS (`inventory.js`, `recipes.js`, `simulator.js`) consume estas
vistas y funciones directamente vía Supabase, en vez de reimplementar la
lógica de cálculo en el cliente.

### Pendiente: ingredientes por receta

El script SQL dejó las 4 recetas de ejemplo creadas (`Jabón de oliva
clásico`, `Jabón exfoliante de café`, `Jabón arcilla & lavanda`, `Champú
sólido de romero`) pero **sin** sus filas en `receta_ingredientes`
(quedaron comentadas en el script). Puedes cargarlas:

- Desde la app, usando el botón "Editar" en cada receta (próxima mejora), o
- Directamente en Supabase con un patrón como:

```sql
INSERT INTO receta_ingredientes (receta_id, ingrediente_id, cantidad)
SELECT r.id, i.id, 350
FROM recetas r, ingredientes i
WHERE r.nombre = 'Jabón de oliva clásico' AND i.nombre = 'Aceite de oliva';
```

Mientras una receta no tenga ingredientes asociados, su capacidad de
producción será 0.

---

## Crear usuarios

En Supabase → Authentication → Users → "Add user"
Solo las personas que crees ahí podrán ingresar.

---

## Producción real

En la pestaña **Recetas**, el botón "Producir" llama a la función SQL
`ejecutar_produccion()`. Esto:

1. Valida que haya stock suficiente (usando `calcular_maximo_produccion`)
2. Descuenta el stock de cada ingrediente usado
3. Crea una fila en `ordenes_produccion` con estado `completada`
4. Registra el movimiento en `movimientos_stock` con trazabilidad completa

Esta es una acción real e irreversible sobre el inventario (no es una
simulación). El **Simulador** sí es de solo lectura: nunca toca la base.

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
    ├── inventory.js    ← lee/escribe sobre v_inventario y categorias
    ├── recipes.js      ← recetas + RPC a calcular_maximo_produccion
    │                     y ejecutar_produccion
    ├── simulator.js     ← simulador, apoyado en RPC y v_capacidad_produccion
    └── styles.css       ← estilos globales
```

---

## Mapeo de nombres (por si extiendes el código)

| Concepto         | Tabla/Vista real        | Campo                          |
|-------------------|--------------------------|---------------------------------|
| Ingrediente       | `ingredientes` / `v_inventario` | `nombre`, `stock`, `stock_minimo`, `unidad`, `categoria_id`/`categoria` |
| Categoría         | `categorias`             | `id`, `nombre`                 |
| Receta            | `recetas`                | `nombre`, `tipo`, `rendimiento`, `unidad_salida` |
| Receta-Ingrediente| `receta_ingredientes`    | `receta_id`, `ingrediente_id`, `cantidad` |
| Movimiento        | `movimientos_stock`      | `tipo`, `cantidad`, `nota`     |
| Orden producción  | `ordenes_produccion`     | `unidades`, `estado`           |
