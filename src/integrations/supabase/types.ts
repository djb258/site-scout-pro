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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      rent_band_staging: {
        Row: {
          created_at: string
          frontend_user_id: string | null
          high_rent: number | null
          id: string
          json_payload: Json
          low_rent: number | null
          medium_rent: number | null
          site_intake_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          frontend_user_id?: string | null
          high_rent?: number | null
          id?: string
          json_payload: Json
          low_rent?: number | null
          medium_rent?: number | null
          site_intake_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          frontend_user_id?: string | null
          high_rent?: number | null
          id?: string
          json_payload?: Json
          low_rent?: number | null
          medium_rent?: number | null
          site_intake_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_band_staging_site_intake_id_fkey"
            columns: ["site_intake_id"]
            isOneToOne: false
            referencedRelation: "site_intake_staging"
            referencedColumns: ["id"]
          },
        ]
      }
      site_demand_staging: {
        Row: {
          competition_count: number | null
          created_at: string
          frontend_user_id: string | null
          households: number | null
          id: string
          json_payload: Json
          population: number | null
          site_intake_id: string | null
          status: string | null
          traffic_count: number | null
          uhaul_migration_score: string | null
          updated_at: string
        }
        Insert: {
          competition_count?: number | null
          created_at?: string
          frontend_user_id?: string | null
          households?: number | null
          id?: string
          json_payload: Json
          population?: number | null
          site_intake_id?: string | null
          status?: string | null
          traffic_count?: number | null
          uhaul_migration_score?: string | null
          updated_at?: string
        }
        Update: {
          competition_count?: number | null
          created_at?: string
          frontend_user_id?: string | null
          households?: number | null
          id?: string
          json_payload?: Json
          population?: number | null
          site_intake_id?: string | null
          status?: string | null
          traffic_count?: number | null
          uhaul_migration_score?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_demand_staging_site_intake_id_fkey"
            columns: ["site_intake_id"]
            isOneToOne: false
            referencedRelation: "site_intake_staging"
            referencedColumns: ["id"]
          },
        ]
      }
      site_intake_staging: {
        Row: {
          access_quality: string | null
          acreage: number | null
          county: string | null
          created_at: string
          floodplain: boolean | null
          frontend_user_id: string | null
          id: string
          json_payload: Json
          nearby_road_type: string | null
          parcel_shape: string | null
          slope_percent: number | null
          state: string | null
          status: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          access_quality?: string | null
          acreage?: number | null
          county?: string | null
          created_at?: string
          floodplain?: boolean | null
          frontend_user_id?: string | null
          id?: string
          json_payload: Json
          nearby_road_type?: string | null
          parcel_shape?: string | null
          slope_percent?: number | null
          state?: string | null
          status?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          access_quality?: string | null
          acreage?: number | null
          county?: string | null
          created_at?: string
          floodplain?: boolean | null
          frontend_user_id?: string | null
          id?: string
          json_payload?: Json
          nearby_road_type?: string | null
          parcel_shape?: string | null
          slope_percent?: number | null
          state?: string | null
          status?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      site_results_staging: {
        Row: {
          county_difficulty: number | null
          created_at: string
          decision: string | null
          final_score: number | null
          financial_viability: number | null
          frontend_user_id: string | null
          id: string
          json_payload: Json
          parcel_viability_score: number | null
          saturation_score: number | null
          site_intake_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          county_difficulty?: number | null
          created_at?: string
          decision?: string | null
          final_score?: number | null
          financial_viability?: number | null
          frontend_user_id?: string | null
          id?: string
          json_payload: Json
          parcel_viability_score?: number | null
          saturation_score?: number | null
          site_intake_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          county_difficulty?: number | null
          created_at?: string
          decision?: string | null
          final_score?: number | null
          financial_viability?: number | null
          frontend_user_id?: string | null
          id?: string
          json_payload?: Json
          parcel_viability_score?: number | null
          saturation_score?: number | null
          site_intake_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_results_staging_site_intake_id_fkey"
            columns: ["site_intake_id"]
            isOneToOne: false
            referencedRelation: "site_intake_staging"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
