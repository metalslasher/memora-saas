export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      allowed_emails: {
        Row: { created_at: string; email: string }
        Insert: { created_at?: string; email: string }
        Update: { created_at?: string; email?: string }
        Relationships: []
      }
      cards: {
        Row: {
          created_at: string
          difficulty: number
          due: string
          elapsed_days: number
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
          elapsed_days?: number
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
          elapsed_days?: number
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
          frequency_rank?: number | null
          id?: string
          lemma?: string
          part_of_speech?: string
          source_list?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          daily_minutes: number
          goals: string[]
          id: string
          level_estimate: Json | null
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          daily_minutes?: number
          goals?: string[]
          id?: string
          level_estimate?: Json | null
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          daily_minutes?: number
          goals?: string[]
          id?: string
          level_estimate?: Json | null
          settings?: Json
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
      get_practice_queue: {
        Args: { p_extra_new?: number; p_limit?: number; p_tz: string }
        Returns: {
          content: Json
          difficulty: number
          due: string
          elapsed_days: number
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
        }[]
      }
      get_practice_summary: {
        Args: { p_tz: string }
        Returns: {
          active_cards: number
          daily_new_limit: number
          due_reviews: number
          new_ready: number
          new_today: number
          next_due_at: string
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
