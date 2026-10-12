const base = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const Ojo = ({ t = 20 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="1.8" {...base}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const OjoTachado = ({ t = 20 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="1.8" {...base}><path d="M3 3l18 18" /><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
);
export const Refrescar = ({ t = 15 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="2" {...base}><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 4v5h-5" /></svg>
);
export const Mas = ({ t = 26 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="2.2" {...base}><path d="M12 5v14M5 12h14" /></svg>
);
export const Cerrar = ({ t = 18 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="2" {...base}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const Tilde = ({ t = 16 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="3" {...base}><path d="M5 12l5 5 9-10" /></svg>
);
export const Lapiz = ({ t = 16 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="1.8" {...base}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
);
export const Casa = ({ t = 22 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="1.8" {...base}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
);
export const Lista = ({ t = 22 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="1.8" {...base}><path d="M4 6h16M4 12h16M4 18h10" /></svg>
);
export const Calendario = ({ t = 22 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="1.8" {...base}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
export const Diana = ({ t = 22 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="1.8" {...base}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>
);
export const Escudo = ({ t = 26 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="1.8" {...base}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /></svg>
);
export const Salir = ({ t = 18 }) => (
  <svg width={t} height={t} viewBox="0 0 24 24" strokeWidth="1.8" {...base}><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>
);
