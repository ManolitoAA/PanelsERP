import React, { useState } from 'react';
import { Button, Field, ErrorNote, inputClass } from './ui.jsx';

const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail || 'Credenciales incorrectas');
        return;
      }
      const { access_token, role, name } = await res.json();
      localStorage.setItem('token', access_token);
      localStorage.setItem('role', role);
      localStorage.setItem('name', name);
      window.location.href = '/dashboard';
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && <ErrorNote>{error}</ErrorNote>}
      <Field label="Email">
        <input name="email" type="email" autoComplete="email" required value={email}
          onChange={e => setEmail(e.target.value)} className={`${inputClass} min-h-[44px]`} />
      </Field>
      <Field label="Contraseña">
        <input name="password" type="password" autoComplete="current-password" required value={password}
          onChange={e => setPassword(e.target.value)} className={`${inputClass} min-h-[44px]`} />
      </Field>
      <Button type="submit" disabled={loading} className="mt-2 min-h-[48px] text-base">
        {loading ? 'Iniciando sesión…' : 'Iniciar sesión'}
      </Button>
    </form>
  );
}
