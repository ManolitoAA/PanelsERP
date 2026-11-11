import React, { useEffect, useState } from 'react';
import { navFor, ROLE_LABELS } from './nav.js';
import { greeting, firstName } from './format.js';
import { Avatar } from './ui.jsx';
import Icon from './icons.jsx';

function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-white">
      <span aria-hidden="true" className="grid place-items-center h-8 w-8 rounded-lg bg-accent-500 text-night font-semibold">P</span>
      <span className="text-lg font-semibold tracking-display">PanelsERP</span>
    </span>
  );
}

export default function AppShell({ active, title, subtitle, actions, children }) {
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/'; return; }
    setUser({ role: localStorage.getItem('role'), name: localStorage.getItem('name') || '' });
  }, []);

  if (!user) return null;

  function logout() {
    localStorage.clear();
    window.location.href = '/';
  }

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="min-h-screen md:flex">
      <header className="md:hidden sticky top-0 z-40 flex items-center justify-between bg-night px-4 py-3">
        <Logo />
        <button onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="app-sidebar"
          className="press inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 min-h-[44px] text-sm text-white">
          <Icon name={open ? 'close' : 'menu'} className="h-4 w-4" />Menú
        </button>
      </header>
      <aside id="app-sidebar"
        className={`${open ? 'flex' : 'hidden'} md:flex fixed md:sticky inset-x-0 top-[68px] bottom-0 md:top-0 z-30 md:w-64 md:h-screen
          bg-night text-mist flex-col grid-glow md:shrink-0`}>
        <div className="hidden md:block px-6 pt-6 pb-8"><Logo /></div>
        <nav aria-label="Principal" className="flex-1 px-3 py-4 md:py-0 flex flex-col gap-1">
          {navFor(user.role).map(item => {
            const current = item.key === active;
            return (
              <a key={item.key} href={item.href} aria-current={current ? 'page' : undefined}
                className={`group relative flex items-center gap-3 rounded-xl px-3 min-h-[44px] text-base md:text-sm font-medium transition-colors ${
                  current ? 'bg-white/10 text-white' : 'text-night-400 hover:bg-white/5 hover:text-white'}`}>
                {current && <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-accent-500" />}
                <Icon name={item.icon} className={`h-[18px] w-[18px] ${current ? 'text-accent-500' : ''}`} />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="m-3 rounded-2xl bg-white/5 border border-white/10 p-3 flex items-center gap-3">
          <Avatar name={user.name} dark />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-night-400 truncate">{ROLE_LABELS[user.role] || user.role}</p>
          </div>
          <button onClick={logout} aria-label="Cerrar sesión" title="Cerrar sesión"
            className="press grid place-items-center h-11 w-11 rounded-lg text-night-400 hover:text-white hover:bg-white/10">
            <Icon name="logout" className="h-4 w-4" />
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 px-4 md:px-10 py-6 md:py-10 max-w-[1400px]">
        <div className="enter flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p data-testid="greeting" className="text-sm text-slate-600 first-letter:uppercase">
              {greeting()}, {firstName(user.name)} · {today}
            </p>
            <h1 className="mt-1 text-3xl md:text-4xl font-medium tracking-hero text-night">{title}</h1>
            {subtitle && <p className="mt-2 text-sm text-slate-600 max-w-xl">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
