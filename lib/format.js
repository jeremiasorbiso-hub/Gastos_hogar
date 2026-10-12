// Utilidades de formato y fechas (zona horaria Argentina)

export const CATEGORIAS_GASTO = ['Súper', 'Salidas', 'Transporte', 'Servicios', 'Suscripciones', 'Salud', 'Casa', 'Ropa', 'Regalos', 'Otros'];
export const CATEGORIAS_ESPECIALES = ['Ingreso', 'Transferencia', 'Ahorro'];
// Categorías que no cuentan como "gasto" del mes
export const NO_ES_GASTO = ['Transferencia', 'Ahorro', 'Ingreso'];

export function pesos(n, { signo = false, moneda = 'ARS' } = {}) {
  const v = Math.abs(Number(n) || 0);
  const txt = v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: v % 1 ? 2 : 0 });
  const pref = moneda === 'USD' ? 'US$ ' : '$ ';
  if (!signo) return (n < 0 ? '− ' : '') + pref + txt;
  return (n > 0 ? '+ ' : n < 0 ? '− ' : '') + pref + txt;
}

// Fecha de hoy en Argentina como objeto {y, m, d}
export function hoyAR() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [y, m, d] = parts.split('-').map(Number);
  return { y, m, d, iso: parts };
}

export function periodo(y, m) {
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function diasDelMes(y, m) {
  return new Date(y, m, 0).getDate();
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Suma (o resta) meses a {y, m}
export function sumarMeses(y, m, n) {
  const t = y * 12 + (m - 1) + n;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}

// "Hoy", "Ayer", "Sáb 10"
export function etiquetaDia(fechaIso) {
  const h = hoyAR();
  const hoy = new Date(Date.UTC(h.y, h.m - 1, h.d));
  const [y, m, d] = fechaIso.split('-').map(Number);
  const f = new Date(Date.UTC(y, m - 1, d));
  const dif = Math.round((hoy - f) / 86400000);
  if (dif === 0) return 'Hoy';
  if (dif === 1) return 'Ayer';
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const base = `${dias[f.getUTCDay()]} ${d}`;
  return y === h.y && m === h.m ? base : `${base} ${MESES_CORTOS[m - 1]}`;
}

// Patrón de comercio a partir de una descripción: "COTO SUC 45 ROSARIO" → "coto suc"
export function patronDe(descripcion) {
  return String(descripcion).toLowerCase().replace(/[0-9*#/\\\-]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');
}

// "hace 12 min"
export function hace(fecha) {
  const s = Math.max(0, (Date.now() - new Date(fecha).getTime()) / 1000);
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} días`;
}
