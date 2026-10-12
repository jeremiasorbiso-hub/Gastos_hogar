'use client';

import { useEffect, useState, useTransition } from 'react';
import { Cerrar } from './Iconos';

// Panel que sube desde abajo, para formularios
export function Hoja({ abierta, onCerrar, titulo, children }) {
  useEffect(() => {
    if (!abierta) return;
    const esc = (e) => e.key === 'Escape' && onCerrar();
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', esc);
      document.body.style.overflow = '';
    };
  }, [abierta, onCerrar]);

  if (!abierta) return null;
  return (
    <div className="velo" onClick={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="hoja-cab">
          <h2>{titulo}</h2>
          <button type="button" className="btn-icono sin-borde" onClick={onCerrar} aria-label="Cerrar"><Cerrar /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Ejecuta una server action y maneja "cargando" y errores
export function useAccion(accion, { alTerminar } = {}) {
  const [pendiente, start] = useTransition();
  const [error, setError] = useState('');
  const correr = (arg) =>
    new Promise((resolve) => {
      setError('');
      start(async () => {
        try {
          const r = await accion(arg);
          if (r?.error) setError(r.error);
          else alTerminar?.(r);
          resolve(r);
        } catch (e) {
          setError(e.message || 'Algo salió mal');
          resolve({ error: e.message });
        }
      });
    });
  // Para usar en onSubmit de un <form>
  const enviar = (e) => {
    e.preventDefault();
    return correr(new FormData(e.currentTarget));
  };
  return { pendiente, error, correr, enviar };
}
