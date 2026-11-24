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
    PostgrestVersion: "14.17"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_usage: {
        Row: {
          audio_seconds: number
          characters: number
          cost_usd: number
          created_at: string
          feature: string
          id: string
          input_tokens: number
          model: string
          output_tokens: number
          provider: string
          status: string
          user_id: string | null
        }
        Insert: {
          audio_seconds?: number
          characters?: number
          cost_usd?: number
          created_at?: string
          feature: string
          id?: string
          input_tokens?: number
          model: string
          output_tokens?: number
          provider: string
          status?: string
          user_id?: string | null
        }
        Update: {
          audio_seconds?: number
          characters?: number
          cost_usd?: number
          created_at?: string
          feature?: string
          id?: string
          input_tokens?: number
          model?: string
          output_tokens?: number
          provider?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      allowed_emails: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          created_at: string
          difficulty: number
          due: string
          id: string
          kind: Database["public"]["Enums"]["card_kind"]
          lapses: number
          last_review: string | null
          learning_steps: number
          reps: number
          scheduled_days: number
          stability: number
          state: Database["public"]["Enums"]["card_state"]
          status: Database["public"]["Enums"]["card_status"]
          updated_at: string
          user_id: string
          user_word_id: string
        }
        Insert: {
          created_at?: string
          difficulty?: number
          due?: string
          id?: string
          kind: Database["public"]["Enums"]["card_kind"]
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: Database["public"]["Enums"]["card_state"]
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
          user_id?: string
          user_word_id: string
        }
        Update: {
          created_at?: string
          difficulty?: number
          due?: string
          id?: string
          kind?: Database["public"]["Enums"]["card_kind"]
          lapses?: number
          last_review?: string | null
          learning_steps?: number
          reps?: number
          scheduled_days?: number
          stability?: number
          state?: Database["public"]["Enums"]["card_state"]
          status?: Database["public"]["Enums"]["card_status"]
          updated_at?: string
          user_id?: string
          user_word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_user_word_id_user_id_fkey"
            columns: ["user_word_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_words"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      lexicon: {
        Row: {
          audio_url: string | null
          cefr: string | null
          content: Json
          created_at: string
          enrich_model: string | null
          enriched_at: string | null
          frequency_rank: number | null
          id: string
          lemma: string
          part_of_speech: string
          source_list: string | null
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          cefr?: string | null
          content?: Json
          created_at?: string
          enrich_model?: string | null
          enriched_at?: string | null
          frequency_rank?: number | null
          id?: string
          lemma: string
          part_of_speech?: string
          source_list?: string | null
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          cefr?: string | null
          content?: Json
          created_at?: string
          enrich_model?: string | null
          enriched_at?: string | null
          frequency_rank?: number | null
          id?: string
          lemma?: string
          part_of_speech?: string
          source_list?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lexicon_lists: {
        Row: {
          lexicon_id: string
          list: string
          rank: number
        }
        Insert: {
          lexicon_id: string
          list: string
          rank: number
        }
        Update: {
          lexicon_id?: string
          list?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "lexicon_lists_lexicon_id_fkey"
            columns: ["lexicon_id"]
            isOneToOne: false
            referencedRelation: "lexicon"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          calibrated_at: string | null
          created_at: string
          daily_minutes: number
          goals: string[]
          id: string
          known_rank: number | null
          level_estimate: Json | null
          onboarded_at: string | null
          program_rank: number | null
          timezone: string
          updated_at: string
        }
        Insert: {
          calibrated_at?: string | null
          created_at?: string
          daily_minutes?: number
          goals?: string[]
          id?: string
          known_rank?: number | null
          level_estimate?: Json | null
          onboarded_at?: string | null
          program_rank?: number | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          calibrated_at?: string | null
          created_at?: string
          daily_minutes?: number
          goals?: string[]
          id?: string
          known_rank?: number | null
          level_estimate?: Json | null
          onboarded_at?: string | null
          program_rank?: number | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_logs: {
        Row: {
          card_id: string
          elapsed_ms: number
          id: string
          rating: Database["public"]["Enums"]["review_rating"]
          response_text: string
          reviewed_at: string
          schedule_after: Json
          schedule_before: Json
          user_id: string
          user_word_id: string
          was_correct: boolean
        }
        Insert: {
          card_id: string
          elapsed_ms?: number
          id?: string
          rating: Database["public"]["Enums"]["review_rating"]
          response_text?: string
          reviewed_at?: string
          schedule_after: Json
          schedule_before: Json
          user_id?: string
          user_word_id: string
          was_correct: boolean
        }
        Update: {
          card_id?: string
          elapsed_ms?: number
          id?: string
          rating?: Database["public"]["Enums"]["review_rating"]
          response_text?: string
          reviewed_at?: string
          schedule_after?: Json
          schedule_before?: Json
          user_id?: string
          user_word_id?: string
          was_correct?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "review_logs_card_id_user_id_fkey"
            columns: ["card_id", "user_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "review_logs_user_word_id_user_id_fkey"
            columns: ["user_word_id", "user_id"]
            isOneToOne: false
            referencedRelation: "user_words"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      user_words: {
        Row: {
          assumed_known: boolean
          content: Json
          created_at: string
          id: string
          lemma: string
          lexicon_id: string | null
          source: Database["public"]["Enums"]["word_source"]
          status: Database["public"]["Enums"]["word_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assumed_known?: boolean
          content?: Json
          created_at?: string
          id?: string
          lemma: string
          lexicon_id?: string | null
          source?: Database["public"]["Enums"]["word_source"]
          status?: Database["public"]["Enums"]["word_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          assumed_known?: boolean
          content?: Json
          created_at?: string
          id?: string
          lemma?: string
          lexicon_id?: string | null
          source?: Database["public"]["Enums"]["word_source"]
          status?: Database["public"]["Enums"]["word_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_words_lexicon_id_fkey"
            columns: ["lexicon_id"]
            isOneToOne: false
            referencedRelation: "lexicon"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ai_month_spend: { Args: never; Returns: number }
      ai_reserve: {
        Args: {
          p_estimate: number
          p_feature: string
          p_model: string
          p_monthly_limit: number
          p_per_day: number
          p_per_minute: number
          p_provider: string
          p_user: string
        }
        Returns: {
          reason: string
          reservation_id: string
        }[]
      }
      get_practice_cards: {
        Args: { p_limit?: number; p_new_words?: number; p_tz: string }
        Returns: {
          content: Json
          difficulty: number
          due: string
          id: string
          kind: Database["public"]["Enums"]["card_kind"]
          lapses: number
          last_review: string
          learning_steps: number
          lemma: string
          reps: number
          scheduled_days: number
          stability: number
          state: Database["public"]["Enums"]["card_state"]
          user_word_id: string
          word_reviewed_at: string
        }[]
      }
      get_practice_overview: {
        Args: { p_tz: string }
        Returns: {
          active_cards: number
          daily_minutes: number
          day_start: string
          due_words: number
          new_ready: number
          new_today: number
          next_due_at: string
          reviews_today: number
        }[]
      }
      get_program_calibration: {
        Args: { p_since: string }
        Returns: {
          assumed_known: boolean
          rating: Database["public"]["Enums"]["review_rating"]
          reviewed_at: string
        }[]
      }
      get_program_candidates: {
        Args: { p_limit: number; p_list: string; p_min_rank: number }
        Returns: {
          content: Json
          enriched: boolean
          frequency_rank: number
          lemma: string
          lexicon_id: string
          list_rank: number
        }[]
      }
      get_progress_stats: { Args: { p_tz: string }; Returns: Json }
      get_streak: {
        Args: { p_tz: string }
        Returns: {
          reviewed_today: boolean
          streak: number
          today: string
          week_days: string[]
        }[]
      }
      is_current_user_allowed: { Args: never; Returns: boolean }
      restore_words_backup: { Args: { p_words: Json }; Returns: number }
    }
    Enums: {
      card_kind:
        | "recognition"
        | "recall"
        | "cloze"
        | "listening"
        | "sentence"
        | "speaking"
      card_state: "New" | "Learning" | "Review" | "Relearning"
      card_status: "active" | "paused"
      review_rating: "again" | "hard" | "good" | "easy"
      word_source: "program" | "manual" | "text" | "import"
      word_status: "active" | "paused" | "archived"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      card_kind: [
        "recognition",
        "recall",
        "cloze",
        "listening",
        "sentence",
        "speaking",
      ],
      card_state: ["New", "Learning", "Review", "Relearning"],
      card_status: ["active", "paused"],
      review_rating: ["again", "hard", "good", "easy"],
      word_source: ["program", "manual", "text", "import"],
      word_status: ["active", "paused", "archived"],
    },
  },
} as const
