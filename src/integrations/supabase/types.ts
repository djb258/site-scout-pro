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
      generic_ingest_log: {
        Row: {
          created_at: string
          id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          id?: string
          payload: Json
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      pass1_results: {
        Row: {
          analysis_summary: Json | null
          anchors: Json | null
          competitors: Json | null
          created_at: string
          housing_signals: Json | null
          id: string
          industrial_signals: Json | null
          radius_counties: Json | null
          rv_lake_signals: Json | null
          zip_metadata: Json | null
          zip_run_id: string
        }
        Insert: {
          analysis_summary?: Json | null
          anchors?: Json | null
          competitors?: Json | null
          created_at?: string
          housing_signals?: Json | null
          id?: string
          industrial_signals?: Json | null
          radius_counties?: Json | null
          rv_lake_signals?: Json | null
          zip_metadata?: Json | null
          zip_run_id: string
        }
        Update: {
          analysis_summary?: Json | null
          anchors?: Json | null
          competitors?: Json | null
          created_at?: string
          housing_signals?: Json | null
          id?: string
          industrial_signals?: Json | null
          radius_counties?: Json | null
          rv_lake_signals?: Json | null
          zip_metadata?: Json | null
          zip_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pass1_results_zip_run_id_fkey"
            columns: ["zip_run_id"]
            isOneToOne: false
            referencedRelation: "zip_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pass2_results: {
        Row: {
          created_at: string
          feasibility: Json | null
          fusion_model: Json | null
          housing_pipeline: Json | null
          id: string
          industrial_deep: Json | null
          permit_intel: Json | null
          rent_benchmarks: Json | null
          reverse_feasibility: Json | null
          verdict: Json | null
          zip_run_id: string
          zoning: Json | null
        }
        Insert: {
          created_at?: string
          feasibility?: Json | null
          fusion_model?: Json | null
          housing_pipeline?: Json | null
          id?: string
          industrial_deep?: Json | null
          permit_intel?: Json | null
          rent_benchmarks?: Json | null
          reverse_feasibility?: Json | null
          verdict?: Json | null
          zip_run_id: string
          zoning?: Json | null
        }
        Update: {
          created_at?: string
          feasibility?: Json | null
          fusion_model?: Json | null
          housing_pipeline?: Json | null
          id?: string
          industrial_deep?: Json | null
          permit_intel?: Json | null
          rent_benchmarks?: Json | null
          reverse_feasibility?: Json | null
          verdict?: Json | null
          zip_run_id?: string
          zoning?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pass2_results_zip_run_id_fkey"
            columns: ["zip_run_id"]
            isOneToOne: false
            referencedRelation: "zip_runs"
            referencedColumns: ["id"]
          },
        ]
      }
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
      us_zip_codes: {
        Row: {
          age_median: number | null
          city: string | null
          county_fips: string | null
          county_fips_all: string | null
          county_name: string | null
          county_names_all: string | null
          county_weights: Json | null
          created_at: string
          density: number | null
          education_college_or_above: number | null
          family_size: number | null
          female: number | null
          home_ownership: number | null
          home_value: number | null
          id: string
          imprecise: boolean | null
          income_household_median: number | null
          income_household_six_figure: number | null
          labor_force_participation: number | null
          lat: number | null
          lng: number | null
          male: number | null
          married: number | null
          military: boolean | null
          parent_zcta: string | null
          population: number | null
          race_asian: number | null
          race_black: number | null
          race_multiple: number | null
          race_native: number | null
          race_other: number | null
          race_pacific: number | null
          race_white: number | null
          rent_median: number | null
          state_id: string | null
          state_name: string | null
          timezone: string | null
          unemployment_rate: number | null
          zcta: boolean | null
          zip: string
        }
        Insert: {
          age_median?: number | null
          city?: string | null
          county_fips?: string | null
          county_fips_all?: string | null
          county_name?: string | null
          county_names_all?: string | null
          county_weights?: Json | null
          created_at?: string
          density?: number | null
          education_college_or_above?: number | null
          family_size?: number | null
          female?: number | null
          home_ownership?: number | null
          home_value?: number | null
          id?: string
          imprecise?: boolean | null
          income_household_median?: number | null
          income_household_six_figure?: number | null
          labor_force_participation?: number | null
          lat?: number | null
          lng?: number | null
          male?: number | null
          married?: number | null
          military?: boolean | null
          parent_zcta?: string | null
          population?: number | null
          race_asian?: number | null
          race_black?: number | null
          race_multiple?: number | null
          race_native?: number | null
          race_other?: number | null
          race_pacific?: number | null
          race_white?: number | null
          rent_median?: number | null
          state_id?: string | null
          state_name?: string | null
          timezone?: string | null
          unemployment_rate?: number | null
          zcta?: boolean | null
          zip: string
        }
        Update: {
          age_median?: number | null
          city?: string | null
          county_fips?: string | null
          county_fips_all?: string | null
          county_name?: string | null
          county_names_all?: string | null
          county_weights?: Json | null
          created_at?: string
          density?: number | null
          education_college_or_above?: number | null
          family_size?: number | null
          female?: number | null
          home_ownership?: number | null
          home_value?: number | null
          id?: string
          imprecise?: boolean | null
          income_household_median?: number | null
          income_household_six_figure?: number | null
          labor_force_participation?: number | null
          lat?: number | null
          lng?: number | null
          male?: number | null
          married?: number | null
          military?: boolean | null
          parent_zcta?: string | null
          population?: number | null
          race_asian?: number | null
          race_black?: number | null
          race_multiple?: number | null
          race_native?: number | null
          race_other?: number | null
          race_pacific?: number | null
          race_white?: number | null
          rent_median?: number | null
          state_id?: string | null
          state_name?: string | null
          timezone?: string | null
          unemployment_rate?: number | null
          zcta?: boolean | null
          zip?: string
        }
        Relationships: []
      }
      zip_runs: {
        Row: {
          analysis_mode: string | null
          created_at: string
          id: string
          industrial_momentum: boolean | null
          multifamily_priority: boolean | null
          recreation_load: boolean | null
          status: string | null
          updated_at: string
          urban_exclude: boolean | null
          zip_code: string
        }
        Insert: {
          analysis_mode?: string | null
          created_at?: string
          id?: string
          industrial_momentum?: boolean | null
          multifamily_priority?: boolean | null
          recreation_load?: boolean | null
          status?: string | null
          updated_at?: string
          urban_exclude?: boolean | null
          zip_code: string
        }
        Update: {
          analysis_mode?: string | null
          created_at?: string
          id?: string
          industrial_momentum?: boolean | null
          multifamily_priority?: boolean | null
          recreation_load?: boolean | null
          status?: string | null
          updated_at?: string
          urban_exclude?: boolean | null
          zip_code?: string
        }
        Relationships: []
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
