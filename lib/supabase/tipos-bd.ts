// Generado con Supabase MCP (generate_typescript_types) tras las migraciones de E1.
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
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      actividad: "ambulancias" | "alquileres" | "transportes" | "general"
      estado_vehiculo: "operativo" | "mantenimiento" | "fuera_servicio"
      modalidad_cupo: "compartido" | "individual"
      rol_usuario: "administrador" | "operador" | "finanzas"
      tipo_cliente: "natural" | "juridica"
      tipo_cuenta_dinero: "caja" | "banco"
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
      estado_vehiculo: ["operativo", "mantenimiento", "fuera_servicio"],
      modalidad_cupo: ["compartido", "individual"],
      rol_usuario: ["administrador", "operador", "finanzas"],
      tipo_cliente: ["natural", "juridica"],
      tipo_cuenta_dinero: ["caja", "banco"],
      tipo_vehiculo: ["ambulancia", "alquiler", "transporte", "mixto"],
      unidad_tarifa: ["dia", "servicio"],
    },
  },
} as const
