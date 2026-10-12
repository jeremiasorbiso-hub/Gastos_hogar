import { miembroActual } from '@/lib/supabase/server';
import { PrivacidadProvider } from '@/components/Privacidad';
import Nav from '@/components/Nav';
import { salir } from '@/app/actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }) {
  const { supabase, miembro } = await miembroActual();

  if (!miembro) {
    const { data: { user } } = await supabase.auth.getUser();
    return (
      <main className="login">
        <div className="caja">
          <h1 className="titulo">Sin acceso</h1>
          <p>
            La cuenta <b>{user?.email}</b> no está en la lista de miembros del hogar.
            Agregala en la tabla <code>miembros</code> de Supabase.
          </p>
          <form action={salir}><button className="btn borde" style={{ width: '100%' }}>Entrar con otro email</button></form>
        </div>
      </main>
    );
  }

  return (
    <PrivacidadProvider>
      <div className="app">{children}</div>
      <Nav />
    </PrivacidadProvider>
  );
}
