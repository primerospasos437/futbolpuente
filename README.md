# Fútbol Puente Club

PWA React + Vite + Supabase.

## Desarrollo local

```bash
cp .env.example .env
# Completá VITE_* con tu proyecto, o con `supabase start` (URL local y claves).
npm install
npm run dev
```

## Web pública y error “Failed to fetch” / login

El frontend **no** puede usar `http://127.0.0.1:54321` cuando el sitio está en internet (GitHub Pages, Netlify, etc.): el navegador intenta hablar con **la PC del visitante**, no con tu Supabase.

1. En Supabase (proyecto en la nube): **Settings → API** → copiá **Project URL** y **anon public** key.
2. Generá el build con esas variables:

   ```bash
   export VITE_SUPABASE_URL="https://xxxxx.supabase.co"
   export VITE_SUPABASE_ANON_KEY="eyJ..."
   npm run build
   ```

3. Subí el contenido de la carpeta `dist/` a tu hosting (o configurá CI para que `npm run build` reciba esas variables como secrets).

Si el build se hizo con URL local por error, la app muestra un mensaje aclaratorio en lugar de solo `TypeError: Failed to fetch`.