# Fútbol Puente Club

App React (Vite) + datos en **Supabase en la nube**. El frontend habla **directo** con Supabase (RPC); no hace falta Supabase local (`127.0.0.1:54321`) salvo que vos explícitamente quieras desarrollar con CLI.

## Configuración (siempre nube)

1. En Supabase: **Project Settings → API**.
2. En la raíz del repo, copiá el ejemplo y completá con **tu** proyecto:

   ```bash
   cp .env.example .env
   ```

3. Editá `.env` y poné **solo** la URL HTTPS del proyecto y la clave **anon** (pública):

   - `VITE_SUPABASE_URL` → debe verse como `https://xxxx.supabase.co`  
   - `VITE_SUPABASE_ANON_KEY` → la *anon public* del dashboard  

   **No uses** `http://127.0.0.1:54321` ni `localhost` acá, a menos que tengas `supabase start` corriendo en tu PC.

4. Instalá dependencias y arrancá el cliente:

   ```bash
   npm install
   npm run dev
   ```

5. Abrí `http://localhost:5173`, código de acceso del grupo, y entrá con apodo + PIN.

Si cambiás `.env`, **pará el servidor** (`Ctrl+C`) y volvé a ejecutar `npm run dev` (Vite lee las variables al iniciar).

## Producción (Cloudflare Pages)

1. **Variables de entorno** (obligatorio; el `.env` de tu PC **no** viaja con el deploy):
   - Cloudflare → **Workers & Pages** → tu proyecto → **Settings** → **Environment variables**
   - En **Production** (y Preview si querés), agregá:
     - `VITE_SUPABASE_URL` = `https://TU-REF.supabase.co` (Project URL del dashboard de Supabase)
     - `VITE_SUPABASE_ANON_KEY` = la clave **anon public** (mismo dashboard → Settings → API)
   - **No** pongas `http://127.0.0.1:54321`: el build guarda esa URL dentro del JS y en internet no hay Supabase escuchando ahí.

2. **Redeploy**: después de guardar las variables, **Deployments** → los tres puntos del último build → **Retry deployment**, o empujá un commit vacío para que vuelva a compilar.

3. **Build**: comando `npm run build`, directorio de salida `dist` (como ya tengas configurado).

Si ves un aviso rojo sobre “127.0.0.1” o “compiló con Supabase en tu máquina”, es porque el **último deploy** se hizo sin esas variables bien puestas: corregilas en Cloudflare y **volvé a desplegar**.

## SQL en Supabase

Los archivos bajo `supabase/` son migraciones / RPCs para ejecutar en el **SQL Editor** del proyecto (en el orden que indique tu historial de despliegue).

## Scripts útiles

| Comando        | Uso |
|----------------|-----|
| `npm run dev`  | Vite (5173) + opcional proxy `/api` al Express local |
| `npm run build`| Build estático para Pages |
| `npm run dev:client` | Solo Vite |
