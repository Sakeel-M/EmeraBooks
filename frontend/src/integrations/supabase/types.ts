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
      accounts: {
        Row: {
          account_name: string
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          parent_account_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          account_type: Database["public"]["Enums"]["account_type"]
          balance?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          parent_account_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          account_type?: Database["public"]["Enums"]["account_type"]
          balance?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          parent_account_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      analysis_results: {
        Row: {
          ai_analysis: Json
          basic_statistics: Json
          created_at: string
          data_overview: Json
          file_id: string
          id: string
          user_id: string
        }
        Insert: {
          ai_analysis: Json
          basic_statistics: Json
          created_at?: string
          data_overview: Json
          file_id: string
          id?: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json
          basic_statistics?: Json
          created_at?: string
          data_overview?: Json
          file_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: true
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string | null
          account_type: string | null
          balance: number | null
          bank_name: string
          created_at: string | null
          currency: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_name: string
          account_number?: string | null
          account_type?: string | null
          balance?: number | null
          bank_name: string
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string | null
          account_type?: string | null
          balance?: number | null
          bank_name?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      bill_items: {
        Row: {
          account_id: string | null
          amount: number
          bill_id: string
          created_at: string | null
          description: string
          id: string
          quantity: number
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          amount?: number
          bill_id: string
          created_at?: string | null
          description: string
          id?: string
          quantity?: number
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          account_id?: string | null
          amount?: number
          bill_id?: string
          created_at?: string | null
          description?: string
          id?: string
          quantity?: number
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_paid: number | null
          bill_date: string
          bill_number: string
          created_at: string | null
          currency: string | null
          due_date: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["bill_status"] | null
          subtotal: number
          tax_amount: number | null
          total_amount: number
          updated_at: string | null
          user_id: string
          vendor_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          bill_date: string
          bill_number: string
          created_at?: string | null
          currency?: string | null
          due_date: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["bill_status"] | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
          user_id: string
          vendor_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          bill_date?: string
          bill_number?: string
          created_at?: string | null
          currency?: string | null
          due_date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["bill_status"] | null
          subtotal?: number
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          budget_amount: number
          category: string
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_amount: number
          category: string
          created_at?: string
          currency: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_amount?: number
          category?: string
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          api_key: string | null
          config: Json | null
          connection_name: string
          connection_type: string
          created_at: string | null
          id: string
          last_sync: string | null
          status: Database["public"]["Enums"]["connection_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_key?: string | null
          config?: Json | null
          connection_name: string
          connection_type: string
          created_at?: string | null
          id?: string
          last_sync?: string | null
          status?: Database["public"]["Enums"]["connection_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_key?: string | null
          config?: Json | null
          connection_name?: string
          connection_type?: string
          created_at?: string | null
          id?: string
          last_sync?: string | null
          status?: Database["public"]["Enums"]["connection_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          balance: number | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          balance?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          balance?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          related_id: string | null
          related_type: string | null
          uploaded_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          related_id?: string | null
          related_type?: string | null
          uploaded_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          related_id?: string | null
          related_type?: string | null
          uploaded_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      inbox_items: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          item_type: string
          priority: number | null
          related_id: string | null
          related_type: string | null
          status: Database["public"]["Enums"]["inbox_item_status"] | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_type: string
          priority?: number | null
          related_id?: string | null
          related_type?: string | null
          status?: Database["public"]["Enums"]["inbox_item_status"] | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          item_type?: string
          priority?: number | null
          related_id?: string | null
          related_type?: string | null
          status?: Database["public"]["Enums"]["inbox_item_status"] | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          account_id: string | null
          amount: number
          created_at: string | null
          description: string
          id: string
          invoice_id: string
          quantity: number
          tax_rate: number | null
          unit_price: number
        }
        Insert: {
          account_id?: string | null
          amount?: number
          created_at?: string | null
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          tax_rate?: number | null
          unit_price?: number
        }
        Update: {
          account_id?: string | null
          amount?: number
          created_at?: string | null
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          tax_rate?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          subtotal: number
          tax_amount: number | null
          terms: string | null
          total_amount: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          due_date: string
          id?: string
          invoice_date: string
          invoice_number: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number
          tax_amount?: number | null
          terms?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          subtotal?: number
          tax_amount?: number | null
          terms?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string | null
          description: string
          entry_date: string
          entry_number: string
          id: string
          reference: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description: string
          entry_date: string
          entry_number: string
          id?: string
          reference?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string
          entry_date?: string
          entry_number?: string
          id?: string
          reference?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      journal_entry_lines: {
        Row: {
          account_id: string
          created_at: string | null
          credit_amount: number | null
          debit_amount: number | null
          description: string | null
          id: string
          journal_entry_id: string
        }
        Insert: {
          account_id: string
          created_at?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id: string
        }
        Update: {
          account_id?: string
          created_at?: string | null
          credit_amount?: number | null
          debit_amount?: number | null
          description?: string | null
          id?: string
          journal_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entry_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entry_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log_records: {
        Row: {
          created_at: string | null
          error_message: string | null
          external_id: string | null
          id: string
          record_data: Json | null
          record_id: string | null
          record_name: string | null
          status: string | null
          sync_log_id: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          record_data?: Json | null
          record_id?: string | null
          record_name?: string | null
          status?: string | null
          sync_log_id: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          external_id?: string | null
          id?: string
          record_data?: Json | null
          record_id?: string | null
          record_name?: string | null
          status?: string | null
          sync_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_log_records_sync_log_id_fkey"
            columns: ["sync_log_id"]
            isOneToOne: false
            referencedRelation: "sync_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          connection_id: string | null
          created_at: string | null
          entity_type: string
          error_message: string | null
          id: string
          records_failed: number | null
          records_processed: number | null
          started_at: string | null
          status: string | null
          sync_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string | null
          entity_type: string
          error_message?: string | null
          id?: string
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
          sync_type: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          connection_id?: string | null
          created_at?: string | null
          entity_type?: string
          error_message?: string | null
          id?: string
          records_failed?: number | null
          records_processed?: number | null
          started_at?: string | null
          status?: string | null
          sync_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "connections"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string
          file_id: string
          id: string
          transaction_date: string
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          description: string
          file_id: string
          id?: string
          transaction_date: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string
          file_id?: string
          id?: string
          transaction_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_files: {
        Row: {
          bank_code: string | null
          bank_name: string
          country: string | null
          created_at: string
          currency: string
          file_name: string
          id: string
          total_transactions: number
          user_id: string
        }
        Insert: {
          bank_code?: string | null
          bank_name: string
          country?: string | null
          created_at?: string
          currency: string
          file_name: string
          id?: string
          total_transactions?: number
          user_id: string
        }
        Update: {
          bank_code?: string | null
          bank_name?: string
          country?: string | null
          created_at?: string
          currency?: string
          file_name?: string
          id?: string
          total_transactions?: number
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          preferred_currency: string | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preferred_currency?: string | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preferred_currency?: string | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string | null
          balance: number | null
          city: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string | null
          user_id: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          balance?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          user_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          balance?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string | null
          user_id?: string
          zip_code?: string | null
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
      account_type: "asset" | "liability" | "equity" | "revenue" | "expense"
      bill_status: "draft" | "pending" | "paid" | "overdue" | "cancelled"
      connection_status: "active" | "inactive" | "error"
      inbox_item_status: "pending" | "reviewed" | "approved" | "rejected"
      invoice_status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
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
    Enums: {
      account_type: ["asset", "liability", "equity", "revenue", "expense"],
      bill_status: ["draft", "pending", "paid", "overdue", "cancelled"],
      connection_status: ["active", "inactive", "error"],
      inbox_item_status: ["pending", "reviewed", "approved", "rejected"],
      invoice_status: ["draft", "sent", "paid", "overdue", "cancelled"],
    },
  },
} as const
