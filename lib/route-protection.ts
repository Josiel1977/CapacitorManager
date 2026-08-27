export const PROTECTED_ROUTE_PREFIXES = [
  '/clientes',
  '/bancos',
  '/capacitores',
  '/dimensionar',
  '/medicoes',
  '/medicoes-transformadores',
  '/graficos',
  '/historico',
  '/relatorios',
  '/manutencao',
  '/configuracoes',
  '/documentacao',
  '/dashboard-real',
  '/analise-massa',
  '/laudo',
  '/admin',
  '/subscription/success',
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
