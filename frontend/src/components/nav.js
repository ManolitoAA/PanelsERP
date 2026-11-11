const SECTIONS = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'clients', icon: 'users', label: 'Clientes', href: '/clients' },
  { key: 'orders', icon: 'receipt', label: 'Pedidos', href: '/orders' },
  { key: 'catalog', icon: 'box', label: 'Catálogo', href: '/catalog' },
  { key: 'suppliers', icon: 'truck', label: 'Proveedores', href: '/suppliers' },
  { key: 'templates', icon: 'mail', label: 'Plantillas', href: '/templates' },
];

// Los tres roles ven las mismas secciones; cambian los datos, no el menú.
export function navFor(role) {
  return role ? SECTIONS : [];
}

export const ROLE_LABELS = { comercial: 'Comercial', jefe: 'Dirección', admin_rrhh: 'Administración / RRHH' };
