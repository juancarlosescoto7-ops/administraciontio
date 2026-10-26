export type ValoresUsuario = { nombre: string; rol: string; activo: string; motivo: string };

export type EstadoUsuario = {
  revision: number;
  valores: ValoresUsuario;
  errores: Partial<Record<keyof ValoresUsuario, string>>;
  error: string | null;
};
