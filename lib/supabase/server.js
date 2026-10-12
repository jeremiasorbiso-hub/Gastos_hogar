import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Cliente con la sesión del usuario logueado (respeta la seguridad por filas)
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Llamado desde un Server Component: lo maneja el middleware.
          }
        },
      },
    }
  );
}

// Cliente administrador: SOLO para la sincronización en el servidor.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

// Devuelve el miembro logueado o null si no tiene acceso.
export async function miembroActual() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, miembro: null };
  const { data: miembro } = await supabase
    .from('miembros')
    .select('*')
    .ilike('email', user.email)
    .maybeSingle();
  return { supabase, miembro };
}
