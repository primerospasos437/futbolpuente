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

## Si “en la pantalla” las variables son iguales pero el build falla igual

En Cloudflare las variables pueden estar solo en **Production** y el deploy que falla ser de **Preview** (por ejemplo un merge a una rama que no es producción). En ese caso el **build** no ve tus claves y puede quedar vacío o viejo.

- En **Environment variables**, repetí `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para **Preview** también, o usá la opción que ofrezca tu cuenta para **todas** las ramas / “All environments”.
- En el **log del build** de Pages, buscá la línea que imprime el script:  
  `[Cloudflare Pages] Build: VITE_SUPABASE_URL host detectado = "..."`  
  Ahí ves qué host recibió realmente el compilador (debería ser `….supabase.co`).

### Emergencia (solo para desbloquear un deploy)

Variable de entorno en Pages: `SKIP_CF_PAGES_SUPABASE_CHECK=1` — saltea el chequeo (no recomendado dejarlo así en producción).


Para no duplicar problemas: elegí **un** sitio “oficial” (por ejemplo solo `futbolpuente.pages.dev`) y el **otro** desactivalo o redirigilo, o dejalo solo como prueba con el mismo `.env` de nube copiado.
