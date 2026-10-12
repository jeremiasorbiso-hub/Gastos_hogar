'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState('inicio'); // inicio | enviando | enviado | error
  const [error, setError] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setEstado('enviando');
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setEstado('error');
    } else {
      setEstado('enviado');
    }
  }

  return (
    <main className="login">
      <form className="caja" onSubmit={enviar}>
        <div>
          <p className="mini">Finanzas del hogar</p>
          <h1 className="titulo">Nuestra plata</h1>
        </div>
        {estado === 'enviado' ? (
          <p className="aviso ok">Te mandamos un link a <b>{email}</b>. Abrilo desde este mismo dispositivo para entrar.</p>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="email">Tu email</label>
              <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@gmail.com" />
            </div>
            {estado === 'error' && <p className="error-form">{error}</p>}
            <button className="btn" disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Enviando…' : 'Entrar con un link al email'}
            </button>
          </>
        )}
      </form>
    </main>
  );
}
