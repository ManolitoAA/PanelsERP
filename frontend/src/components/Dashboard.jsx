import React, { useEffect, useState } from 'react';
import ClientList from './ClientList.jsx';
import ClientForm from './ClientForm.jsx';
import SupervisionPanel from './SupervisionPanel.jsx';

export default function Dashboard() {
  const [role, setRole] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!localStorage.getItem('token')) window.location.href = '/';
    else setRole(localStorage.getItem('role'));
  }, []);

  function logout() {
    localStorage.clear();
    window.location.href = '/';
  }

  if (!role) return null;
  const supervisor = role !== 'comercial';

  return (
    <>
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-blue-700">PanelsERP</h1>
        <button onClick={logout} className="text-sm text-slate-500 hover:text-red-500">Cerrar sesión</button>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-8">
        {supervisor && (
          <section>
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Supervisión</h2>
            <SupervisionPanel />
          </section>
        )}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            {supervisor ? 'Todos los clientes' : `Mis Clientes – Hola, ${localStorage.getItem('name')}`}
          </h2>
          {role === 'comercial' && <ClientForm onCreated={() => setVersion(v => v + 1)} />}
          <ClientList key={version} />
        </section>
      </main>
    </>
  );
}
