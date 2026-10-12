-- =========================================================
-- Finanzas del hogar · esquema de base de datos (Supabase)
-- Pegá todo este archivo en Supabase → SQL Editor → Run
-- =========================================================

-- ---------- Miembros del hogar (solo estas personas pueden entrar) ----------
create table if not exists miembros (
  email    text primary key,
  nombre   text not null,
  inicial  text not null,
  color    text not null default '#0F766E'
);

-- ¿El usuario logueado es miembro del hogar?
create or replace function es_miembro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from miembros where lower(email) = lower(auth.jwt() ->> 'email')
  );
$$;

-- ---------- Cuentas ----------
create table if not exists cuentas (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null,
  tipo           text not null check (tipo in ('banco','mercadopago','efectivo','otro')),
  moneda         text not null default 'ARS' check (moneda in ('ARS','USD')),
  saldo          numeric(14,2) not null default 0,
  fuente         text not null default 'manual' check (fuente in ('api','manual')),
  actualizado_at timestamptz not null default now(),
  sync_error     text,
  orden          int not null default 0
);

-- ---------- Movimientos (negativo = gasto, positivo = ingreso) ----------
create table if not exists movimientos (
  id           uuid primary key default gen_random_uuid(),
  cuenta_id    uuid references cuentas(id) on delete set null,
  fecha        date not null default current_date,
  descripcion  text not null,
  monto        numeric(14,2) not null,
  categoria    text not null default 'Otros',
  cargado_por  text references miembros(email) on delete set null,
  origen       text not null default 'manual' check (origen in ('banco','mercadopago','manual')),
  external_id  text unique,          -- id del movimiento en el banco / MP (evita duplicados)
  created_at   timestamptz not null default now()
);
create index if not exists movimientos_fecha_idx on movimientos (fecha desc);

-- ---------- Reglas de autocategorización (aprende de tus correcciones) ----------
create table if not exists reglas (
  patron     text primary key,      -- texto en minúsculas que aparece en la descripción
  categoria  text not null
);

-- ---------- Gastos fijos ----------
create table if not exists fijos (
  id      uuid primary key default gen_random_uuid(),
  nombre  text not null,
  dia     int  not null check (dia between 1 and 31),
  monto   numeric(14,2) not null,
  patron  text,                     -- si un movimiento del banco contiene esto, se marca pagado solo
  activo  boolean not null default true
);

create table if not exists fijos_pagos (
  fijo_id        uuid references fijos(id) on delete cascade,
  periodo        text not null,     -- 'YYYY-MM'
  pagado_at      timestamptz not null default now(),
  auto           boolean not null default false,
  movimiento_id  uuid references movimientos(id) on delete set null,
  primary key (fijo_id, periodo)
);

-- ---------- Compras en cuotas ----------
create table if not exists cuotas (
  id            uuid primary key default gen_random_uuid(),
  descripcion   text not null,
  monto_cuota   numeric(14,2) not null,
  cantidad      int not null check (cantidad > 0),
  primer_mes    date not null       -- primer día del mes de la 1ª cuota
);

-- ---------- Metas de ahorro ----------
create table if not exists metas (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  objetivo         numeric(14,2) not null,
  aporte_mensual   numeric(14,2) not null default 0,
  color            text not null default '#0F766E',
  es_emergencia    boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists metas_aportes (
  id           uuid primary key default gen_random_uuid(),
  meta_id      uuid references metas(id) on delete cascade,
  monto        numeric(14,2) not null,
  fecha        date not null default current_date,
  cargado_por  text references miembros(email) on delete set null
);

-- ---------- Configuración general ----------
create table if not exists config (
  clave  text primary key,
  valor  jsonb not null
);

-- =========================================================
-- Seguridad: solo los miembros del hogar leen y escriben
-- =========================================================
do $$
declare t text;
begin
  foreach t in array array['cuentas','movimientos','reglas','fijos','fijos_pagos','cuotas','metas','metas_aportes','config']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists hogar on %I', t);
    execute format('create policy hogar on %I for all to authenticated using (es_miembro()) with check (es_miembro())', t);
  end loop;
end $$;

alter table miembros enable row level security;
drop policy if exists hogar_lee on miembros;
create policy hogar_lee on miembros for select to authenticated using (es_miembro());

-- =========================================================
-- Datos iniciales
-- =========================================================
insert into cuentas (nombre, tipo, moneda, fuente, orden) values
  ('Banco',        'banco',       'ARS', 'api',    1),
  ('Mercado Pago', 'mercadopago', 'ARS', 'api',    2),
  ('Efectivo',     'efectivo',    'ARS', 'manual', 3),
  ('Dólares',      'otro',        'USD', 'manual', 4)
on conflict do nothing;

insert into config (clave, valor) values ('presupuesto_mensual', '900000')
on conflict (clave) do nothing;

insert into reglas (patron, categoria) values
  ('coto','Súper'), ('carrefour','Súper'), ('dia ','Súper'), ('jumbo','Súper'), ('disco','Súper'),
  ('ypf','Transporte'), ('shell','Transporte'), ('axion','Transporte'), ('sube','Transporte'), ('uber','Transporte'), ('cabify','Transporte'),
  ('netflix','Suscripciones'), ('spotify','Suscripciones'), ('disney','Suscripciones'), ('youtube','Suscripciones'), ('hbo','Suscripciones'),
  ('farmacia','Salud'), ('farmacity','Salud'),
  ('edenor','Servicios'), ('edesur','Servicios'), ('epe santa fe','Servicios'), ('metrogas','Servicios'), ('litoral gas','Servicios'),
  ('aguas','Servicios'), ('personal','Servicios'), ('movistar','Servicios'), ('claro','Servicios'), ('telecentro','Servicios'), ('fibertel','Servicios'),
  ('rappi','Salidas'), ('pedidosya','Salidas'), ('mostaza','Salidas'), ('mcdonald','Salidas')
on conflict (patron) do nothing;

-- =========================================================
-- Miembros del hogar
-- =========================================================
insert into miembros (email, nombre, inicial, color) values
  ('jeremiasorbiso@gmail.com', 'Jere',  'J', '#0F766E'),
  ('kiaratoddys@gmail.com',    'Kiara', 'K', '#B45309')
on conflict (email) do nothing;
