const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'clients', label: 'Clientes', href: '/clients' },
  { key: 'orders', label: 'Pedidos', href: '/orders' },
  { key: 'suppliers', label: 'Proveedores', href: '/suppliers' },
  { key: 'templates', label: 'Plantillas', href: '/templates' },
];

// Los tres roles ven las mismas secciones; cambian los datos, no el menú.
export function navFor(role) {
  return role ? SECTIONS : [];
}

export const ROLE_LABELS = { comercial: 'Comercial', jefe: 'Dirección', admin_rrhh: 'Administración / RRHH' };
