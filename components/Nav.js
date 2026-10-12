'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Casa, Lista, Calendario, Diana } from './Iconos';

const items = [
  { href: '/', label: 'Inicio', Icono: Casa },
  { href: '/movimientos', label: 'Movimientos', Icono: Lista },
  { href: '/vencimientos', label: 'Vencimientos', Icono: Calendario },
  { href: '/ahorros', label: 'Ahorros', Icono: Diana },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Secciones">
      <div className="nav-inner">
        {items.map(({ href, label, Icono }) => {
          const on = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link key={href} href={href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
              <Icono />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
