# Nuestra plata · finanzas del hogar

App web para manejar la plata en común: saldo real, movimientos (automáticos del banco y Mercado Pago, o cargados a mano), gastos fijos con vencimientos, cuotas de tarjeta, presupuesto mensual y metas de ahorro.

Hecha con **Next.js 15 + Supabase**. Se hostea gratis en **Vercel** y se usa desde el celular (se puede "agregar a la pantalla de inicio" como una app).

---

## 1. Crear la base de datos (Supabase, gratis)

1. Entrá a <https://supabase.com>, creá una cuenta y un proyecto nuevo (región São Paulo es la más cercana).
2. Andá a **SQL Editor → New query**, pegá todo el archivo `supabase/schema.sql` y tocá **Run**.
3. Al final de ese archivo hay un bloque comentado para agregarlos a ustedes dos. Corré esto con sus datos:
   ```sql
   insert into miembros (email, nombre, inicial, color) values
     ('tu-email@gmail.com',     'Jere',   'J', '#0F766E'),
     ('email-de-tu-pareja@...', 'Nombre', 'N', '#B45309');
   ```
   Solo esos emails pueden ver los datos (la seguridad la aplica la base de datos, no solo la app).
4. En **Project Settings → API** copiá: `Project URL`, `anon public` y `service_role` (esta última es secreta).
5. En **Authentication → URL Configuration** poné en *Site URL* la dirección de tu app en Vercel (paso 3), y agregala también en *Redirect URLs* como `https://tu-app.vercel.app/auth/callback`. Para probar en tu compu agregá `http://localhost:3000/auth/callback`.

## 2. Conectar tu API del banco

Abrí `lib/sync/banco.js`. La app espera que tu scraper devuelva algo así:

```json
{
  "saldo": 1215900.50,
  "movimientos": [
    { "id": "abc123", "fecha": "2026-10-12", "descripcion": "COTO SUC 45", "monto": -48230 }
  ]
}
```

Si tu API usa otros nombres de campos, cambiá **solo la función `mapear`**. Ya entiende `saldo`/`balance`, `fecha`/`date`, `monto`/`amount`/`importe`, montos con formato argentino (`1.234,56`), fechas `12/10/2026` y columnas separadas de débito y crédito.

> Tu API tiene que ser accesible desde internet para que Vercel la llame, y conviene protegerla con una clave (`BANK_API_KEY`, se manda como `Authorization: Bearer ...`). No la dejes abierta: devuelve los datos de tu cuenta.

## 3. Mercado Pago (opcional)

En **Mercado Pago Developers → Tus integraciones**, creá una aplicación y copiá el **Access Token de producción**. Va en la variable `MP_ACCESS_TOKEN`. Si no usan MP, dejala vacía.

El endpoint de saldo que usa la app (`/users/{id}/mercadopago_account/balance`) conviene confirmarlo en la referencia oficial; si no responde, la app sigue funcionando con los movimientos y podés cargar el saldo a mano.

## 4. Publicar en Vercel (gratis)

1. Subí esta carpeta a un repositorio **privado** de GitHub.
2. En <https://vercel.com> → **Add New → Project** → elegí el repo.
3. En **Environment Variables** cargá todo lo de `.env.example` con tus valores.
4. **Deploy**. Listo: entrás con tu email y te llega un link para loguearte.

La sincronización corre sola una vez por día (ver `vercel.json`; el plan gratis de Vercel permite cron diario). Además, **cada vez que abren la app, si pasaron más de 3 horas, sincroniza sola**, y también pueden tocar el chip "Banco · hace X" para actualizar al momento.

## Probar en tu compu

```bash
cp .env.example .env.local   # y completá los valores
npm install
npm run dev                  # abrí http://localhost:3000
```

---

## Cómo funciona

| Pantalla | Qué hace |
|---|---|
| **Inicio** | *Disponible real* = saldo de las cuentas − gastos fijos que faltan pagar este mes. Barra de gasto contra presupuesto con la marca del día del mes. Próximos vencimientos, últimos movimientos y saldo de cada cuenta (editable a mano). Ojo para ocultar montos. |
| **Movimientos** | Lista por día, filtros por categoría, mes anterior/siguiente. "+" para cargar a mano. Tocar un movimiento para cambiar la categoría: si marcás "aplicar a todos", la app **aprende** y categoriza igual los que vengan. |
| **Vencimientos** | Gastos fijos del mes con check de pagado. Si cargás el "texto que aparece en el banco" (ej. `edenor`), **se marca pagado solo** cuando aparece el débito. Detecta comercios que cobran todos los meses y sugiere agregarlos. Cuotas de tarjeta comprometidas para los próximos 4 meses. |
| **Ahorros** | Metas con aportes y retiros, cuándo llegan al ritmo actual, cobertura del fondo de emergencia en meses de gastos fijos, y cuánto ahorraron cada mes. |

**Categorías especiales:** `Ingreso` (sueldos, cobros), `Transferencia` (movimientos entre sus propias cuentas) y `Ahorro` no cuentan como gasto del mes. Marcá así las transferencias entre cuentas propias para que no inflen el gasto.

## Archivos importantes

```
supabase/schema.sql        base de datos + seguridad
lib/sync/banco.js          ← adaptador de tu API del banco
lib/sync/mercadopago.js    cliente de Mercado Pago
lib/sync/sincronizar.js    importación, autocategorización, fijos pagados
lib/datos.js               cálculos (disponible, cuotas, sugerencias)
app/actions.js             todo lo que modifica datos
app/(app)/…                las 4 pantallas
```

## Seguridad

- Las claves (`SUPABASE_SERVICE_ROLE_KEY`, `MP_ACCESS_TOKEN`, `BANK_API_KEY`) solo existen en el servidor; nunca llegan al navegador.
- Cada tabla tiene seguridad por filas: aunque alguien tenga la URL de Supabase, sin ser miembro no ve nada.
- `/api/sync` solo responde si recibe el `CRON_SECRET`.
