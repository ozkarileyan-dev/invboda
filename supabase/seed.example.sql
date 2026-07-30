-- Ejemplo: carga inicial de familias. Sustituye los datos antes de ejecutarlo.
insert into public.families (reference_code, display_name, invited_guest_count, internal_notes)
values
  ('familia-garcia', 'Familia García', 4, 'Invitación general'),
  ('familia-lopez', 'Familia López', 2, null);

-- Emite el token de una familia. Copia raw_token de la respuesta para construir el enlace final:
-- https://tu-dominio.vercel.app/?token=<raw_token>
select * from public.issue_invitation_token(
  (select id from public.families where reference_code = 'familia-garcia')
);

-- Consulta administrativa de estados y cupos confirmados:
-- select * from public.family_invitation_summary order by display_name;
