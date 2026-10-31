// Generado con Supabase MCP tras empleados y remuneraciones (2026-10-31).
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
      alquileres: {
        Row: {
          actualizado_por: string | null
          cancelado_en: string | null
          cancelado_por: string | null
          cargo_id: string | null
          cliente_id: string
          combustible_regreso:
            | Database["public"]["Enums"]["nivel_combustible"]
            | null
          combustible_salida:
            | Database["public"]["Enums"]["nivel_combustible"]
            | null
          creado_por: string | null
          created_at: string
          devolucion_prevista: string
          devolucion_real: string | null
          entrega_prevista: string
          entrega_real: string | null
          estado: Database["public"]["Enums"]["estado_alquiler"]
          id: string
          idempotencia: string
          km_regreso: number | null
          km_salida: number | null
          motivo_cancelacion: string | null
          motivo_correccion_km: string | null
          notas: string | null
          notas_devolucion: string | null
          notas_entrega: string | null
          precio_pactado: number
          tarifa_id: string | null
          updated_at: string
          vehiculo_id: string
        }
        Insert: {
          actualizado_por?: string | null
          cancelado_en?: string | null
          cancelado_por?: string | null
          cargo_id?: string | null
          cliente_id: string
          combustible_regreso?:
            | Database["public"]["Enums"]["nivel_combustible"]
            | null
          combustible_salida?:
            | Database["public"]["Enums"]["nivel_combustible"]
            | null
          creado_por?: string | null
          created_at?: string
          devolucion_prevista: string
          devolucion_real?: string | null
          entrega_prevista: string
          entrega_real?: string | null
          estado?: Database["public"]["Enums"]["estado_alquiler"]
          id?: string
          idempotencia: string
          km_regreso?: number | null
          km_salida?: number | null
          motivo_cancelacion?: string | null
          motivo_correccion_km?: string | null
          notas?: string | null
          notas_devolucion?: string | null
          notas_entrega?: string | null
          precio_pactado: number
          tarifa_id?: string | null
          updated_at?: string
          vehiculo_id: string
        }
        Update: {
          actualizado_por?: string | null
          cancelado_en?: string | null
          cancelado_por?: string | null
          cargo_id?: string | null
          cliente_id?: string
          combustible_regreso?:
            | Database["public"]["Enums"]["nivel_combustible"]
            | null
          combustible_salida?:
            | Database["public"]["Enums"]["nivel_combustible"]
            | null
          creado_por?: string | null
          created_at?: string
          devolucion_prevista?: string
          devolucion_real?: string | null
          entrega_prevista?: string
          entrega_real?: string | null
          estado?: Database["public"]["Enums"]["estado_alquiler"]
          id?: string
          idempotencia?: string
          km_regreso?: number | null
          km_salida?: number | null
          motivo_cancelacion?: string | null
          motivo_correccion_km?: string | null
          notas?: string | null
          notas_devolucion?: string | null
          notas_entrega?: string | null
          precio_pactado?: number
          tarifa_id?: string | null
          updated_at?: string
          vehiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alquileres_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "cargos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "saldos_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "alquileres_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
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
      cargos_adicionales_alquiler: {
        Row: {
          alquiler_id: string
          concepto: string
          creado_por: string | null
          created_at: string
          id: string
          monto: number
        }
        Insert: {
          alquiler_id: string
          concepto: string
          creado_por?: string | null
          created_at?: string
          id?: string
          monto: number
        }
        Update: {
          alquiler_id?: string
          concepto?: string
          creado_por?: string | null
          created_at?: string
          id?: string
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "cargos_adicionales_alquiler_alquiler_id_fkey"
            columns: ["alquiler_id"]
            isOneToOne: false
            referencedRelation: "alquileres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_adicionales_alquiler_alquiler_id_fkey"
            columns: ["alquiler_id"]
            isOneToOne: false
            referencedRelation: "saldos_alquileres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargos_adicionales_alquiler_creado_por_fkey"
            columns: ["creado_por"]
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
      contratos_membresia: {
        Row: {
          contenido: string
          creado_por: string | null
          created_at: string
          datos: Json
          id: string
          membresia_id: string
          plantilla_version: number
        }
        Insert: {
          contenido: string
          creado_por?: string | null
          created_at?: string
          datos: Json
          id?: string
          membresia_id: string
          plantilla_version: number
        }
        Update: {
          contenido?: string
          creado_por?: string | null
          created_at?: string
          datos?: Json
          id?: string
          membresia_id?: string
          plantilla_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_membresia_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_membresia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: true
            referencedRelation: "membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_membresia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: true
            referencedRelation: "saldos_membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_membresia_plantilla_version_fkey"
            columns: ["plantilla_version"]
            isOneToOne: false
            referencedRelation: "plantillas_contrato"
            referencedColumns: ["version"]
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
      empleados: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          creado_por: string | null
          created_at: string
          id: string
          nombre: string
          puesto: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre: string
          puesto?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          creado_por?: string | null
          created_at?: string
          id?: string
          nombre?: string
          puesto?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empleados_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empleados_creado_por_fkey"
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
      gastos_personal: {
        Row: {
          conductor_id: string | null
          empleado_id: string | null
          gasto_id: string
          nombre_destinatario: string
        }
        Insert: {
          conductor_id?: string | null
          empleado_id?: string | null
          gasto_id: string
          nombre_destinatario: string
        }
        Update: {
          conductor_id?: string | null
          empleado_id?: string | null
          gasto_id?: string
          nombre_destinatario?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_personal_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_personal_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_personal_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: true
            referencedRelation: "gastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_personal_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: true
            referencedRelation: "saldos_gastos"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos_servicio: {
        Row: {
          alquiler_id: string | null
          created_at: string
          gasto_id: string
          membresia_id: string | null
          transporte_id: string | null
          traslado_id: string | null
        }
        Insert: {
          alquiler_id?: string | null
          created_at?: string
          gasto_id: string
          membresia_id?: string | null
          transporte_id?: string | null
          traslado_id?: string | null
        }
        Update: {
          alquiler_id?: string | null
          created_at?: string
          gasto_id?: string
          membresia_id?: string | null
          transporte_id?: string | null
          traslado_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gastos_servicio_alquiler_id_fkey"
            columns: ["alquiler_id"]
            isOneToOne: false
            referencedRelation: "alquileres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_servicio_alquiler_id_fkey"
            columns: ["alquiler_id"]
            isOneToOne: false
            referencedRelation: "saldos_alquileres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_servicio_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: true
            referencedRelation: "gastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_servicio_gasto_id_fkey"
            columns: ["gasto_id"]
            isOneToOne: true
            referencedRelation: "saldos_gastos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_servicio_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_servicio_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "saldos_membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_servicio_transporte_id_fkey"
            columns: ["transporte_id"]
            isOneToOne: false
            referencedRelation: "saldos_transportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_servicio_transporte_id_fkey"
            columns: ["transporte_id"]
            isOneToOne: false
            referencedRelation: "transportes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_servicio_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "saldos_traslados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_servicio_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados_ambulancia"
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
          fecha_fin: string | null
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
          fecha_fin?: string | null
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
          fecha_fin?: string | null
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
      ocupaciones_recurso: {
        Row: {
          activa: boolean
          creado_por: string | null
          created_at: string
          en_curso: boolean
          id: string
          intervalo: unknown
          liberada_en: string | null
          origen_id: string
          origen_tipo: Database["public"]["Enums"]["origen_ocupacion"]
          recurso_id: string
          recurso_tipo: string
        }
        Insert: {
          activa?: boolean
          creado_por?: string | null
          created_at?: string
          en_curso?: boolean
          id?: string
          intervalo: unknown
          liberada_en?: string | null
          origen_id: string
          origen_tipo: Database["public"]["Enums"]["origen_ocupacion"]
          recurso_id: string
          recurso_tipo: string
        }
        Update: {
          activa?: boolean
          creado_por?: string | null
          created_at?: string
          en_curso?: boolean
          id?: string
          intervalo?: unknown
          liberada_en?: string | null
          origen_id?: string
          origen_tipo?: Database["public"]["Enums"]["origen_ocupacion"]
          recurso_id?: string
          recurso_tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocupaciones_recurso_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
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
      plantillas_contrato: {
        Row: {
          contenido: string
          creado_por: string | null
          created_at: string
          id: string
          version: number
        }
        Insert: {
          contenido: string
          creado_por?: string | null
          created_at?: string
          id?: string
          version: number
        }
        Update: {
          contenido?: string
          creado_por?: string | null
          created_at?: string
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plantillas_contrato_creado_por_fkey"
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
      reservas_beneficio: {
        Row: {
          beneficiario_id: string
          consumida_en: string | null
          creado_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_reserva"]
          fecha_servicio: string
          id: string
          liberada_en: string | null
          liberada_por: string | null
          membresia_id: string
          motivo_liberacion: string | null
          periodo_id: string | null
          periodo_inicio: string
          traslado_id: string
        }
        Insert: {
          beneficiario_id: string
          consumida_en?: string | null
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_reserva"]
          fecha_servicio: string
          id?: string
          liberada_en?: string | null
          liberada_por?: string | null
          membresia_id: string
          motivo_liberacion?: string | null
          periodo_id?: string | null
          periodo_inicio: string
          traslado_id: string
        }
        Update: {
          beneficiario_id?: string
          consumida_en?: string | null
          creado_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_reserva"]
          fecha_servicio?: string
          id?: string
          liberada_en?: string | null
          liberada_por?: string | null
          membresia_id?: string
          motivo_liberacion?: string | null
          periodo_id?: string | null
          periodo_inicio?: string
          traslado_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservas_beneficio_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "beneficiarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_beneficio_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_beneficio_liberada_por_fkey"
            columns: ["liberada_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_beneficio_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_beneficio_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "saldos_membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_beneficio_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodos_membresia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_beneficio_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "saldos_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_beneficio_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "saldos_traslados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservas_beneficio_traslado_id_fkey"
            columns: ["traslado_id"]
            isOneToOne: false
            referencedRelation: "traslados_ambulancia"
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
      transportes: {
        Row: {
          actualizado_por: string | null
          cancelado_en: string | null
          cancelado_por: string | null
          cargo_id: string | null
          cliente_id: string
          conductor_id: string | null
          creado_por: string | null
          created_at: string
          destino: string
          estado: Database["public"]["Enums"]["estado_transporte"]
          fin_real: string | null
          id: string
          idempotencia: string
          inicio_previsto: string
          inicio_real: string | null
          minutos_estimados: number
          motivo_cancelacion: string | null
          notas: string | null
          notas_finales: string | null
          origen: string
          precio_pactado: number | null
          tarifa_id: string | null
          updated_at: string
          vehiculo_id: string | null
        }
        Insert: {
          actualizado_por?: string | null
          cancelado_en?: string | null
          cancelado_por?: string | null
          cargo_id?: string | null
          cliente_id: string
          conductor_id?: string | null
          creado_por?: string | null
          created_at?: string
          destino: string
          estado?: Database["public"]["Enums"]["estado_transporte"]
          fin_real?: string | null
          id?: string
          idempotencia: string
          inicio_previsto: string
          inicio_real?: string | null
          minutos_estimados?: number
          motivo_cancelacion?: string | null
          notas?: string | null
          notas_finales?: string | null
          origen: string
          precio_pactado?: number | null
          tarifa_id?: string | null
          updated_at?: string
          vehiculo_id?: string | null
        }
        Update: {
          actualizado_por?: string | null
          cancelado_en?: string | null
          cancelado_por?: string | null
          cargo_id?: string | null
          cliente_id?: string
          conductor_id?: string | null
          creado_por?: string | null
          created_at?: string
          destino?: string
          estado?: Database["public"]["Enums"]["estado_transporte"]
          fin_real?: string | null
          id?: string
          idempotencia?: string
          inicio_previsto?: string
          inicio_real?: string | null
          minutos_estimados?: number
          motivo_cancelacion?: string | null
          notas?: string | null
          notas_finales?: string | null
          origen?: string
          precio_pactado?: number | null
          tarifa_id?: string | null
          updated_at?: string
          vehiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transportes_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "cargos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "saldos_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "transportes_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      traslados_ambulancia: {
        Row: {
          actualizado_por: string | null
          beneficiario_id: string | null
          cancelado_en: string | null
          cancelado_por: string | null
          cargo_id: string | null
          cliente_id: string
          condicion_cobertura:
            | Database["public"]["Enums"]["condicion_cobertura"]
            | null
          conductor_id: string | null
          creado_por: string | null
          created_at: string
          destino: string | null
          estado: Database["public"]["Enums"]["estado_traslado"]
          fin_real: string | null
          id: string
          idempotencia: string
          inicio_previsto: string
          inicio_real: string | null
          membresia_id: string | null
          minutos_estimados: number
          motivo: string | null
          motivo_cancelacion: string | null
          motivo_cobertura: string | null
          notas: string | null
          notas_finales: string | null
          origen: string
          pasajero: string | null
          periodo_id: string | null
          precio_pactado: number | null
          tarifa_id: string | null
          tipo: Database["public"]["Enums"]["tipo_traslado"]
          updated_at: string
          vehiculo_id: string | null
        }
        Insert: {
          actualizado_por?: string | null
          beneficiario_id?: string | null
          cancelado_en?: string | null
          cancelado_por?: string | null
          cargo_id?: string | null
          cliente_id: string
          condicion_cobertura?:
            | Database["public"]["Enums"]["condicion_cobertura"]
            | null
          conductor_id?: string | null
          creado_por?: string | null
          created_at?: string
          destino?: string | null
          estado?: Database["public"]["Enums"]["estado_traslado"]
          fin_real?: string | null
          id?: string
          idempotencia: string
          inicio_previsto: string
          inicio_real?: string | null
          membresia_id?: string | null
          minutos_estimados?: number
          motivo?: string | null
          motivo_cancelacion?: string | null
          motivo_cobertura?: string | null
          notas?: string | null
          notas_finales?: string | null
          origen: string
          pasajero?: string | null
          periodo_id?: string | null
          precio_pactado?: number | null
          tarifa_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_traslado"]
          updated_at?: string
          vehiculo_id?: string | null
        }
        Update: {
          actualizado_por?: string | null
          beneficiario_id?: string | null
          cancelado_en?: string | null
          cancelado_por?: string | null
          cargo_id?: string | null
          cliente_id?: string
          condicion_cobertura?:
            | Database["public"]["Enums"]["condicion_cobertura"]
            | null
          conductor_id?: string | null
          creado_por?: string | null
          created_at?: string
          destino?: string | null
          estado?: Database["public"]["Enums"]["estado_traslado"]
          fin_real?: string | null
          id?: string
          idempotencia?: string
          inicio_previsto?: string
          inicio_real?: string | null
          membresia_id?: string | null
          minutos_estimados?: number
          motivo?: string | null
          motivo_cancelacion?: string | null
          motivo_cobertura?: string | null
          notas?: string | null
          notas_finales?: string | null
          origen?: string
          pasajero?: string | null
          periodo_id?: string | null
          precio_pactado?: number | null
          tarifa_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_traslado"]
          updated_at?: string
          vehiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traslados_ambulancia_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "beneficiarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "cargos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "saldos_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_creado_por_fkey"
            columns: ["creado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "saldos_membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodos_membresia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "saldos_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
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
      saldos_alquileres: {
        Row: {
          aplicado: number | null
          cancelado_en: string | null
          cargo_estado: Database["public"]["Enums"]["estado_cargo"] | null
          cargo_id: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          combustible_regreso:
            | Database["public"]["Enums"]["nivel_combustible"]
            | null
          combustible_salida:
            | Database["public"]["Enums"]["nivel_combustible"]
            | null
          created_at: string | null
          devolucion_prevista: string | null
          devolucion_real: string | null
          entrega_prevista: string | null
          entrega_real: string | null
          estado: Database["public"]["Enums"]["estado_alquiler"] | null
          estado_financiero: string | null
          id: string | null
          importe_total: number | null
          km_recorridos: number | null
          km_regreso: number | null
          km_salida: number | null
          motivo_cancelacion: string | null
          motivo_correccion_km: string | null
          notas: string | null
          notas_devolucion: string | null
          notas_entrega: string | null
          pendiente: number | null
          precio_pactado: number | null
          tarifa_id: string | null
          total_adicionales: number | null
          updated_at: string | null
          vehiculo_codigo: string | null
          vehiculo_id: string | null
          vehiculo_placa: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alquileres_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "cargos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "saldos_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "alquileres_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alquileres_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
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
          fecha_fin: string | null
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
      saldos_transportes: {
        Row: {
          aplicado: number | null
          cancelado_en: string | null
          cargo_estado: Database["public"]["Enums"]["estado_cargo"] | null
          cargo_id: string | null
          cliente_id: string | null
          cliente_nombre: string | null
          conductor_id: string | null
          conductor_nombre: string | null
          created_at: string | null
          destino: string | null
          estado: Database["public"]["Enums"]["estado_transporte"] | null
          estado_financiero: string | null
          fin_previsto: string | null
          fin_real: string | null
          id: string | null
          inicio_previsto: string | null
          inicio_real: string | null
          minutos_estimados: number | null
          motivo_cancelacion: string | null
          notas: string | null
          notas_finales: string | null
          origen: string | null
          pendiente: number | null
          precio_pactado: number | null
          tarifa_id: string | null
          updated_at: string | null
          vehiculo_codigo: string | null
          vehiculo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transportes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "cargos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "saldos_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "transportes_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transportes_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos_traslados: {
        Row: {
          aplicado: number | null
          beneficiario_id: string | null
          beneficiario_nombre: string | null
          cancelado_en: string | null
          cargo_estado: Database["public"]["Enums"]["estado_cargo"] | null
          cargo_id: string | null
          cargo_monto: number | null
          cliente_id: string | null
          cliente_nombre: string | null
          condicion_cobertura:
            | Database["public"]["Enums"]["condicion_cobertura"]
            | null
          conductor_id: string | null
          conductor_nombre: string | null
          created_at: string | null
          destino: string | null
          estado: Database["public"]["Enums"]["estado_traslado"] | null
          estado_financiero: string | null
          fin_previsto: string | null
          fin_real: string | null
          id: string | null
          inicio_previsto: string | null
          inicio_real: string | null
          membresia_id: string | null
          minutos_estimados: number | null
          motivo: string | null
          motivo_cancelacion: string | null
          motivo_cobertura: string | null
          notas: string | null
          notas_finales: string | null
          origen: string | null
          paciente: string | null
          pasajero: string | null
          pendiente: number | null
          periodo_id: string | null
          precio_pactado: number | null
          reserva_estado: Database["public"]["Enums"]["estado_reserva"] | null
          reserva_id: string | null
          reserva_periodo_inicio: string | null
          tarifa_id: string | null
          tipo: Database["public"]["Enums"]["tipo_traslado"] | null
          updated_at: string | null
          vehiculo_codigo: string | null
          vehiculo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traslados_ambulancia_beneficiario_id_fkey"
            columns: ["beneficiario_id"]
            isOneToOne: false
            referencedRelation: "beneficiarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "cargos_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: true
            referencedRelation: "saldos_cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "saldos_clientes"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_conductor_id_fkey"
            columns: ["conductor_id"]
            isOneToOne: false
            referencedRelation: "conductores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_membresia_id_fkey"
            columns: ["membresia_id"]
            isOneToOne: false
            referencedRelation: "saldos_membresias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodos_membresia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "saldos_periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_tarifa_id_fkey"
            columns: ["tarifa_id"]
            isOneToOne: false
            referencedRelation: "tarifas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traslados_ambulancia_vehiculo_id_fkey"
            columns: ["vehiculo_id"]
            isOneToOne: false
            referencedRelation: "vehiculos"
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
      agregar_beneficiario_nuevo_membresia: {
        Args: {
          p_beneficiario: Json
          p_idempotencia: string
          p_membresia_id: string
        }
        Returns: string
      }
      ajustar_duracion_transporte: {
        Args: {
          p_minutos_estimados: number
          p_motivo?: string
          p_transporte_id: string
        }
        Returns: string[]
      }
      ajustar_duracion_traslado: {
        Args: {
          p_minutos_estimados: number
          p_motivo?: string
          p_traslado_id: string
        }
        Returns: string[]
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
      asignar_recursos_transporte: {
        Args: {
          p_conductor_id: string
          p_motivo?: string
          p_transporte_id: string
          p_vehiculo_id: string
        }
        Returns: undefined
      }
      asignar_recursos_traslado: {
        Args: {
          p_conductor_id: string
          p_motivo?: string
          p_traslado_id: string
          p_vehiculo_id: string
        }
        Returns: undefined
      }
      avisos_operacion: {
        Args: {
          p_origen_id: string
          p_origen_tipo: Database["public"]["Enums"]["origen_ocupacion"]
        }
        Returns: string[]
      }
      avisos_traslado: { Args: { p_traslado_id: string }; Returns: string[] }
      balanza_comprobacion: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          cuenta_codigo: string
          cuenta_nombre: string
          debe: number
          haber: number
          saldo_final: number
          saldo_inicial: number
          tipo: Database["public"]["Enums"]["tipo_cuenta_contable"]
        }[]
      }
      cancelar_alquiler: {
        Args: { p_alquiler_id: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_membresia: {
        Args: { p_membresia_id: string; p_motivo: string }
        Returns: undefined
      }
      cancelar_transporte: {
        Args: { p_motivo: string; p_transporte_id: string }
        Returns: undefined
      }
      cancelar_traslado: {
        Args: { p_motivo: string; p_traslado_id: string }
        Returns: undefined
      }
      comprobaciones_financieras: {
        Args: { p_fecha: string }
        Returns: {
          control: string
          cuadra: boolean
          diferencia: number
          esperado: number
          nota: string
          obtenido: number
          orden: number
        }[]
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
      convertir_traslado_a_particular: {
        Args: { p_motivo: string; p_precio: number; p_traslado_id: string }
        Returns: undefined
      }
      devolver_alquiler: {
        Args: {
          p_adicionales?: Json
          p_alquiler_id: string
          p_aplicar_anticipo?: number
          p_combustible: Database["public"]["Enums"]["nivel_combustible"]
          p_km_regreso: number
          p_motivo_correccion_km?: string
          p_notas: string
        }
        Returns: Json
      }
      disponibilidad_recursos: {
        Args: {
          p_actividad: Database["public"]["Enums"]["actividad"]
          p_fin: string
          p_inicio: string
          p_origen_id?: string
          p_origen_tipo?: Database["public"]["Enums"]["origen_ocupacion"]
        }
        Returns: {
          detalle: string
          disponible: boolean
          nombre: string
          recurso_id: string
          recurso_tipo: string
        }[]
      }
      editar_transporte: {
        Args: {
          p_destino: string
          p_notas: string
          p_origen: string
          p_precio: number
          p_tarifa_id: string
          p_transporte_id: string
        }
        Returns: undefined
      }
      editar_traslado: {
        Args: {
          p_destino: string
          p_motivo: string
          p_notas: string
          p_origen: string
          p_pasajero: string
          p_precio: number
          p_tarifa_id: string
          p_traslado_id: string
        }
        Returns: undefined
      }
      entregar_alquiler: {
        Args: {
          p_alquiler_id: string
          p_combustible: Database["public"]["Enums"]["nivel_combustible"]
          p_km_salida: number
          p_notas: string
        }
        Returns: string[]
      }
      establecer_vencimiento_membresia: {
        Args: { p_fecha_fin: string; p_membresia_id: string; p_motivo: string }
        Returns: undefined
      }
      estado_resultados: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          alquileres: number
          ambulancias: number
          cuenta_codigo: string
          cuenta_nombre: string
          general: number
          tipo: Database["public"]["Enums"]["tipo_cuenta_contable"]
          total: number
          transportes: number
        }[]
      }
      finalizar_transporte: {
        Args: {
          p_aplicar_anticipo?: number
          p_notas_finales: string
          p_transporte_id: string
        }
        Returns: Json
      }
      finalizar_traslado: {
        Args: {
          p_aplicar_anticipo?: number
          p_notas_finales: string
          p_traslado_id: string
        }
        Returns: Json
      }
      generar_contrato_membresia: {
        Args: { p_membresia_id: string }
        Returns: string
      }
      guardar_plantilla_contrato: {
        Args: { p_contenido: string }
        Returns: number
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
      historial_operacion: {
        Args: { p_entidad: string; p_registro_id: string }
        Returns: {
          accion: string
          actor: string
          antes: Json
          despues: Json
          fecha: string
          motivo: string
        }[]
      }
      historial_traslado: {
        Args: { p_traslado_id: string }
        Returns: {
          accion: string
          actor: string
          antes: Json
          despues: Json
          fecha: string
          motivo: string
        }[]
      }
      inactivar_beneficiario_membresia: {
        Args: { p_motivo: string; p_vinculo_id: string }
        Returns: undefined
      }
      iniciar_transporte: {
        Args: { p_transporte_id: string }
        Returns: string[]
      }
      iniciar_traslado: { Args: { p_traslado_id: string }; Returns: Json }
      modificar_alquiler: {
        Args: {
          p_alquiler_id: string
          p_devolucion_prevista: string
          p_entrega_prevista: string
          p_motivo: string
          p_notas: string
          p_precio: number
          p_tarifa_id: string
          p_vehiculo_id: string
        }
        Returns: undefined
      }
      prever_cobertura: {
        Args: {
          p_beneficiario_id: string
          p_inicio: string
          p_membresia_id: string
        }
        Returns: {
          condicion: Database["public"]["Enums"]["condicion_cobertura"]
          cupo: number
          disponibles: number
          motivo: string
          periodo_inicio: string
        }[]
      }
      programar_transporte: {
        Args: { p_transporte_id: string }
        Returns: undefined
      }
      programar_traslado: {
        Args: { p_traslado_id: string }
        Returns: undefined
      }
      recursos_disponibles: {
        Args: { p_inicio: string; p_minutos: number; p_traslado_id?: string }
        Returns: {
          detalle: string
          disponible: boolean
          nombre: string
          recurso_id: string
          recurso_tipo: string
        }[]
      }
      registrar_alquiler: {
        Args: {
          p_cliente_id: string
          p_devolucion_prevista: string
          p_entrega_prevista: string
          p_idempotencia: string
          p_notas: string
          p_precio: number
          p_tarifa_id: string
          p_vehiculo_id: string
        }
        Returns: string
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
      registrar_cobro_automatico: {
        Args: {
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
      registrar_gasto_personal: {
        Args: {
          p_actividad: Database["public"]["Enums"]["actividad"]
          p_categoria_id: string
          p_concepto: string
          p_conductor_id?: string
          p_empleado_id?: string
          p_fecha: string
          p_idempotencia: string
          p_monto: number
          p_notas: string
          p_pago?: Json
          p_proveedor_id: string
          p_servicio_id?: string
          p_tipo?: string
          p_vencimiento: string
        }
        Returns: string
      }
      registrar_gasto_servicio: {
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
          p_servicio_id?: string
          p_tipo?: string
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
      registrar_membresia_completa: {
        Args: {
          p_beneficiarios?: string[]
          p_cliente: Json
          p_cliente_id: string
          p_condiciones?: Json
          p_fecha_inicio: string
          p_idempotencia: string
          p_nuevos_beneficiarios?: Json
          p_plan_id: string
          p_titular_beneficiario?: boolean
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
      registrar_transporte: {
        Args: {
          p_cliente_id: string
          p_conductor_id?: string
          p_destino: string
          p_idempotencia: string
          p_inicio_previsto: string
          p_minutos_estimados: number
          p_notas: string
          p_origen: string
          p_precio: number
          p_programar?: boolean
          p_tarifa_id: string
          p_vehiculo_id?: string
        }
        Returns: string
      }
      registrar_traslado: {
        Args: {
          p_beneficiario_id: string
          p_cliente_id: string
          p_conductor_id?: string
          p_destino: string
          p_idempotencia: string
          p_inicio_previsto: string
          p_membresia_id: string
          p_minutos_estimados: number
          p_motivo: string
          p_notas: string
          p_origen: string
          p_pasajero: string
          p_precio: number
          p_programar?: boolean
          p_tarifa_id: string
          p_tipo: Database["public"]["Enums"]["tipo_traslado"]
          p_vehiculo_id?: string
        }
        Returns: string
      }
      reporte_caja: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          activo: boolean
          aperturas: number
          cobros: number
          cuenta_dinero_id: string
          nombre: string
          pagos: number
          saldo_actual: number
          saldo_final: number
          saldo_inicial: number
          tipo: Database["public"]["Enums"]["tipo_cuenta_dinero"]
          transferencias: number
        }[]
      }
      reporte_gastos: {
        Args: {
          p_actividad?: Database["public"]["Enums"]["actividad"]
          p_desde: string
          p_hasta: string
        }
        Returns: {
          actividad: Database["public"]["Enums"]["actividad"]
          asiento_id: string
          categoria: string
          concepto: string
          cuenta_codigo: string
          estado: Database["public"]["Enums"]["estado_gasto"]
          evento: Database["public"]["Enums"]["evento_financiero"]
          fecha: string
          gasto_id: string
          importe: number
          pagado: number
          pendiente: number
          proveedor: string
          vencimiento: string
        }[]
      }
      reporte_gastos_agrupados: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          agrupacion: string
          clave: string
          importe: number
          nombre: string
        }[]
      }
      reporte_ingresos: {
        Args: {
          p_actividad?: Database["public"]["Enums"]["actividad"]
          p_desde: string
          p_hasta: string
        }
        Returns: {
          actividad: Database["public"]["Enums"]["actividad"]
          asiento_id: string
          cargo_id: string
          cliente_id: string
          cliente_nombre: string
          concepto: string
          cuenta_codigo: string
          cuenta_nombre: string
          evento: Database["public"]["Enums"]["evento_financiero"]
          fecha: string
          importe: number
        }[]
      }
      reporte_movimientos: {
        Args: { p_cuenta_dinero_id: string; p_desde: string; p_hasta: string }
        Returns: {
          concepto: string
          evento: Database["public"]["Enums"]["evento_financiero"]
          fecha: string
          importe: number
          movimiento_id: string
          saldo: number
          tipo: Database["public"]["Enums"]["tipo_movimiento"]
        }[]
      }
      reporte_resultados_actividad: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          actividad: Database["public"]["Enums"]["actividad"]
          gastos: number
          ingresos: number
          resultado: number
        }[]
      }
      reporte_resumen: {
        Args: { p_desde: string; p_hasta: string }
        Returns: {
          anticipos: number
          cobros_periodo: number
          dinero_disponible: number
          fecha_corte: string
          gastos: number
          ingresos: number
          pagos_periodo: number
          por_cobrar: number
          por_cobrar_vencido: number
          por_pagar: number
          por_pagar_vencido: number
          resultado: number
        }[]
      }
      reprogramar_transporte: {
        Args: {
          p_inicio_previsto: string
          p_minutos_estimados: number
          p_motivo: string
          p_transporte_id: string
        }
        Returns: undefined
      }
      reprogramar_traslado: {
        Args: {
          p_inicio_previsto: string
          p_minutos_estimados: number
          p_motivo: string
          p_traslado_id: string
        }
        Returns: Database["public"]["Enums"]["condicion_cobertura"]
      }
      revalidar_cobertura_traslado: {
        Args: { p_traslado_id: string }
        Returns: Database["public"]["Enums"]["condicion_cobertura"]
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
      revertir_consumo_traslado: {
        Args: { p_motivo: string; p_traslado_id: string }
        Returns: undefined
      }
      situacion_financiera: {
        Args: { p_fecha: string }
        Returns: {
          cuenta_codigo: string
          cuenta_nombre: string
          saldo: number
          tipo: Database["public"]["Enums"]["tipo_cuenta_contable"]
        }[]
      }
      vista_previa_contrato: { Args: { p_contenido: string }; Returns: string }
    }
    Enums: {
      actividad: "ambulancias" | "alquileres" | "transportes" | "general"
      condicion_cobertura: "valida" | "pendiente_validacion" | "no_valida"
      estado_alquiler: "reservado" | "entregado" | "devuelto" | "cancelado"
      estado_aplicacion: "vigente" | "reversada"
      estado_asiento: "confirmado" | "reversado"
      estado_cargo: "vigente" | "anulado"
      estado_gasto: "registrado" | "anulado"
      estado_membresia: "activa" | "suspendida" | "cancelada"
      estado_pago: "confirmado" | "reversado"
      estado_reserva: "reservada" | "consumida" | "liberada"
      estado_transporte:
        | "solicitado"
        | "programado"
        | "en_curso"
        | "completado"
        | "cancelado"
      estado_traslado:
        | "solicitado"
        | "programado"
        | "en_curso"
        | "completado"
        | "cancelado"
      estado_vehiculo: "operativo" | "mantenimiento" | "fuera_servicio"
      evento_financiero: "registro" | "reverso"
      metodo_pago: "efectivo" | "transferencia" | "tarjeta" | "otro"
      modalidad_cupo: "compartido" | "individual"
      nivel_combustible: "vacio" | "cuarto" | "medio" | "tres_cuartos" | "lleno"
      origen_cargo:
        | "manual"
        | "periodo_membresia"
        | "traslado_ambulancia"
        | "alquiler"
        | "transporte"
      origen_financiero:
        | "cargo"
        | "cobro"
        | "aplicacion"
        | "gasto"
        | "pago_gasto"
        | "transferencia"
        | "apertura"
      origen_ocupacion: "traslado" | "alquiler" | "transporte"
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
      tipo_traslado: "cubierto" | "particular"
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
      condicion_cobertura: ["valida", "pendiente_validacion", "no_valida"],
      estado_alquiler: ["reservado", "entregado", "devuelto", "cancelado"],
      estado_aplicacion: ["vigente", "reversada"],
      estado_asiento: ["confirmado", "reversado"],
      estado_cargo: ["vigente", "anulado"],
      estado_gasto: ["registrado", "anulado"],
      estado_membresia: ["activa", "suspendida", "cancelada"],
      estado_pago: ["confirmado", "reversado"],
      estado_reserva: ["reservada", "consumida", "liberada"],
      estado_transporte: [
        "solicitado",
        "programado",
        "en_curso",
        "completado",
        "cancelado",
      ],
      estado_traslado: [
        "solicitado",
        "programado",
        "en_curso",
        "completado",
        "cancelado",
      ],
      estado_vehiculo: ["operativo", "mantenimiento", "fuera_servicio"],
      evento_financiero: ["registro", "reverso"],
      metodo_pago: ["efectivo", "transferencia", "tarjeta", "otro"],
      modalidad_cupo: ["compartido", "individual"],
      nivel_combustible: ["vacio", "cuarto", "medio", "tres_cuartos", "lleno"],
      origen_cargo: [
        "manual",
        "periodo_membresia",
        "traslado_ambulancia",
        "alquiler",
        "transporte",
      ],
      origen_financiero: [
        "cargo",
        "cobro",
        "aplicacion",
        "gasto",
        "pago_gasto",
        "transferencia",
        "apertura",
      ],
      origen_ocupacion: ["traslado", "alquiler", "transporte"],
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
      tipo_traslado: ["cubierto", "particular"],
      tipo_vehiculo: ["ambulancia", "alquiler", "transporte", "mixto"],
      unidad_tarifa: ["dia", "servicio"],
    },
  },
} as const
