'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { pesos } from '@/lib/format';
import { Ojo, OjoTachado } from './Iconos';

const Ctx = createContext({ oculto: false, alternar: () => {} });

export function PrivacidadProvider({ children }) {
  const [oculto, setOculto] = useState(false);
  useEffect(() => {
    try { setOculto(localStorage.getItem('montos-ocultos') === '1'); } catch {}
  }, []);
  const alternar = () => {
    setOculto((v) => {
      try { localStorage.setItem('montos-ocultos', v ? '0' : '1'); } catch {}
      return !v;
    });
  };
  return <Ctx.Provider value={{ oculto, alternar }}>{children}</Ctx.Provider>;
}

// Muestra un monto, o puntitos si están ocultos
export function Monto({ n, signo = false, moneda = 'ARS' }) {
  const { oculto } = useContext(Ctx);
  if (oculto) return <span>{moneda === 'USD' ? 'US$' : '$'} ••••••</span>;
  return <span>{pesos(n, { signo, moneda })}</span>;
}

export function BotonOjo() {
  const { oculto, alternar } = useContext(Ctx);
  return (
    <button className="btn-icono" onClick={alternar} aria-label={oculto ? 'Mostrar montos' : 'Ocultar montos'}>
      {oculto ? <OjoTachado /> : <Ojo />}
    </button>
  );
}
