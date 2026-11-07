# Radar DJ

Landing + registro para DJs de Cuba. El DJ dice qué géneros y cantantes quiere
que se vigilen; cuando sale un tema nuevo, le llega el link a su WhatsApp o
correo. Primera semana gratis, después 200 CUP al mes (150 CUP si se apunta
el grupo entero). Pago por Transfermóvil.

## Sitio

Sitio estático, sin build: `index.html`, `styles.css`, `app.js`, `config.js`.
Se despliega en Vercel desde este repo.

## Base de datos (Supabase)

Proyecto `radar-dj`. Tabla `radar_dj_signups` creada con este SQL:

```sql
create table if not exists public.radar_dj_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  whatsapp text,
  email text,
  genres text[] not null default '{}',
  artists text,
  delivery text not null default 'whatsapp',
  plan text not null default 'trial'
);
alter table public.radar_dj_signups enable row level security;
create policy "insert only" on public.radar_dj_signups for insert with check (true);
```

La clave anon es pública por diseño y solo permite INSERTs: nadie puede leer
los registros desde el navegador. Los valores reales van en `config.js`
(`SUPABASE_URL` y `SUPABASE_ANON_KEY`).

## Entrega de links

El formulario guarda por cada DJ su WhatsApp o correo y cómo quiere recibir
los links. El radar diario (revisión de estrenos en Spotify, YouTube y
Beatport) todavía no está automatizado: Chichi revisa y manda los links a cada
DJ por el canal que eligió.
