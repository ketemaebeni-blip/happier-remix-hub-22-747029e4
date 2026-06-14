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
      cake_availability: {
        Row: {
          available: boolean
          cake_id: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available?: boolean
          cake_id: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available?: boolean
          cake_id?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cake_availability_log: {
        Row: {
          available: boolean
          cake_id: number
          changed_at: string
          changed_by: string | null
          changed_by_email: string | null
          id: string
        }
        Insert: {
          available: boolean
          cake_id: number
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          id?: string
        }
        Update: {
          available?: boolean
          cake_id?: number
          changed_at?: string
          changed_by?: string | null
          changed_by_email?: string | null
          id?: string
        }
        Relationships: []
      }
      cake_overrides: {
        Row: {
          cake_id: number
          category: string | null
          image_url: string | null
          name: string | null
          price: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cake_id: number
          category?: string | null
          image_url?: string | null
          name?: string | null
          price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cake_id?: number
          category?: string | null
          image_url?: string | null
          name?: string | null
          price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      operational_costs: {
        Row: {
          category: Database["public"]["Enums"]["cost_category"]
          cost_amount: number
          created_at: string
          created_by: string | null
          date_incurred: string
          id: string
          item_name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["cost_category"]
          cost_amount: number
          created_at?: string
          created_by?: string | null
          date_incurred?: string
          id?: string
          item_name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["cost_category"]
          cost_amount?: number
          created_at?: string
          created_by?: string | null
          date_incurred?: string
          id?: string
          item_name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_address: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          items: Json
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      premises_expenses: {
        Row: {
          amount: number
          billing_period: Database["public"]["Enums"]["billing_period"]
          created_at: string
          created_by: string | null
          due_date: string
          expense_type: string
          id: string
          notes: string | null
          paid_date: string | null
          status: Database["public"]["Enums"]["expense_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          created_by?: string | null
          due_date: string
          expense_type: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          created_by?: string | null
          due_date?: string
          expense_type?: string
          id?: string
          notes?: string | null
          paid_date?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          updated_at?: string
        }
        Relationships: []
      }
      shop_item_availability: {
        Row: {
          available: boolean
          item_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          available?: boolean
          item_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          available?: boolean
          item_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          available: boolean
          cat: string
          created_at: string
          id: string
          img: string
          name: string
          price: number
          sort_order: number
          sub: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          cat: string
          created_at?: string
          id: string
          img?: string
          name: string
          price?: number
          sort_order?: number
          sub?: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          cat?: string
          created_at?: string
          id?: string
          img?: string
          name?: string
          price?: number
          sort_order?: number
          sub?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_sales_analytics: {
        Args: { _from?: string; _granularity?: string; _to?: string }
        Returns: {
          bucket: string
          order_count: number
          revenue: number
          units_sold: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      billing_period: "one_time" | "weekly" | "monthly" | "quarterly" | "yearly"
      cost_category: "ingredients" | "packaging" | "miscellaneous"
      expense_status: "paid" | "unpaid" | "overdue"
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
      app_role: ["admin", "user"],
      billing_period: ["one_time", "weekly", "monthly", "quarterly", "yearly"],
      cost_category: ["ingredients", "packaging", "miscellaneous"],
      expense_status: ["paid", "unpaid", "overdue"],
    },
  },
} as const
