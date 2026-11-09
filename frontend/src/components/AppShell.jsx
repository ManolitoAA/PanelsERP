import React, { useEffect, useState } from 'react';
import { navFor, ROLE_LABELS } from './nav.js';

export default function AppShell({ active, title, children }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    setUser({ role: localStorage.getItem('role'), name: localStorage.getItem('name') });
  }, []);

  if (!user) return null;

  function logout() {
    localStorage.clear();
    window.location.href = '/';
  }

  return (
    <div className="min-h-screen md:flex">
      <header className="md:hidden flex items-center justify-between bg-brand-900 text-white px-4 py-3">
        <span className="font-bold">PanelsERP</span>
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} className="rounded-lg border border-white/30 px-3 py-1 text-sm">Menú</button>
      </header>
      <aside className={`${open ? 'block' : 'hidden'} md:block md:w-64 md:min-h-screen bg-brand-900 text-white md:sticky md:top-0 md:h-screen flex flex-col`}>
        <div className="hidden md:block px-6 py-5 text-xl font-bold tracking-tight">PanelsERP</div>
        <nav aria-label="Principal" className="flex-1 px-3 py-2 flex flex-col gap-1">
          {navFor(user.role).map(item => (
            <a key={item.key} href={item.href}
              aria-current={item.key === active ? 'page' : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                item.key === active ? 'bg-white/15 text-white' : 'text-brand-100 hover:bg-white/10'}`}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10 text-sm">
          <p className="font-semibold">{user.name}</p>
          <p className="text-brand-100 text-xs mb-2">{ROLE_LABELS[user.role] || user.role}</p>
          <button onClick={logout} className="text-brand-100 hover:text-white underline-offset-2 hover:underline">Cerrar sesión</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-4 md:px-10 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">{title}</h1>
        {children}
      </main>
    </div>
  );
}
