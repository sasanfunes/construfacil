/**
 * Tipos de la base de datos. Refleja las migraciones de `supabase/migrations`.
 *
 * Escrito a mano mientras no exista el proyecto de Supabase. Cuando exista, se regenera con:
 *   pnpm dlx supabase gen types typescript --linked > src/lib/supabase/database.types.ts
 * y no se vuelve a editar a mano.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string;
          value: Json;
          is_public: boolean;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          is_public?: boolean;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          is_public?: boolean;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          occurred_at: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["user_role"] | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before_data: Json | null;
          after_data: Json | null;
          metadata: Json;
          ip_hash: string | null;
          user_agent: string | null;
        };
        Insert: {
          occurred_at?: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["user_role"] | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before_data?: Json | null;
          after_data?: Json | null;
          metadata?: Json;
          ip_hash?: string | null;
          user_agent?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      departments: {
        Row: {
          id: number;
          iso_code: string;
          name: string;
          is_active: boolean;
          latitude: number;
          longitude: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: number;
          iso_code: string;
          name: string;
          is_active?: boolean;
          latitude: number;
          longitude: number;
        };
        Update: {
          name?: string;
          is_active?: boolean;
          latitude?: number;
          longitude?: number;
        };
        Relationships: [];
      };
      exchange_rates: {
        Row: {
          id: string;
          usd_to_hnl: number;
          effective_date: string;
          source: string;
          is_example: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          usd_to_hnl: number;
          effective_date: string;
          source: string;
          is_example?: boolean;
          created_by?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      municipalities: {
        Row: {
          id: number;
          department_id: number;
          name: string;
          is_active: boolean;
          latitude: number | null;
          longitude: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          department_id: number;
          name: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
        };
        Update: {
          name?: string;
          is_active?: boolean;
          latitude?: number | null;
          longitude?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "municipalities_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          country: string;
          us_state: string | null;
          preferred_locale: string;
          notification_prefs: Json;
          stripe_customer_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          country?: string;
          us_state?: string | null;
          preferred_locale?: string;
          notification_prefs?: Json;
          stripe_customer_id?: string | null;
        };
        Update: {
          full_name?: string | null;
          phone?: string | null;
          country?: string;
          us_state?: string | null;
          preferred_locale?: string;
          notification_prefs?: Json;
          stripe_customer_id?: string | null;
        };
        Relationships: [];
      };
      rate_limits: {
        Row: { bucket: string; window_start: string; hits: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: Database["public"]["Enums"]["user_role"];
          assigned_by: string | null;
          assigned_at: string;
        };
        Insert: {
          user_id: string;
          role?: Database["public"]["Enums"]["user_role"];
        };
        Update: {
          role?: Database["public"]["Enums"]["user_role"];
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      check_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: { allowed: boolean; remaining: number; reset_at: string }[];
      };
    };
    Enums: {
      user_role: "cliente" | "familiar_autorizado" | "ventas" | "gerente_proyecto" | "logistica" | "admin";
    };
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<Name extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][Name]["Row"];
export type Enums<Name extends keyof Database["public"]["Enums"]> = Database["public"]["Enums"][Name];
