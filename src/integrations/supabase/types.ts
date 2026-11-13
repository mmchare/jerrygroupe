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
      divisions: {
        Row: {
          created_at: string
          description_en: string
          description_fr: string
          domains_en: string[]
          domains_fr: string[]
          id: string
          name_en: string
          name_fr: string
          slug: string
          sort_order: number
          status: string
          summary_en: string
          summary_fr: string
          tagline_en: string
          tagline_fr: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string
          description_fr?: string
          domains_en?: string[]
          domains_fr?: string[]
          id?: string
          name_en: string
          name_fr: string
          slug: string
          sort_order?: number
          status?: string
          summary_en?: string
          summary_fr?: string
          tagline_en?: string
          tagline_fr?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string
          description_fr?: string
          domains_en?: string[]
          domains_fr?: string[]
          id?: string
          name_en?: string
          name_fr?: string
          slug?: string
          sort_order?: number
          status?: string
          summary_en?: string
          summary_fr?: string
          tagline_en?: string
          tagline_fr?: string
          updated_at?: string
        }
        Relationships: []
      }
      leadership_members: {
        Row: {
          bio_en: string | null
          bio_fr: string | null
          created_at: string
          expertise_en: string | null
          expertise_fr: string | null
          id: string
          is_published: boolean
          name_en: string
          name_fr: string
          portrait_url: string | null
          role_en: string
          role_fr: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          bio_en?: string | null
          bio_fr?: string | null
          created_at?: string
          expertise_en?: string | null
          expertise_fr?: string | null
          id?: string
          is_published?: boolean
          name_en: string
          name_fr: string
          portrait_url?: string | null
          role_en: string
          role_fr: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bio_en?: string | null
          bio_fr?: string | null
          created_at?: string
          expertise_en?: string | null
          expertise_fr?: string | null
          id?: string
          is_published?: boolean
          name_en?: string
          name_fr?: string
          portrait_url?: string | null
          role_en?: string
          role_fr?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      presence_locations: {
        Row: {
          city: string | null
          country_code: string
          created_at: string
          id: string
          is_published: boolean
          note_en: string
          note_fr: string
          presence_type: string | null
          region: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          city?: string | null
          country_code: string
          created_at?: string
          id?: string
          is_published?: boolean
          note_en?: string
          note_fr?: string
          presence_type?: string | null
          region: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          city?: string | null
          country_code?: string
          created_at?: string
          id?: string
          is_published?: boolean
          note_en?: string
          note_fr?: string
          presence_type?: string | null
          region?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      proposal_attachments: {
        Row: {
          created_at: string
          id: string
          message_id: string | null
          mime_type: string
          original_name: string
          proposal_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id?: string | null
          mime_type: string
          original_name: string
          proposal_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string | null
          mime_type?: string
          original_name?: string
          proposal_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "proposal_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_attachments_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_categories: {
        Row: {
          created_at: string
          description_en: string
          description_fr: string
          division_id: string | null
          extra_fields: Json
          id: string
          is_active: boolean
          name_en: string
          name_fr: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string
          description_fr?: string
          division_id?: string | null
          extra_fields?: Json
          id?: string
          is_active?: boolean
          name_en: string
          name_fr: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string
          description_fr?: string
          division_id?: string | null
          extra_fields?: Json
          id?: string
          is_active?: boolean
          name_en?: string
          name_fr?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_categories_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_messages: {
        Row: {
          author_id: string | null
          body: string
          client_message_id: string | null
          created_at: string
          direction: string
          id: string
          ip_hash: string | null
          proposal_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          client_message_id?: string | null
          created_at?: string
          direction: string
          id?: string
          ip_hash?: string | null
          proposal_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          client_message_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          ip_hash?: string | null
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_messages_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          internal_note: string | null
          proposal_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          supplier_message: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          proposal_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          supplier_message?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          internal_note?: string | null
          proposal_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          supplier_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_status_history_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          acknowledgement_status: string
          additional_info: string | null
          asking_price: number | null
          availability: string | null
          category_id: string
          city: string
          client_submission_id: string
          company_name: string | null
          country_code: string
          created_at: string
          currency: string | null
          declaration_accepted_at: string
          delivery_location: string | null
          description: string
          email: string
          extra_answers: Json
          full_name: string
          id: string
          ip_hash: string | null
          origin_country_code: string | null
          preferred_language: string
          product_condition: string | null
          proposer_type: string
          quantity: number | null
          reference: string
          status: Database["public"]["Enums"]["proposal_status"]
          submission_language: string
          title: string
          unit: string | null
          updated_at: string
          user_agent: string | null
          whatsapp_e164: string
        }
        Insert: {
          acknowledgement_status?: string
          additional_info?: string | null
          asking_price?: number | null
          availability?: string | null
          category_id: string
          city: string
          client_submission_id: string
          company_name?: string | null
          country_code: string
          created_at?: string
          currency?: string | null
          declaration_accepted_at: string
          delivery_location?: string | null
          description: string
          email: string
          extra_answers?: Json
          full_name: string
          id?: string
          ip_hash?: string | null
          origin_country_code?: string | null
          preferred_language: string
          product_condition?: string | null
          proposer_type: string
          quantity?: number | null
          reference: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submission_language: string
          title: string
          unit?: string | null
          updated_at?: string
          user_agent?: string | null
          whatsapp_e164: string
        }
        Update: {
          acknowledgement_status?: string
          additional_info?: string | null
          asking_price?: number | null
          availability?: string | null
          category_id?: string
          city?: string
          client_submission_id?: string
          company_name?: string | null
          country_code?: string
          created_at?: string
          currency?: string | null
          declaration_accepted_at?: string
          delivery_location?: string | null
          description?: string
          email?: string
          extra_answers?: Json
          full_name?: string
          id?: string
          ip_hash?: string | null
          origin_country_code?: string | null
          preferred_language?: string
          product_condition?: string | null
          proposer_type?: string
          quantity?: number | null
          reference?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          submission_language?: string
          title?: string
          unit?: string | null
          updated_at?: string
          user_agent?: string | null
          whatsapp_e164?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "proposal_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_counters: {
        Row: {
          last_value: number
          scope: string
          year: number
        }
        Insert: {
          last_value?: number
          scope: string
          year: number
        }
        Update: {
          last_value?: number
          scope?: string
          year?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value_en: string
          value_fr: string
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value_en?: string
          value_fr?: string
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value_en?: string
          value_fr?: string
        }
        Relationships: []
      }
      supplier_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_used_at: string | null
          proposal_id: string
          purpose: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_used_at?: string | null
          proposal_id: string
          purpose: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_used_at?: string | null
          proposal_id?: string
          purpose?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_access_tokens_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          created_at: string
          created_by: string | null
          doc_type: Database["public"]["Enums"]["supplier_document_type"]
          document_group_id: string
          file_name: string
          id: string
          issue_date: string
          mime_type: string
          proposal_id: string
          published_at: string | null
          reference: string
          revoked_at: string | null
          size_bytes: number
          status: string
          storage_path: string
          title_en: string
          title_fr: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          doc_type: Database["public"]["Enums"]["supplier_document_type"]
          document_group_id?: string
          file_name: string
          id?: string
          issue_date?: string
          mime_type?: string
          proposal_id: string
          published_at?: string | null
          reference: string
          revoked_at?: string | null
          size_bytes: number
          status?: string
          storage_path: string
          title_en?: string
          title_fr?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          doc_type?: Database["public"]["Enums"]["supplier_document_type"]
          document_group_id?: string
          file_name?: string
          id?: string
          issue_date?: string
          mime_type?: string
          proposal_id?: string
          published_at?: string | null
          reference?: string
          revoked_at?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string
          title_en?: string
          title_fr?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_attempts: {
        Row: {
          created_at: string
          id: string
          ip_hash: string | null
          reference: string
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          reference: string
          success?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          ip_hash?: string | null
          reference?: string
          success?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      next_proposal_reference: { Args: never; Returns: string }
    }
    Enums: {
      proposal_status:
        | "received"
        | "under_review"
        | "additional_info_required"
        | "under_negotiation"
        | "approved_in_principle"
        | "approved"
        | "rejected"
        | "purchase_order_issued"
        | "completed"
        | "archived"
      supplier_document_type:
        | "purchase_order"
        | "contract"
        | "invoice"
        | "delivery_document"
        | "payment_receipt"
        | "amendment"
        | "other"
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
      proposal_status: [
        "received",
        "under_review",
        "additional_info_required",
        "under_negotiation",
        "approved_in_principle",
        "approved",
        "rejected",
        "purchase_order_issued",
        "completed",
        "archived",
      ],
      supplier_document_type: [
        "purchase_order",
        "contract",
        "invoice",
        "delivery_document",
        "payment_receipt",
        "amendment",
        "other",
      ],
    },
  },
} as const
