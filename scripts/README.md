# Diagnóstico de una invitación

Ejecuta desde la raíz del proyecto:

```bash
npm run diagnose:invitation -- inv1_7bbf2e8b0d0044f62766db111bd6cc9e7f3900b4ed64c6a60bef5ae319627588 https://invboda-xi.vercel.app
```

El primer bloque muestra la respuesta pública de Vercel. Para recibir el error exacto de la consulta a Supabase, crea un archivo local `.env.local` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (los mismos valores guardados en Vercel) y ejecuta de nuevo el comando. Ese archivo está ignorado por Git y el script nunca imprime la clave.
