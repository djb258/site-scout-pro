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
      calculators_state: {
        Row: {
          acres_available: number | null
          cap_rate_target: number | null
          concrete_cost_yd: number | null
          concrete_finish_cost: number | null
          id: string
          land_cost_per_acre: number | null
          market_rent_10x10: number | null
          market_rent_10x20: number | null
          metal_cost_sqft: number | null
          updated_at: string
        }
        Insert: {
          acres_available?: number | null
          cap_rate_target?: number | null
          concrete_cost_yd?: number | null
          concrete_finish_cost?: number | null
          id?: string
          land_cost_per_acre?: number | null
          market_rent_10x10?: number | null
          market_rent_10x20?: number | null
          metal_cost_sqft?: number | null
          updated_at?: string
        }
        Update: {
          acres_available?: number | null
          cap_rate_target?: number | null
          concrete_cost_yd?: number | null
          concrete_finish_cost?: number | null
          id?: string
          land_cost_per_acre?: number | null
          market_rent_10x10?: number | null
          market_rent_10x20?: number | null
          metal_cost_sqft?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      engine_logs: {
        Row: {
          created_at: string
          engine: string
          event: string
          id: string
          payload: Json | null
          status: string | null
        }
        Insert: {
          created_at?: string
          engine: string
          event: string
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Update: {
          created_at?: string
          engine?: string
          event?: string
          id?: string
          payload?: Json | null
          status?: string | null
        }
        Relationships: []
      }
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
      hub0_event_log: {
        Row: {
          action: string
          created_at: string | null
          error: string | null
          id: string
          metadata: Json | null
          process_id: string
          status: string
        }
        Insert: {
          action: string
          created_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json | null
          process_id: string
          status: string
        }
        Update: {
          action?: string
          created_at?: string | null
          error?: string | null
          id?: string
          metadata?: Json | null
          process_id?: string
          status?: string
        }
        Relationships: []
      }
      hub1_pass1_error_log: {
        Row: {
          created_at: string | null
          error_code: string
          error_message: string | null
          fatal: boolean
          id: string
          metadata: Json | null
          process_id: string
          recoverable: boolean
          run_id: string
          step: string
          ttl_expires_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_code: string
          error_message?: string | null
          fatal?: boolean
          id?: string
          metadata?: Json | null
          process_id?: string
          recoverable?: boolean
          run_id: string
          step: string
          ttl_expires_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_code?: string
          error_message?: string | null
          fatal?: boolean
          id?: string
          metadata?: Json | null
          process_id?: string
          recoverable?: boolean
          run_id?: string
          step?: string
          ttl_expires_at?: string | null
        }
        Relationships: []
      }
      hub1_pass1_run_log: {
        Row: {
          competition_confidence: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          process_id: string
          run_id: string
          schema_version: string
          scoring_weights: Json
          status: string
          step: string
          ttl_expires_at: string | null
        }
        Insert: {
          competition_confidence?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          process_id?: string
          run_id: string
          schema_version?: string
          scoring_weights?: Json
          status: string
          step: string
          ttl_expires_at?: string | null
        }
        Update: {
          competition_confidence?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          process_id?: string
          run_id?: string
          schema_version?: string
          scoring_weights?: Json
          status?: string
          step?: string
          ttl_expires_at?: string | null
        }
        Relationships: []
      }
      pass1_radius_zip: {
        Row: {
          created_at: string | null
          distance_miles: number
          id: string
          lat: number
          lng: number
          origin_zip: string
          run_id: string
          zip: string
        }
        Insert: {
          created_at?: string | null
          distance_miles: number
          id?: string
          lat: number
          lng: number
          origin_zip: string
          run_id: string
          zip: string
        }
        Update: {
          created_at?: string | null
          distance_miles?: number
          id?: string
          lat?: number
          lng?: number
          origin_zip?: string
          run_id?: string
          zip?: string
        }
        Relationships: []
      }
      pass1_results: {
        Row: {
          analysis_summary: Json | null
          anchors: Json | null
          competitors: Json | null
          created_at: string
          deprecated: boolean | null
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
          deprecated?: boolean | null
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
          deprecated?: boolean | null
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
      pass1_runs: {
        Row: {
          created_at: string
          deprecated: boolean | null
          gemini_anchors: Json | null
          gemini_facilities: Json | null
          gemini_housing: Json | null
          gemini_industry_news: Json | null
          gemini_recreation: Json | null
          id: string
          radius_counties: Json | null
          status: string | null
          toggles: Json | null
          updated_at: string
          zip: string
        }
        Insert: {
          created_at?: string
          deprecated?: boolean | null
          gemini_anchors?: Json | null
          gemini_facilities?: Json | null
          gemini_housing?: Json | null
          gemini_industry_news?: Json | null
          gemini_recreation?: Json | null
          id?: string
          radius_counties?: Json | null
          status?: string | null
          toggles?: Json | null
          updated_at?: string
          zip: string
        }
        Update: {
          created_at?: string
          deprecated?: boolean | null
          gemini_anchors?: Json | null
          gemini_facilities?: Json | null
          gemini_housing?: Json | null
          gemini_industry_news?: Json | null
          gemini_recreation?: Json | null
          id?: string
          radius_counties?: Json | null
          status?: string | null
          toggles?: Json | null
          updated_at?: string
          zip?: string
        }
        Relationships: []
      }
      pass1_skip_log: {
        Row: {
          actual_version: string | null
          created_at: string | null
          expected_version: string | null
          id: string
          process_id: string
          run_id: string
          skip_reason: string
          zip: string
        }
        Insert: {
          actual_version?: string | null
          created_at?: string | null
          expected_version?: string | null
          id?: string
          process_id?: string
          run_id: string
          skip_reason: string
          zip: string
        }
        Update: {
          actual_version?: string | null
          created_at?: string | null
          expected_version?: string | null
          id?: string
          process_id?: string
          run_id?: string
          skip_reason?: string
          zip?: string
        }
        Relationships: []
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
      pass2_runs: {
        Row: {
          created_at: string
          feasibility: Json | null
          fusion_model: Json | null
          housing_pipeline: Json | null
          id: string
          industrial_deep_dive: Json | null
          pass1_id: string | null
          permit_intel: Json | null
          rent_benchmarks: Json | null
          reverse_feasibility: Json | null
          status: string | null
          updated_at: string
          verdict: Json | null
          zoning_intel: Json | null
        }
        Insert: {
          created_at?: string
          feasibility?: Json | null
          fusion_model?: Json | null
          housing_pipeline?: Json | null
          id?: string
          industrial_deep_dive?: Json | null
          pass1_id?: string | null
          permit_intel?: Json | null
          rent_benchmarks?: Json | null
          reverse_feasibility?: Json | null
          status?: string | null
          updated_at?: string
          verdict?: Json | null
          zoning_intel?: Json | null
        }
        Update: {
          created_at?: string
          feasibility?: Json | null
          fusion_model?: Json | null
          housing_pipeline?: Json | null
          id?: string
          industrial_deep_dive?: Json | null
          pass1_id?: string | null
          permit_intel?: Json | null
          rent_benchmarks?: Json | null
          reverse_feasibility?: Json | null
          status?: string | null
          updated_at?: string
          verdict?: Json | null
          zoning_intel?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pass2_runs_pass1_id_fkey"
            columns: ["pass1_id"]
            isOneToOne: false
            referencedRelation: "pass1_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ref_zip_replica: {
        Row: {
          lat: number
          lng: number
          source_version: string
          synced_at: string
          zip: string
        }
        Insert: {
          lat: number
          lng: number
          source_version?: string
          synced_at?: string
          zip: string
        }
        Update: {
          lat?: number
          lng?: number
          source_version?: string
          synced_at?: string
          zip?: string
        }
        Relationships: []
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
      staging_payload: {
        Row: {
          created_at: string
          id: string
          pass2_id: string | null
          payload: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          pass2_id?: string | null
          payload?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          pass2_id?: string | null
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "staging_payload_pass2_id_fkey"
            columns: ["pass2_id"]
            isOneToOne: false
            referencedRelation: "pass2_runs"
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
      vault_push_queue: {
        Row: {
          created_at: string
          id: string
          neon_payload: Json | null
          staging_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          neon_payload?: Json | null
          staging_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          neon_payload?: Json | null
          staging_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_push_queue_staging_id_fkey"
            columns: ["staging_id"]
            isOneToOne: false
            referencedRelation: "staging_payload"
            referencedColumns: ["id"]
          },
        ]
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
