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
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hashtags: {
        Row: {
          created_at: string
          last_used_at: string
          post_count: number
          tag: string
        }
        Insert: {
          created_at?: string
          last_used_at?: string
          post_count?: number
          tag: string
        }
        Update: {
          created_at?: string
          last_used_at?: string
          post_count?: number
          tag?: string
        }
        Relationships: []
      }
      media_uploads: {
        Row: {
          created_at: string
          id: string
          kind: string
          staging_path: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          staging_path: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          staging_path?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      post_hashtags: {
        Row: {
          post_id: string
          tag: string
        }
        Insert: {
          post_id: string
          tag: string
        }
        Update: {
          post_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_tag_fkey"
            columns: ["tag"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["tag"]
          },
        ]
      }
      post_media: {
        Row: {
          byte_size: number
          created_at: string
          duration_ms: number | null
          height: number
          id: string
          kind: string
          position: number
          post_id: string
          storage_path: string
          width: number
        }
        Insert: {
          byte_size: number
          created_at?: string
          duration_ms?: number | null
          height: number
          id?: string
          kind: string
          position?: number
          post_id: string
          storage_path: string
          width: number
        }
        Update: {
          byte_size?: number
          created_at?: string
          duration_ms?: number | null
          height?: number
          id?: string
          kind?: string
          position?: number
          post_id?: string
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_people_tags: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_people_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_people_tags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          kind: string
          mute_original: boolean
          song: Json | null
          text_style: Json | null
        }
        Insert: {
          author_id: string
          body?: string
          created_at?: string
          id?: string
          kind: string
          mute_original?: boolean
          song?: Json | null
          text_style?: Json | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          kind?: string
          mute_original?: boolean
          song?: Json | null
          text_style?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          country: string | null
          created_at: string
          full_name: string | null
          id: string
          location: string | null
          onboarded: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          location?: string | null
          onboarded?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          location?: string | null
          onboarded?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      upload_fingerprints: {
        Row: {
          byte_size: number
          created_at: string
          height: number
          id: string
          phash: string
          purpose: string
          sha256: string
          storage_path: string
          user_id: string
          width: number
        }
        Insert: {
          byte_size: number
          created_at?: string
          height: number
          id?: string
          phash: string
          purpose?: string
          sha256: string
          storage_path: string
          user_id: string
          width: number
        }
        Update: {
          byte_size?: number
          created_at?: string
          height?: number
          id?: string
          phash?: string
          purpose?: string
          sha256?: string
          storage_path?: string
          user_id?: string
          width?: number
        }
        Relationships: []
      }
      video_frame_fingerprints: {
        Row: {
          created_at: string
          frame_index: number
          height: number
          id: string
          phash: string
          sha256: string
          storage_path: string
          time_ms: number
          user_id: string
          width: number
        }
        Insert: {
          created_at?: string
          frame_index: number
          height: number
          id?: string
          phash: string
          sha256: string
          storage_path: string
          time_ms: number
          user_id: string
          width: number
        }
        Update: {
          created_at?: string
          frame_index?: number
          height?: number
          id?: string
          phash?: string
          sha256?: string
          storage_path?: string
          time_ms?: number
          user_id?: string
          width?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      contact_counts: {
        Args: never
        Returns: {
          followers: number
          following: number
          friends: number
        }[]
      }
      is_current_avatar: { Args: { _path: string }; Returns: boolean }
      is_onboarded_profile: { Args: { _id: string }; Returns: boolean }
      is_post_media: { Args: { _path: string }; Returns: boolean }
      is_username_available: { Args: { _username: string }; Returns: boolean }
      list_contacts: {
        Args: {
          _limit?: number
          _offset?: number
          _search?: string
          _tab?: string
        }
        Returns: {
          avatar_path: string
          country: string
          follows_me: boolean
          full_name: string
          i_follow: boolean
          id: string
          username: string
        }[]
      }
      register_hashtags: { Args: { _tags: string[] }; Returns: undefined }
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
    Enums: {},
  },
} as const
