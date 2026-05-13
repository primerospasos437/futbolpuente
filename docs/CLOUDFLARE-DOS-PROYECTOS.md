# Dos sitios en Cloudflare (futbol-prueba vs futbolpuente)

Cada proyecto en **Workers & Pages** es independiente:

| Proyecto        | Repo típico              | Variables de entorno |
|----------------|--------------------------|-------------------------|
| `futbol-prueba` | `Futbol-prueba`          | Las suyas (las que ya te funcionan) |
| `futbolpuente`  | `futbolpuente`           | **Otras**: hay que copiarlas o corregirlas |

Si **futbol-prueba** anda y **futbolpuente** no (o el build falla), casi siempre es porque en **futbolpuente** las variables **no son las mismas** que en el que funciona, o siguen apuntando a `http://127.0.0.1:54321`.

## Cómo alinear futbolpuente con lo que ya funciona

1. Cloudflare → proyecto **`futbol-prueba`** (el que anda) → **Settings** → **Environment variables**.  
   Anotá (o copiá) **exactamente**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

2. Cloudflare → proyecto **`futbolpuente`** → **Settings** → **Environment variables** (mismo entorno: **Production**).  
   Pegá **los mismos valores** (misma URL `https://….supabase.co` y misma anon key).  
   Borrá cualquier fila que tenga `127.0.0.1` o `localhost`.

3. **Deployments** → último intento → **Retry deployment** (o **Clear build cache** y luego retry).

El build incluye un script que **falla a propósito** si en Cloudflare la URL de Supabase es local, para no publicar un JS roto. Cuando las variables de **futbolpuente** coincidan con las de **futbol-prueba**, el build debería pasar en verde.

## Recomendación a futuro

Para no duplicar problemas: elegí **un** sitio “oficial” (por ejemplo solo `futbolpuente.pages.dev`) y el **otro** desactivalo o redirigilo, o dejalo solo como prueba con el mismo `.env` de nube copiado.
