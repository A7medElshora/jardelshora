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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cashier_products: {
        Row: {
          barcode: string
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          quantity: number
          retail_price: number
          updated_at: string
          wholesale_price: number
        }
        Insert: {
          barcode: string
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          quantity?: number
          retail_price?: number
          updated_at?: string
          wholesale_price?: number
        }
        Update: {
          barcode?: string
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          quantity?: number
          retail_price?: number
          updated_at?: string
          wholesale_price?: number
        }
        Relationships: []
      }
      cashier_sales: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          product_id: string
          product_name: string
          quantity: number
          retail_price: number
          sale_date: string
          wholesale_price: number
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          product_id: string
          product_name: string
          quantity?: number
          retail_price?: number
          sale_date?: string
          wholesale_price?: number
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          retail_price?: number
          sale_date?: string
          wholesale_price?: number
        }
        Relationships: []
      }
      cig_items: {
        Row: {
          created_at: string
          id: string
          name: string
          quantity: number
          updated_at: string
          wholesale_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          quantity?: number
          updated_at?: string
          wholesale_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          quantity?: number
          updated_at?: string
          wholesale_price?: number
        }
        Relationships: []
      }
      cig_purchases: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_name: string
          purchase_date: string
          quantity: number
          wholesale_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_name: string
          purchase_date?: string
          quantity: number
          wholesale_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string
          purchase_date?: string
          quantity?: number
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "cig_purchases_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "cig_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cig_settings: {
        Row: {
          base_capital: number
          created_at: string
          id: number
          start_date: string
        }
        Insert: {
          base_capital?: number
          created_at?: string
          id?: number
          start_date?: string
        }
        Update: {
          base_capital?: number
          created_at?: string
          id?: number
          start_date?: string
        }
        Relationships: []
      }
      cig_settlements: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          settlement_date: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          settlement_date?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          settlement_date?: string
        }
        Relationships: []
      }
      cig_transfers: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_name: string
          quantity: number
          transfer_date: string
          wholesale_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_name: string
          quantity: number
          transfer_date?: string
          wholesale_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string
          quantity?: number
          transfer_date?: string
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "cig_transfers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "cig_items"
            referencedColumns: ["id"]
          },
        ]
      }
      cigarette_sales: {
        Row: {
          created_at: string
          id: string
          retail_total: number
          sale_date: string
          updated_at: string
          wholesale_total: number
        }
        Insert: {
          created_at?: string
          id?: string
          retail_total?: number
          sale_date: string
          updated_at?: string
          wholesale_total?: number
        }
        Update: {
          created_at?: string
          id?: string
          retail_total?: number
          sale_date?: string
          updated_at?: string
          wholesale_total?: number
        }
        Relationships: []
      }
      daily_sales: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity_sold: number
          retail_price_snapshot: number
          sale_date: string
          updated_at: string
          wholesale_price_snapshot: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity_sold?: number
          retail_price_snapshot?: number
          sale_date: string
          updated_at?: string
          wholesale_price_snapshot?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity_sold?: number
          retail_price_snapshot?: number
          sale_date?: string
          updated_at?: string
          wholesale_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_sales: {
        Row: {
          amount: number
          created_at: string
          id: string
          sale_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          sale_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          sale_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_price: number
          old_price: number
          product_id: string
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price: number
          old_price: number
          product_id: string
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          low_stock_threshold: number
          name: string
          quantity: number
          retail_price: number
          updated_at: string
          wholesale_price: number
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name: string
          quantity?: number
          retail_price?: number
          updated_at?: string
          wholesale_price?: number
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          low_stock_threshold?: number
          name?: string
          quantity?: number
          retail_price?: number
          updated_at?: string
          wholesale_price?: number
        }
        Relationships: []
      }
      profit_expenses: {
        Row: {
          amount: number
          created_at: string
          expense_date: string
          id: string
          reason: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          expense_date: string
          id?: string
          reason?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          expense_date?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      profit_withdrawals: {
        Row: {
          created_at: string
          id: string
          note: string | null
          profit_date: string
          taken_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          profit_date: string
          taken_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          profit_date?: string
          taken_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_date: string
          quantity: number
          supplier: string | null
          wholesale_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_date?: string
          quantity: number
          supplier?: string | null
          wholesale_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_date?: string
          quantity?: number
          supplier?: string | null
          wholesale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_purchase_invoices: {
        Row: {
          created_at: string
          id: string
          invoice_date: string
          invoice_number: string | null
          items: Json
          notes: string | null
          paid_amount: number
          supplier_name: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          invoice_date: string
          invoice_number?: string | null
          items?: Json
          notes?: string | null
          paid_amount?: number
          supplier_name: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          items?: Json
          notes?: string | null
          paid_amount?: number
          supplier_name?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      taqseemat_profits: {
        Row: {
          amount: number
          created_at: string
          id: string
          profit_date: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          profit_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          profit_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      taqseemat_withdrawals: {
        Row: {
          amount: number
          created_at: string
          entry_date: string
          id: string
          kind: string
          note: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          entry_date: string
          id?: string
          kind: string
          note?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          entry_date?: string
          id?: string
          kind?: string
          note?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cig_add_item: {
        Args: { p_name: string; p_quantity: number; p_wholesale_price: number }
        Returns: string
      }
      cig_add_settlement: {
        Args: { p_amount: number; p_note: string; p_settlement_date: string }
        Returns: undefined
      }
      cig_delete_item: { Args: { p_item_id: string }; Returns: undefined }
      cig_delete_purchase: { Args: { p_id: string }; Returns: undefined }
      cig_delete_settlement: { Args: { p_id: string }; Returns: undefined }
      cig_delete_transfer: { Args: { p_id: string }; Returns: undefined }
      cig_item_remaining: { Args: { p_item_id: string }; Returns: number }
      cig_item_unit_cost: { Args: { p_item_id: string }; Returns: number }
      cig_mardooda_balance: { Args: never; Returns: number }
      cig_purchase: {
        Args: {
          p_item_id: string | null
          p_name: string
          p_purchase_date: string
          p_quantity: number
          p_wholesale_price: number
        }
        Returns: undefined
      }
      cig_transfer: {
        Args: { p_item_id: string; p_quantity: number; p_transfer_date: string }
        Returns: undefined
      }
      cig_update_item: {
        Args: {
          p_item_id: string
          p_name: string
          p_quantity: number
          p_wholesale_price: number
        }
        Returns: undefined
      }
      cig_update_purchase: {
        Args: {
          p_id: string
          p_purchase_date: string
          p_quantity: number
          p_wholesale_price: number
        }
        Returns: undefined
      }
      cig_update_transfer: {
        Args: { p_id: string; p_quantity: number; p_transfer_date: string }
        Returns: undefined
      }
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
