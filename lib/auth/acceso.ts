/**
 * Inicio de sesión por nombre de usuario (solicitado el 2026-11-07).
 *
 * Supabase Auth exige correo, así que una cuenta con nombre de usuario se
 * guarda como <usuario>@usuarios.erp.invalid. «.invalid» es un dominio
 * reservado (RFC 2606): nunca recibe correo. Las cuentas se crean con
 * private.crear_usuario_interno.
 */
export const DOMINIO_USUARIOS = "usuarios.erp.invalid";

const PATRON_USUARIO = /^[a-z0-9][a-z0-9._-]{2,29}$/;

/** Convierte lo escrito en el login en el correo de Auth, o null si no es válido. */
export function correoDeAcceso(valor: string): string | null {
  const texto = valor.trim().toLowerCase();
  if (!texto) return null;
  if (texto.includes("@")) return texto;
  // Tolerante al escribir: «Administración» o «Talanga 2» → administracion, talanga2.
  const usuario = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "");
  return PATRON_USUARIO.test(usuario) ? `${usuario}@${DOMINIO_USUARIOS}` : null;
}

/** Cómo se muestra la cuenta: el nombre de usuario, o el correo real. */
export function presentarAcceso(correo: string | null | undefined): string | null {
  if (!correo) return null;
  const sufijo = `@${DOMINIO_USUARIOS}`;
  return correo.toLowerCase().endsWith(sufijo) ? correo.slice(0, -sufijo.length) : correo;
}

export function esCuentaDeUsuario(correo: string | null | undefined): boolean {
  return Boolean(correo?.toLowerCase().endsWith(`@${DOMINIO_USUARIOS}`));
}
