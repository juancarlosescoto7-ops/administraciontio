-- E2 · Corrección: los triggers de integridad leen el libro completo.
--
-- El trigger diferido private.verificar_asiento se ejecuta al confirmar la
-- transacción con el rol del usuario que llamó a la función financiera. Para
-- el operador, la RLS oculta lineas_asiento y movimientos_dinero, así que la
-- comprobación no veía las líneas y rechazaba cobros válidos ("Debe 0, Haber
-- 0"). Las funciones de trigger pasan a SECURITY DEFINER (sin cambiar su
-- lógica) para que comprueben siempre con todos los datos. No son invocables
-- directamente: solo se ejecutan como triggers.

alter function private.verificar_asiento() security definer;
alter function private.validar_aplicacion() security definer;
alter function private.validar_pago_gasto() security definer;
