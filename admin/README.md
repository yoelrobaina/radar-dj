# Panel admin de Radar DJ

Panel en `admin/` (se despliega como proyecto aparte en Vercel con dominio
`admin.radardj.vercel.app`, directorio raíz `admin/`).

## Entrada

Sin contraseña: el admin pone su correo y recibe un código de 6 dígitos por
correo (Supabase Auth, OTP por email). Solo existe un usuario admin:
`yoelrobaina96@gmail.com`, creado en el panel de Supabase. El registro de
usuarios nuevos está desactivado; además, la política RLS solo deja ver y
cambiar datos al usuario con ese correo.

## Qué se ve

- Total de usuarios, cuántos gratis, cuántos pagando y cuántos por vencer
  (vencen en 3 días o menos, o ya vencidos).
- Lista con nombre, correo, WhatsApp, géneros, artistas, canal de entrega,
  fecha de apuntado y fecha de vencimiento.
- Buscador por correo, teléfono o nombre.

## Acciones

- **Activar 30 días**: pone el plan en pagado y el vencimiento a hoy + 30 días.
- **Renovar +30 días**: suma 30 días al vencimiento actual (o a hoy si ya venció).
- **Eliminar**: borra el registro.

## Datos

La tabla `radar_dj_signups` guarda `plan` (`trial` o `paid`) y `expires_at`.
Al apuntarse, el vencimiento es creado + 7 días (gratis). El estado se calcula
en el panel: gratis, pagando, por vencer (3 días o menos) o vencido.
