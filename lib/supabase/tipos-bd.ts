// Generado con Supabase MCP (generate_typescript_types) tras las migraciones de E3.
// No editar a mano: regenerar después de cada migración.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      aplicaciones_cobro: {
        Row: {
          cargo_id: string
          cliente_id: string
          cobro_id: string
          creado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_aplicacion"]
          fecha: string
          id: string
          monto: number
          motivo_reverso: string | null
          operacion_id: string
          reversado_en: string | null
          reversado_por: string | null
        }
        Insert: {
          cargo_id: string
          cliente_id: string
          cobro_id: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_aplicacion"]
          fecha: string
          id?: string
          monto: number
          motivo_reverso?: string | null
          operacion_id: string
          reversado_en?: string | null
          reversado_por?: string | null
        }
        Update: {
          cargo_id?: string
          cliente_id?: string
          cobro_id?: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_aplicacion"]
          fecha?: string
          id?: string
          monto?: number
          motivo_reverso?: string | null
          operacion_id?: string
          reversado_en?: string | null
          reversado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aplicaciones_cobro_cargo_fkey"
            columns: ["cargo_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "cargos_cliente"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "aplicaciones_cobro_cargo_fkey"
            columns: ["cargo_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_cargos"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "aplicaciones_cobro_cobro_fkey"
            columns: ["cobro_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "cobros_cliente"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "aplicaciones_cobro_cobro_fkey"
            columns: ["cobro_id", "cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_cobros"
            referencedColumns: ["id", "cliente_id"]
          },
          {
            foreignKeyName: "aplicaciones_cobro_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aplicaciones_cobro_reversado_por_fkey"
            columns: ["reversado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      asientos: {
        Row: {
          actividad: Database["public"]["Enums"]["actividad"] | null
          concepto: string
          creado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_asiento"]
          evento: Database["public"]["Enums"]["evento_financiero"]
          fecha: string
          id: string
          origen_id: string
          origen_tipo: Database["public"]["Enums"]["origen_financiero"]
        }
        Insert: {
          actividad?: Database["public"]["Enums"]["actividad"] | null
          concepto: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_asiento"]
          evento: Database["public"]["Enums"]["evento_financiero"]
          fecha: string
          id?: string
          origen_id: string
          origen_tipo: Database["public"]["Enums"]["origen_financiero"]
        }
        Update: {
          actividad?: Database["public"]["Enums"]["actividad"] | null
          concepto?: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_asiento"]
          evento?: Database["public"]["Enums"]["evento_financiero"]
          fecha?: string
          id?: string
          origen_id?: string
          origen_tipo?: Database["public"]["Enums"]["origen_financiero"]
        }
        Relationships: [
          {
            foreignKeyName: "asientos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiarios: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          creado_por: string | null
          created_at: string
          fecha_nacimiento: string | null
          id: string
          identificacion: string | null
          nombre: string
          notas: string | null
          telefono: string | null
          tutor: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          fecha_nacimiento?: string | null
          id?: string
          identificacion?: string | null
          nombre: string
          notas?: string | null
          telefono?: string | null
          tutor?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          fecha_nacimiento?: string | null
          id?: string
          identificacion?: string | null
          nombre?: string
          notas?: string | null
          telefono?: string | null
          tutor?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiarios_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiarios_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bitacora: {
        Row: {
          accion: string
          actor_id: string | null
          antes: Json | null
          despues: Json | null
          entidad: string
          fecha: string
          id: string
          motivo: string | null
          registro_id: string
        }
        Insert: {
          accion: string
          actor_id?: string | null
          antes?: Json | null
          despues?: Json | null
          entidad: string
          fecha?: string
          id?: string
          motivo?: string | null
          registro_id: string
        }
        Update: {
          accion?: string
          actor_id?: string | null
          antes?: Json | null
          despues?: Json | null
          entidad?: string
          fecha?: string
          id?: string
          motivo?: string | null
          registro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bitacora_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos_cliente: {
        Row: {
          actividad: Database["public"]["Enums"]["actividad"]
          anulado_en: string | null
          anulado_por: string | null
          cliente_id: string
          concepto: string
          creado_por: string | null
          created_at: string
          cuenta_ingreso_id: string
          estado: Database["public"]["Enums"]["estado_cargo"]
          fecha: string
          id: string
          monto: number
          motivo_anulacion: string | null
          origen_id: string
          origen_tipo: Database["public"]["Enums"]["origen_cargo"]
          vencimiento: string | null
        }
        Insert: {
          actividad: Database["public"]["Enums"]["actividad"]
          anulado_en?: string | null
          anulado_por?: string | null
          cliente_id: string
          concepto: string
          creado_por?: string | null
          created_at?: string
          cuenta_ingreso_id: string
          estado?: Database["public"]["Enums"]["estado_cargo"]
          fecha: string
          id?: string
          monto: number
          motivo_anulacion?: string | null
          origen_id: string
          origen_tipo: Database["public"]["Enums"]["origen_cargo"]
          vencimiento?: string | null
        }
        Update: {
          actividad?: Database["public"]["Enums"]["actividad"]
          anulado_en?: string | null
          anulado_por?: string | null
          cliente_id?: string
          concepto?: string
          creado_por?: string | null
          created_at?: string
          cuenta_ingreso_id?: string
          estado?: Database["public"]["Enums"]["estado_cargo"]
          fecha?: string
          id?: string
          monto?: number
          motivo_anulacion?: string | null
          origen_id?: string
          origen_tipo?: Database["public"]["Enums"]["origen_cargo"]
          vencimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargos_cliente_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cargos_cliente_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_cliente_cuenta_ingreso_id_fkey"
            columns: ["cuenta_ingreso_id"]
            isOneToOne: false
            referencedRelation: "cuentas_contables"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_gasto: {
        Row: {
          activo: boolean
          created_at: string
          cuenta_contable_id: string
          id: string
          nombre: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          cuenta_contable_id: string
          id?: string
          nombre: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          cuenta_contable_id?: string
          id?: string
          nombre?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_gasto_cuenta_contable_id_fkey"
            columns: ["cuenta_contable_id"]
            isOneToOne: false
            referencedRelation: "cuentas_contables"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          correo: string | null
          creado_por: string | null
          created_at: string
          direccion: string | null
          id: string
          identificacion: string | null
          nombre: string
          telefono: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          correo?: string | null
          creado_por?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          identificacion?: string | null
          nombre: string
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          correo?: string | null
          creado_por?: string | null
          created_at?: string
          direccion?: string | null
          id?: string
          identificacion?: string | null
          nombre?: string
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cobros_cliente: {
        Row: {
          cliente_id: string
          creado_por: string | null
          created_at: string
          cuenta_dinero_id: string
          estado: Database["public"]["Enums"]["estado_pago"]
          fecha: string
          id: string
          idempotencia: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          motivo_reverso: string | null
          referencia: string | null
          reversado_en: string | null
          reversado_por: string | null
        }
        Insert: {
          cliente_id: string
          creado_por?: string | null
          created_at?: string
          cuenta_dinero_id: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          fecha: string
          id?: string
          idempotencia: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          motivo_reverso?: string | null
          referencia?: string | null
          reversado_en?: string | null
          reversado_por?: string | null
        }
        Update: {
          cliente_id?: string
          creado_por?: string | null
          created_at?: string
          cuenta_dinero_id?: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          fecha?: string
          id?: string
          idempotencia?: string
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          motivo_reverso?: string | null
          referencia?: string | null
          reversado_en?: string | null
          reversado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobros_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cobros_cliente_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_cliente_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_cliente_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "saldos_cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_cliente_reversado_por_fkey"
            columns: ["reversado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conductores: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          creado_por: string | null
          created_at: string
          id: string
          identificacion: string | null
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          identificacion?: string | null
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          identificacion?: string | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conductores_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conductores_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas_contables: {
        Row: {
          activo: boolean
          codigo: string
          created_at: string
          id: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_cuenta_contable"]
        }
        Insert: {
          activo?: boolean
          codigo: string
          created_at?: string
          id?: string
          nombre: string
          tipo: Database["public"]["Enums"]["tipo_cuenta_contable"]
        }
        Update: {
          activo?: boolean
          codigo?: string
          created_at?: string
          id?: string
          nombre?: string
          tipo?: Database["public"]["Enums"]["tipo_cuenta_contable"]
        }
        Relationships: []
      }
      cuentas_dinero: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          banco: string | null
          creado_por: string | null
          created_at: string
          id: string
          nombre: string
          numero_cuenta: string | null
          tipo: Database["public"]["Enums"]["tipo_cuenta_dinero"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          banco?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre: string
          numero_cuenta?: string | null
          tipo: Database["public"]["Enums"]["tipo_cuenta_dinero"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          banco?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre?: string
          numero_cuenta?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cuenta_dinero"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_dinero_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cuentas_dinero_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          actividad: Database["public"]["Enums"]["actividad"]
          anulado_en: string | null
          anulado_por: string | null
          categoria_id: string
          concepto: string
          creado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_gasto"]
          fecha: string
          id: string
          idempotencia: string
          monto: number
          motivo_anulacion: string | null
          notas: string | null
          proveedor_id: string | null
          vencimiento: string | null
        }
        Insert: {
          actividad: Database["public"]["Enums"]["actividad"]
          anulado_en?: string | null
          anulado_por?: string | null
          categoria_id: string
          concepto: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_gasto"]
          fecha: string
          id?: string
          idempotencia: string
          monto: number
          motivo_anulacion?: string | null
          notas?: string | null
          proveedor_id?: string | null
          vencimiento?: string | null
        }
        Update: {
          actividad?: Database["public"]["Enums"]["actividad"]
          anulado_en?: string | null
          anulado_por?: string | null
          categoria_id?: string
          concepto?: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_gasto"]
          fecha?: string
          id?: string
          idempotencia?: string
          monto?: number
          motivo_anulacion?: string | null
          notas?: string | null
          proveedor_id?: string | null
          vencimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_anulado_por_fkey"
            columns: ["anulado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      lineas_asiento: {
        Row: {
          asiento_id: string
          cuenta_contable_id: string
          cuenta_dinero_id: string | null
          debe: number
          haber: number
          id: string
        }
        Insert: {
          asiento_id: string
          cuenta_contable_id: string
          cuenta_dinero_id?: string | null
          debe?: number
          haber?: number
          id?: string
        }
        Update: {
          asiento_id?: string
          cuenta_contable_id?: string
          cuenta_dinero_id?: string | null
          debe?: number
          haber?: number
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineas_asiento_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_asiento_cuenta_contable_id_fkey"
            columns: ["cuenta_contable_id"]
            isOneToOne: false
            referencedRelation: "cuentas_contables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_asiento_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineas_asiento_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "saldos_cuentas_dinero"
            referencedColumns: ["id"]
          },
        ]
      }
      membresia_beneficiarios: {
        Row: {
          activo: boolean
          beneficiario_id: string
          creado_por: string | null
          created_at: string
          dado_baja_en: string | null
          dado_baja_por: string | null
          fecha_alta: string
          fecha_baja: string | null
          id: string
          membresia_id: string
          motivo_baja: string | null
        }
        Insert: {
          activo?: boolean
          beneficiario_id: string
          creado_por?: string | null
          created_at?: string
          dado_baja_en?: string | null
          dado_baja_por?: string | null
          fecha_alta: string
          fecha_baja?: string | null
          id?: string
          membresia_id: string
          motivo_baja?: string | null
        }
        Update: {
          activo?: boolean
          beneficiario_id?: string
          creado_por?: string | null
          created_at?: string
          dado_baja_en?: string | null
          dado_baja_por?: string | null
          fecha_alta?: string
          fecha_baja?: string | null
          id?: string
          membresia_id?: string
          motivo_baja?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membresia_beneficiarios_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "beneficiarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresia_beneficiarios_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresia_beneficiarios_dado_baja_por_fkey"
            columns: ["dado_baja_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresia_beneficiarios_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresia_beneficiarios_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "saldos_membresias"
            referencedColumns: ["id"]
          },
        ]
      }
      membresias: {
        Row: {
          actualizado_por: string | null
          cancelada_en: string | null
          cancelada_por: string | null
          cliente_id: string
          creado_por: string | null
          created_at: string
          cupo_pactado: number
          dia_ancla: number
          dias_gracia: number
          estado: Database["public"]["Enums"]["estado_membresia"]
          fecha_inicio: string
          id: string
          idempotencia: string
          modalidad_cupo: Database["public"]["Enums"]["modalidad_cupo"]
          motivo_cancelacion: string | null
          plan_id: string
          precio_pactado: number
          proxima_renovacion: string
          suspendida_desde: string | null
          updated_at: string
        }
        Insert: {
          actualizado_por?: string | null
          cancelada_en?: string | null
          cancelada_por?: string | null
          cliente_id: string
          creado_por?: string | null
          created_at?: string
          cupo_pactado: number
          dia_ancla: number
          dias_gracia: number
          estado?: Database["public"]["Enums"]["estado_membresia"]
          fecha_inicio: string
          id?: string
          idempotencia: string
          modalidad_cupo: Database["public"]["Enums"]["modalidad_cupo"]
          motivo_cancelacion?: string | null
          plan_id: string
          precio_pactado: number
          proxima_renovacion: string
          suspendida_desde?: string | null
          updated_at?: string
        }
        Update: {
          actualizado_por?: string | null
          cancelada_en?: string | null
          cancelada_por?: string | null
          cliente_id?: string
          creado_por?: string | null
          created_at?: string
          cupo_pactado?: number
          dia_ancla?: number
          dias_gracia?: number
          estado?: Database["public"]["Enums"]["estado_membresia"]
          fecha_inicio?: string
          id?: string
          idempotencia?: string
          modalidad_cupo?: Database["public"]["Enums"]["modalidad_cupo"]
          motivo_cancelacion?: string | null
          plan_id?: string
          precio_pactado?: number
          proxima_renovacion?: string
          suspendida_desde?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membresias_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_cancelada_por_fkey"
            columns: ["cancelada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "membresias_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      movimientos_dinero: {
        Row: {
          asiento_id: string
          creado_por: string | null
          created_at: string
          cuenta_dinero_id: string
          evento: Database["public"]["Enums"]["evento_financiero"]
          fecha: string
          id: string
          monto_con_signo: number
          origen_id: string
          origen_tipo: Database["public"]["Enums"]["origen_financiero"]
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Insert: {
          asiento_id: string
          creado_por?: string | null
          created_at?: string
          cuenta_dinero_id: string
          evento: Database["public"]["Enums"]["evento_financiero"]
          fecha: string
          id?: string
          monto_con_signo: number
          origen_id: string
          origen_tipo: Database["public"]["Enums"]["origen_financiero"]
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Update: {
          asiento_id?: string
          creado_por?: string | null
          created_at?: string
          cuenta_dinero_id?: string
          evento?: Database["public"]["Enums"]["evento_financiero"]
          fecha?: string
          id?: string
          monto_con_signo?: number
          origen_id?: string
          origen_tipo?: Database["public"]["Enums"]["origen_financiero"]
          tipo?: Database["public"]["Enums"]["tipo_movimiento"]
        }
        Relationships: [
          {
            foreignKeyName: "movimientos_dinero_asiento_id_fkey"
            columns: ["asiento_id"]
            isOneToOne: false
            referencedRelation: "asientos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_dinero_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_dinero_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimientos_dinero_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "saldos_cuentas_dinero"
            referencedColumns: ["id"]
          },
        ]
      }
      pagos_gasto: {
        Row: {
          creado_por: string | null
          created_at: string
          cuenta_dinero_id: string
          estado: Database["public"]["Enums"]["estado_pago"]
          fecha: string
          gasto_id: string
          id: string
          idempotencia: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          motivo_reverso: string | null
          referencia: string | null
          reversado_en: string | null
          reversado_por: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          cuenta_dinero_id: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          fecha: string
          gasto_id: string
          id?: string
          idempotencia: string
          metodo: Database["public"]["Enums"]["metodo_pago"]
          monto: number
          motivo_reverso?: string | null
          referencia?: string | null
          reversado_en?: string | null
          reversado_por?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          cuenta_dinero_id?: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          fecha?: string
          gasto_id?: string
          id?: string
          idempotencia?: string
          metodo?: Database["public"]["Enums"]["metodo_pago"]
          monto?: number
          motivo_reverso?: string | null
          referencia?: string | null
          reversado_en?: string | null
          reversado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagos_gasto_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_gasto_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_gasto_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "saldos_cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_gasto_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: false
            referencedRelation: "gastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_gasto_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: false
            referencedRelation: "saldos_gastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagos_gasto_reversado_por_fkey"
            columns: ["reversado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      perfiles: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          correo: string | null
          created_at: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol_usuario"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          correo?: string | null
          created_at?: string
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          correo?: string | null
          created_at?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol_usuario"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      periodos_membresia: {
        Row: {
          cargo_id: string | null
          creado_por: string | null
          created_at: string
          cupo_asignado: number
          dias_gracia: number
          fin: string
          id: string
          inicio: string
          limite_pago: string | null
          membresia_id: string
          modalidad_cupo: Database["public"]["Enums"]["modalidad_cupo"]
          precio: number
        }
        Insert: {
          cargo_id?: string | null
          creado_por?: string | null
          created_at?: string
          cupo_asignado: number
          dias_gracia: number
          fin: string
          id?: string
          inicio: string
          limite_pago?: string | null
          membresia_id: string
          modalidad_cupo: Database["public"]["Enums"]["modalidad_cupo"]
          precio: number
        }
        Update: {
          cargo_id?: string | null
          creado_por?: string | null
          created_at?: string
          cupo_asignado?: number
          dias_gracia?: number
          fin?: string
          id?: string
          inicio?: string
          limite_pago?: string | null
          membresia_id?: string
          modalidad_cupo?: Database["public"]["Enums"]["modalidad_cupo"]
          precio?: number
        }
        Relationships: [
          {
            foreignKeyName: "periodos_membresia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "cargos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_membresia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "saldos_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_membresia_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_membresia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_membresia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "saldos_membresias"
            referencedColumns: ["id"]
          },
        ]
      }
      planes: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          creado_por: string | null
          created_at: string
          cupo_mensual: number
          dias_gracia: number
          id: string
          modalidad_cupo: Database["public"]["Enums"]["modalidad_cupo"]
          nombre: string
          precio_mensual: number
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          cupo_mensual: number
          dias_gracia: number
          id?: string
          modalidad_cupo: Database["public"]["Enums"]["modalidad_cupo"]
          nombre: string
          precio_mensual: number
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          cupo_mensual?: number
          dias_gracia?: number
          id?: string
          modalidad_cupo?: Database["public"]["Enums"]["modalidad_cupo"]
          nombre?: string
          precio_mensual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planes_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          creado_por: string | null
          created_at: string
          id: string
          identificacion: string | null
          nombre: string
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          identificacion?: string | null
          nombre: string
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          identificacion?: string | null
          nombre?: string
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proveedores_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proveedores_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tarifas: {
        Row: {
          actividad: Database["public"]["Enums"]["actividad"]
          activo: boolean
          actualizado_por: string | null
          creado_por: string | null
          created_at: string
          id: string
          nombre: string
          precio_base: number
          unidad: Database["public"]["Enums"]["unidad_tarifa"]
          updated_at: string
        }
        Insert: {
          actividad: Database["public"]["Enums"]["actividad"]
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre: string
          precio_base: number
          unidad: Database["public"]["Enums"]["unidad_tarifa"]
          updated_at?: string
        }
        Update: {
          actividad?: Database["public"]["Enums"]["actividad"]
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre?: string
          precio_base?: number
          unidad?: Database["public"]["Enums"]["unidad_tarifa"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarifas_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarifas_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transferencias: {
        Row: {
          creado_por: string | null
          created_at: string
          cuenta_destino_id: string
          cuenta_origen_id: string
          estado: Database["public"]["Enums"]["estado_pago"]
          fecha: string
          id: string
          idempotencia: string
          monto: number
          motivo_reverso: string | null
          referencia: string | null
          reversado_en: string | null
          reversado_por: string | null
        }
        Insert: {
          creado_por?: string | null
          created_at?: string
          cuenta_destino_id: string
          cuenta_origen_id: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          fecha: string
          id?: string
          idempotencia: string
          monto: number
          motivo_reverso?: string | null
          referencia?: string | null
          reversado_en?: string | null
          reversado_por?: string | null
        }
        Update: {
          creado_por?: string | null
          created_at?: string
          cuenta_destino_id?: string
          cuenta_origen_id?: string
          estado?: Database["public"]["Enums"]["estado_pago"]
          fecha?: string
          id?: string
          idempotencia?: string
          monto?: number
          motivo_reverso?: string | null
          referencia?: string | null
          reversado_en?: string | null
          reversado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_cuenta_destino_id_fkey"
            columns: ["cuenta_destino_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_cuenta_destino_id_fkey"
            columns: ["cuenta_destino_id"]
            isOneToOne: false
            referencedRelation: "saldos_cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_cuenta_origen_id_fkey"
            columns: ["cuenta_origen_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_cuenta_origen_id_fkey"
            columns: ["cuenta_origen_id"]
            isOneToOne: false
            referencedRelation: "saldos_cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_reversado_por_fkey"
            columns: ["reversado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehiculos: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          anio: number | null
          codigo: string
          creado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_vehiculo"]
          id: string
          marca: string | null
          modelo: string | null
          placa: string | null
          tipo: Database["public"]["Enums"]["tipo_vehiculo"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          anio?: number | null
          codigo: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_vehiculo"]
          id?: string
          marca?: string | null
          modelo?: string | null
          placa?: string | null
          tipo: Database["public"]["Enums"]["tipo_vehiculo"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          anio?: number | null
          codigo?: string
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_vehiculo"]
          id?: string
          marca?: string | null
          modelo?: string | null
          placa?: string | null
          tipo?: Database["public"]["Enums"]["tipo_vehiculo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehiculos_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehiculos_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      saldos_cargos: {
        Row: {
          actividad: Database["public"]["Enums"]["actividad"] | null
          anulado_en: string | null
          aplicado: number | null
          cliente_id: string | null
          cliente_nombre: string | null
          concepto: string | null
          created_at: string | null
          cuenta_ingreso_id: string | null
          estado: Database["public"]["Enums"]["estado_cargo"] | null
          fecha: string | null
          id: string | null
          monto: number | null
          motivo_anulacion: string | null
          origen_id: string | null
          origen_tipo: Database["public"]["Enums"]["origen_cargo"] | null
          pendiente: number | null
          vencimiento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cargos_cliente_cuenta_ingreso_id_fkey"
            columns: ["cuenta_ingreso_id"]
            isOneToOne: false
            referencedRelation: "cuentas_contables"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos_clientes: {
        Row: {
          activo: boolean | null
          cliente_id: string | null
          cliente_nombre: string | null
          pendiente: number | null
          proximo_vencimiento: string | null
          saldo_a_favor: number | null
          total_aplicado: number | null
          total_cargos: number | null
        }
        Relationships: []
      }
      saldos_cobros: {
        Row: {
          aplicado: number | null
          cliente_id: string | null
          cliente_nombre: string | null
          created_at: string | null
          cuenta_dinero_id: string | null
          cuenta_nombre: string | null
          disponible: number | null
          estado: Database["public"]["Enums"]["estado_pago"] | null
          fecha: string | null
          id: string | null
          metodo: Database["public"]["Enums"]["metodo_pago"] | null
          monto: number | null
          motivo_reverso: string | null
          referencia: string | null
          reversado_en: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobros_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_cliente_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cobros_cliente_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "cuentas_dinero"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobros_cliente_cuenta_dinero_id_fkey"
            columns: ["cuenta_dinero_id"]
            isOneToOne: false
            referencedRelation: "saldos_cuentas_dinero"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos_cuentas_dinero: {
        Row: {
          activo: boolean | null
          banco: string | null
          id: string | null
          nombre: string | null
          numero_cuenta: string | null
          saldo: number | null
          tipo: Database["public"]["Enums"]["tipo_cuenta_dinero"] | null
          ultimo_movimiento: string | null
        }
        Relationships: []
      }
      saldos_gastos: {
        Row: {
          actividad: Database["public"]["Enums"]["actividad"] | null
          anulado_en: string | null
          categoria_id: string | null
          categoria_nombre: string | null
          concepto: string | null
          created_at: string | null
          estado: Database["public"]["Enums"]["estado_gasto"] | null
          fecha: string | null
          id: string | null
          monto: number | null
          motivo_anulacion: string | null
          notas: string | null
          pagado: number | null
          pendiente: number | null
          proveedor_id: string | null
          proveedor_nombre: string | null
          vencimiento: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_gasto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos_membresias: {
        Row: {
          beneficiarios_activos: number | null
          cancelada_en: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          created_at: string | null
          cuotas_vencidas: number | null
          cupo_pactado: number | null
          dia_ancla: number | null
          dias_gracia: number | null
          estado: Database["public"]["Enums"]["estado_membresia"] | null
          fecha_inicio: string | null
          id: string | null
          modalidad_cupo: Database["public"]["Enums"]["modalidad_cupo"] | null
          motivo_cancelacion: string | null
          pendiente: number | null
          plan_id: string | null
          plan_nombre: string | null
          precio_pactado: number | null
          proxima_renovacion: string | null
          suspendida_desde: string | null
          vencido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "membresias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "membresias_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos_periodos: {
        Row: {
          aplicado: number | null
          cargo_estado: Database["public"]["Enums"]["estado_cargo"] | null
          cargo_id: string | null
          cliente_id: string | null
          created_at: string | null
          cupo_asignado: number | null
          dias_gracia: number | null
          fin: string | null
          id: string | null
          inicio: string | null
          limite_pago: string | null
          membresia_id: string | null
          modalidad_cupo: Database["public"]["Enums"]["modalidad_cupo"] | null
          pendiente: number | null
          precio: number | null
          vencida: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "membresias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membresias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "periodos_membresia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "cargos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_membresia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "saldos_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_membresia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "periodos_membresia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "saldos_membresias"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      actualizar_condiciones_membresia: {
        Args: {
          p_cupo: number
          p_dias_gracia: number
          p_membresia_id: string
          p_modalidad: Database["public"]["Enums"]["modalidad_cupo"]
          p_motivo: string
          p_precio: number
        }
        Returns: undefined
      }
      actualizar_mensualidades: {
        Args: { p_cliente_id?: string; p_membresia_id?: string }
        Returns: Json
      }
      actualizar_perfil: {
        Args: {
          p_activo: boolean
          p_id: string
          p_motivo?: string
          p_nombre: string
          p_rol: Database["public"]["Enums"]["rol_usuario"]
        }
        Returns: undefined
      }
      agregar_beneficiario_membresia: {
        Args: { p_beneficiario_id: string; p_membresia_id: string }
        Returns: string
      }
      anular_cargo: {
        Args: { p_cargo_id: string; p_motivo: string }
        Returns: undefined
      }
      anular_gasto: {
        Args: { p_gasto_id: string; p_motivo: string }
        Returns: undefined
      }
      aplicar_saldo_a_favor: {
        Args: { p_cargo_id: string; p_idempotencia: string; p_monto: number }
        Returns: number
      }
      cancelar_membresia: {
        Args: { p_membresia_id: string; p_motivo: string }
        Returns: undefined
      }
      consultar_cobertura: {
        Args: {
          p_beneficiario_id: string
          p_fecha: string
          p_membresia_id: string
        }
        Returns: {
          aviso: string
          cubierto: boolean
          cupo: number
          disponibles: number
          modalidad: Database["public"]["Enums"]["modalidad_cupo"]
          motivo: string
          periodo_fin: string
          periodo_id: string
          periodo_inicio: string
          usados: number
        }[]
      }
      historial_membresia: {
        Args: { p_membresia_id: string }
        Returns: {
          accion: string
          actor: string
          antes: Json
          despues: Json
          entidad: string
          fecha: string
          motivo: string
        }[]
      }
      inactivar_beneficiario_membresia: {
        Args: { p_motivo: string; p_vinculo_id: string }
        Returns: undefined
      }
      registrar_apertura: {
        Args: {
          p_cuenta_dinero_id: string
          p_fecha: string
          p_idempotencia: string
          p_monto: number
        }
        Returns: string
      }
      registrar_cargo: {
        Args: {
          p_cliente_id: string
          p_concepto: string
          p_cuenta_ingreso: string
          p_fecha: string
          p_idempotencia: string
          p_monto: number
          p_vencimiento: string
        }
        Returns: string
      }
      registrar_cobro: {
        Args: {
          p_aplicaciones?: Json
          p_cliente_id: string
          p_cuenta_dinero_id: string
          p_fecha: string
          p_idempotencia: string
          p_metodo: Database["public"]["Enums"]["metodo_pago"]
          p_monto: number
          p_referencia: string
        }
        Returns: string
      }
      registrar_gasto: {
        Args: {
          p_actividad: Database["public"]["Enums"]["actividad"]
          p_categoria_id: string
          p_concepto: string
          p_fecha: string
          p_idempotencia: string
          p_monto: number
          p_notas: string
          p_pago?: Json
          p_proveedor_id: string
          p_vencimiento: string
        }
        Returns: string
      }
      registrar_membresia: {
        Args: {
          p_beneficiarios: string[]
          p_cliente_id: string
          p_condiciones?: Json
          p_fecha_inicio: string
          p_idempotencia: string
          p_plan_id: string
        }
        Returns: string
      }
      registrar_pago_gasto: {
        Args: {
          p_cuenta_dinero_id: string
          p_fecha: string
          p_gasto_id: string
          p_idempotencia: string
          p_metodo: Database["public"]["Enums"]["metodo_pago"]
          p_monto: number
          p_referencia: string
        }
        Returns: string
      }
      registrar_transferencia: {
        Args: {
          p_cuenta_destino_id: string
          p_cuenta_origen_id: string
          p_fecha: string
          p_idempotencia: string
          p_monto: number
          p_referencia: string
        }
        Returns: string
      }
      reversar_apertura: {
        Args: { p_apertura_id: string; p_motivo: string }
        Returns: undefined
      }
      reversar_aplicacion: {
        Args: { p_aplicacion_id: string; p_motivo: string }
        Returns: undefined
      }
      reversar_cobro: {
        Args: { p_cobro_id: string; p_motivo: string }
        Returns: undefined
      }
      reversar_pago_gasto: {
        Args: { p_motivo: string; p_pago_id: string }
        Returns: undefined
      }
      reversar_transferencia: {
        Args: { p_motivo: string; p_transferencia_id: string }
        Returns: undefined
      }
    }
    Enums: {
      actividad: "ambulancias" | "alquileres" | "transportes" | "general"
      estado_aplicacion: "vigente" | "reversada"
      estado_asiento: "confirmado" | "reversado"
      estado_cargo: "vigente" | "anulado"
      estado_gasto: "registrado" | "anulado"
      estado_membresia: "activa" | "suspendida" | "cancelada"
      estado_pago: "confirmado" | "reversado"
      estado_vehiculo: "operativo" | "mantenimiento" | "fuera_servicio"
      evento_financiero: "registro" | "reverso"
      metodo_pago: "efectivo" | "transferencia" | "tarjeta" | "otro"
      modalidad_cupo: "compartido" | "individual"
      origen_cargo: "manual" | "periodo_membresia"
      origen_financiero:
        | "cargo"
        | "cobro"
        | "aplicacion"
        | "gasto"
        | "pago_gasto"
        | "transferencia"
        | "apertura"
      rol_usuario: "administrador" | "operador" | "finanzas"
      tipo_cliente: "natural" | "juridica"
      tipo_cuenta_contable:
        | "activo"
        | "pasivo"
        | "patrimonio"
        | "ingreso"
        | "gasto"
      tipo_cuenta_dinero: "caja" | "banco"
      tipo_movimiento: "ingreso" | "egreso" | "apertura" | "transferencia"
      tipo_vehiculo: "ambulancia" | "alquiler" | "transporte" | "mixto"
      unidad_tarifa: "dia" | "servicio"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      actividad: ["ambulancias", "alquileres", "transportes", "general"],
      estado_aplicacion: ["vigente", "reversada"],
      estado_asiento: ["confirmado", "reversado"],
      estado_cargo: ["vigente", "anulado"],
      estado_gasto: ["registrado", "anulado"],
      estado_membresia: ["activa", "suspendida", "cancelada"],
      estado_pago: ["confirmado", "reversado"],
      estado_vehiculo: ["operativo", "mantenimiento", "fuera_servicio"],
      evento_financiero: ["registro", "reverso"],
      metodo_pago: ["efectivo", "transferencia", "tarjeta", "otro"],
      modalidad_cupo: ["compartido", "individual"],
      origen_cargo: ["manual", "periodo_membresia"],
      origen_financiero: [
        "cargo",
        "cobro",
        "aplicacion",
        "gasto",
        "pago_gasto",
        "transferencia",
        "apertura",
      ],
      rol_usuario: ["administrador", "operador", "finanzas"],
      tipo_cliente: ["natural", "juridica"],
      tipo_cuenta_contable: [
        "activo",
        "pasivo",
        "patrimonio",
        "ingreso",
        "gasto",
      ],
      tipo_cuenta_dinero: ["caja", "banco"],
      tipo_movimiento: ["ingreso", "egreso", "apertura", "transferencia"],
      tipo_vehiculo: ["ambulancia", "alquiler", "transporte", "mixto"],
      unidad_tarifa: ["dia", "servicio"],
    },
  },
} as const
