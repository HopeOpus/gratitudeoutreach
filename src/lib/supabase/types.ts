
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_session": string | null,"actor_user": string | null,"after": Json | null,"at": string,"before": Json | null,"id": number,"meta": Json | null,"row_id": string | null,"table_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_session"?: string | null,"actor_user"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"id"?: number,"meta"?: Json | null,"row_id"?: string | null,"table_name"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_session"?: string | null,"actor_user"?: string | null,"after"?: Json | null,"at"?: string,"before"?: Json | null,"id"?: number,"meta"?: Json | null,"row_id"?: string | null,"table_name"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"beneficiaries": {
                  Row: {
                    "age_range": Database["public"]['Enums']["age_range"] | null,"church_member": string | null,"community": string | null,"created_at": string,"deleted_at": string | null,"field_updated_at": NonNullable<Json>,"full_name": string,"full_name_search": string | null,"gender": Database["public"]['Enums']["gender"] | null,"guardian_beneficiary_id": string | null,"guardian_name": string | null,"id": string,"language": string | null,"merged_into": string | null,"org_id": string,"phone": string | null,"phone_last4": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "age_range"?: Database["public"]['Enums']["age_range"] | null,"church_member"?: string | null,"community"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"field_updated_at"?: NonNullable<Json>,"full_name": string,"full_name_search"?: never,"gender"?: Database["public"]['Enums']["gender"] | null,"guardian_beneficiary_id"?: string | null,"guardian_name"?: string | null,"id": string,"language"?: string | null,"merged_into"?: string | null,"org_id": string,"phone"?: string | null,"phone_last4"?: never,"updated_at"?: string
                  }
                  Update: {
                    "age_range"?: Database["public"]['Enums']["age_range"] | null,"church_member"?: string | null,"community"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"field_updated_at"?: NonNullable<Json>,"full_name"?: string,"full_name_search"?: never,"gender"?: Database["public"]['Enums']["gender"] | null,"guardian_beneficiary_id"?: string | null,"guardian_name"?: string | null,"id"?: string,"language"?: string | null,"merged_into"?: string | null,"org_id"?: string,"phone"?: string | null,"phone_last4"?: never,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "beneficiaries_guardian_beneficiary_id_fkey"
      columns: ["guardian_beneficiary_id"]
isOneToOne: false
      referencedRelation: "beneficiaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "beneficiaries_merged_into_fkey"
      columns: ["merged_into"]
isOneToOne: false
      referencedRelation: "beneficiaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "beneficiaries_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"break_glass_grants": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"kind": Database["public"]['Enums']["confidential_kind"],"reason": string,"user_id": string,"visit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at": string,"id"?: string,"kind": Database["public"]['Enums']["confidential_kind"],"reason": string,"user_id": string,"visit_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["confidential_kind"],"reason"?: string,"user_id"?: string,"visit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "break_glass_grants_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"cards": {
                  Row: {
                    "batch_no": number,"code": string,"created_at": string,"edition_id": string,"id": string,"status": Database["public"]['Enums']["card_status"],"updated_at": string,"visit_id": string | null,"voided_reason": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "batch_no": number,"code": string,"created_at"?: string,"edition_id": string,"id"?: string,"status"?: Database["public"]['Enums']["card_status"],"updated_at"?: string,"visit_id"?: string | null,"voided_reason"?: string | null
                  }
                  Update: {
                    "batch_no"?: number,"code"?: string,"created_at"?: string,"edition_id"?: string,"id"?: string,"status"?: Database["public"]['Enums']["card_status"],"updated_at"?: string,"visit_id"?: string | null,"voided_reason"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "cards_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    }
                  ]
                },"code_blocks": {
                  Row: {
                    "block_no": number,"created_at": string,"edition_id": string,"id": string,"next_value": number,"prefix": string,"range_end": number,"range_start": number,"session_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "block_no": number,"created_at"?: string,"edition_id": string,"id"?: string,"next_value": number,"prefix": string,"range_end": number,"range_start": number,"session_id"?: string | null
                  }
                  Update: {
                    "block_no"?: number,"created_at"?: string,"edition_id"?: string,"id"?: string,"next_value"?: number,"prefix"?: string,"range_end"?: number,"range_start"?: number,"session_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "code_blocks_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "code_blocks_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "volunteer_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"confidential_records": {
                  Row: {
                    "created_at": string,"edition_id": string,"kind": Database["public"]['Enums']["confidential_kind"],"payload": NonNullable<Json>,"redacted_at": string | null,"service_record_id": string,"visit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"edition_id": string,"kind": Database["public"]['Enums']["confidential_kind"],"payload": NonNullable<Json>,"redacted_at"?: string | null,"service_record_id": string,"visit_id": string
                  }
                  Update: {
                    "created_at"?: string,"edition_id"?: string,"kind"?: Database["public"]['Enums']["confidential_kind"],"payload"?: NonNullable<Json>,"redacted_at"?: string | null,"service_record_id"?: string,"visit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "confidential_records_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confidential_records_service_record_id_fkey"
      columns: ["service_record_id"]
isOneToOne: true
      referencedRelation: "service_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "confidential_records_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"editions": {
                  Row: {
                    "archived_at": string | null,"closed_at": string | null,"code_prefix": string,"created_at": string,"ends_on": string,"id": string,"is_training": boolean,"name": string,"org_id": string,"starts_on": string,"status": Database["public"]['Enums']["edition_status"],"theme": string | null,"updated_at": string,"venue": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"closed_at"?: string | null,"code_prefix": string,"created_at"?: string,"ends_on": string,"id"?: string,"is_training"?: boolean,"name": string,"org_id": string,"starts_on": string,"status"?: Database["public"]['Enums']["edition_status"],"theme"?: string | null,"updated_at"?: string,"venue"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"closed_at"?: string | null,"code_prefix"?: string,"created_at"?: string,"ends_on"?: string,"id"?: string,"is_training"?: boolean,"name"?: string,"org_id"?: string,"starts_on"?: string,"status"?: Database["public"]['Enums']["edition_status"],"theme"?: string | null,"updated_at"?: string,"venue"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "editions_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"flags": {
                  Row: {
                    "created_at": string,"created_by_session": string | null,"edition_id": string,"id": string,"kind": string,"resolved_at": string | null,"scope": Database["public"]['Enums']["flag_scope"],"text": string,"updated_at": string,"visit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by_session"?: string | null,"edition_id": string,"id": string,"kind": string,"resolved_at"?: string | null,"scope"?: Database["public"]['Enums']["flag_scope"],"text": string,"updated_at"?: string,"visit_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by_session"?: string | null,"edition_id"?: string,"id"?: string,"kind"?: string,"resolved_at"?: string | null,"scope"?: Database["public"]['Enums']["flag_scope"],"text"?: string,"updated_at"?: string,"visit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "flags_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "flags_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"followup_events": {
                  Row: {
                    "by_user": string | null,"created_at": string,"followup_id": string,"id": string,"note": string | null,"outcome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "by_user"?: string | null,"created_at"?: string,"followup_id": string,"id"?: string,"note"?: string | null,"outcome": string
                  }
                  Update: {
                    "by_user"?: string | null,"created_at"?: string,"followup_id"?: string,"id"?: string,"note"?: string | null,"outcome"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "followup_events_followup_id_fkey"
      columns: ["followup_id"]
isOneToOne: false
      referencedRelation: "followups"
      referencedColumns: ["id"]
    }
                  ]
                },"followups": {
                  Row: {
                    "assignee_user_id": string | null,"created_at": string,"due_on": string | null,"edition_id": string,"id": string,"preferred_time": string | null,"source_service_record_id": string | null,"status": Database["public"]['Enums']["followup_status"],"type": Database["public"]['Enums']["followup_type"],"updated_at": string,"visit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_user_id"?: string | null,"created_at"?: string,"due_on"?: string | null,"edition_id": string,"id"?: string,"preferred_time"?: string | null,"source_service_record_id"?: string | null,"status"?: Database["public"]['Enums']["followup_status"],"type": Database["public"]['Enums']["followup_type"],"updated_at"?: string,"visit_id": string
                  }
                  Update: {
                    "assignee_user_id"?: string | null,"created_at"?: string,"due_on"?: string | null,"edition_id"?: string,"id"?: string,"preferred_time"?: string | null,"source_service_record_id"?: string | null,"status"?: Database["public"]['Enums']["followup_status"],"type"?: Database["public"]['Enums']["followup_type"],"updated_at"?: string,"visit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "followups_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "followups_source_service_record_id_fkey"
      columns: ["source_service_record_id"]
isOneToOne: false
      referencedRelation: "service_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "followups_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_items": {
                  Row: {
                    "created_at": string,"edition_id": string,"id": string,"low_threshold": number,"name": string,"opening_qty": number,"remaining": number,"sizes": (string)[] | null,"station_id": string,"unit": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"edition_id": string,"id"?: string,"low_threshold"?: number,"name": string,"opening_qty"?: number,"remaining"?: number,"sizes"?: (string)[] | null,"station_id": string,"unit"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"edition_id"?: string,"id"?: string,"low_threshold"?: number,"name"?: string,"opening_qty"?: number,"remaining"?: number,"sizes"?: (string)[] | null,"station_id"?: string,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_items_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_items_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_items_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations_public"
      referencedColumns: ["id"]
    }
                  ]
                },"inventory_movements": {
                  Row: {
                    "created_at": string,"delta": number,"id": string,"item_id": string,"reason": string,"service_record_id": string | null,"session_or_user": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"delta": number,"id": string,"item_id": string,"reason": string,"service_record_id"?: string | null,"session_or_user"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"delta"?: number,"id"?: string,"item_id"?: string,"reason"?: string,"service_record_id"?: string | null,"session_or_user"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "inventory_movements_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "inventory_items"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "inventory_movements_service_record_id_fkey"
      columns: ["service_record_id"]
isOneToOne: false
      referencedRelation: "service_records"
      referencedColumns: ["id"]
    }
                  ]
                },"join_attempts": {
                  Row: {
                    "at": string,"id": number,"ip": string | null,"success": boolean,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"id"?: number,"ip"?: string | null,"success": boolean,"user_id"?: string | null
                  }
                  Update: {
                    "at"?: string,"id"?: number,"ip"?: string | null,"success"?: boolean,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"lead_overrides": {
                  Row: {
                    "created_at": string,"id": string,"session_id": string,"station_id": string,"used_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"session_id": string,"station_id": string,"used_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"session_id"?: string,"station_id"?: string,"used_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lead_overrides_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "volunteer_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_overrides_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "lead_overrides_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations_public"
      referencedColumns: ["id"]
    }
                  ]
                },"org_members": {
                  Row: {
                    "created_at": string,"display_name": string | null,"org_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"org_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"org_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "org_members_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "church_name": string | null,"consent_text": string,"consent_version": number,"created_at": string,"id": string,"name": string,"retention_months": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "church_name"?: string | null,"consent_text": string,"consent_version"?: number,"created_at"?: string,"id"?: string,"name": string,"retention_months"?: number,"updated_at"?: string
                  }
                  Update: {
                    "church_name"?: string | null,"consent_text"?: string,"consent_version"?: number,"created_at"?: string,"id"?: string,"name"?: string,"retention_months"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"service_records": {
                  Row: {
                    "created_at": string,"data": NonNullable<Json>,"edition_id": string,"has_confidential": boolean,"id": string,"served_at": string,"served_by_name": string,"session_id": string,"station_id": string,"summary": string,"updated_at": string,"visit_id": string,"void_reason": string | null,"voided_at": string | null,"voided_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"edition_id": string,"has_confidential"?: boolean,"id": string,"served_at": string,"served_by_name": string,"session_id": string,"station_id": string,"summary": string,"updated_at"?: string,"visit_id": string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"data"?: NonNullable<Json>,"edition_id"?: string,"has_confidential"?: boolean,"id"?: string,"served_at"?: string,"served_by_name"?: string,"session_id"?: string,"station_id"?: string,"summary"?: string,"updated_at"?: string,"visit_id"?: string,"void_reason"?: string | null,"voided_at"?: string | null,"voided_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "service_records_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "volunteer_sessions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "service_records_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"station_join_tokens": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"station_id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at": string,"station_id": string,"token_hash": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"station_id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "station_join_tokens_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "station_join_tokens_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations_public"
      referencedColumns: ["id"]
    }
                  ]
                },"station_secrets": {
                  Row: {
                    "join_pin_enc": string | null,"lead_pin_enc": string | null,"role_pin_enc": string | null,"station_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "join_pin_enc"?: string | null,"lead_pin_enc"?: string | null,"role_pin_enc"?: string | null,"station_id": string,"updated_at"?: string
                  }
                  Update: {
                    "join_pin_enc"?: string | null,"lead_pin_enc"?: string | null,"role_pin_enc"?: string | null,"station_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "station_secrets_station_id_fkey"
      columns: ["station_id"]
isOneToOne: true
      referencedRelation: "stations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "station_secrets_station_id_fkey"
      columns: ["station_id"]
isOneToOne: true
      referencedRelation: "stations_public"
      referencedColumns: ["id"]
    }
                  ]
                },"stations": {
                  Row: {
                    "color": string | null,"created_at": string,"edition_id": string,"enabled": boolean,"form_schema": Json | null,"icon": string | null,"id": string,"is_service": boolean,"join_pin_hash": string,"kind": Database["public"]['Enums']["station_kind"],"lead_pin_hash": string | null,"name": string,"role_pin_hash": string | null,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"edition_id": string,"enabled"?: boolean,"form_schema"?: Json | null,"icon"?: string | null,"id"?: string,"is_service"?: boolean,"join_pin_hash": string,"kind": Database["public"]['Enums']["station_kind"],"lead_pin_hash"?: string | null,"name": string,"role_pin_hash"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"edition_id"?: string,"enabled"?: boolean,"form_schema"?: Json | null,"icon"?: string | null,"id"?: string,"is_service"?: boolean,"join_pin_hash"?: string,"kind"?: Database["public"]['Enums']["station_kind"],"lead_pin_hash"?: string | null,"name"?: string,"role_pin_hash"?: string | null,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "stations_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    }
                  ]
                },"visit_needs": {
                  Row: {
                    "created_at": string,"declined_reason": string | null,"edition_id": string,"source": string,"state": Database["public"]['Enums']["need_state"],"state_at": string,"station_id": string,"updated_at": string,"visit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"declined_reason"?: string | null,"edition_id": string,"source"?: string,"state"?: Database["public"]['Enums']["need_state"],"state_at"?: string,"station_id": string,"updated_at"?: string,"visit_id": string
                  }
                  Update: {
                    "created_at"?: string,"declined_reason"?: string | null,"edition_id"?: string,"source"?: string,"state"?: Database["public"]['Enums']["need_state"],"state_at"?: string,"station_id"?: string,"updated_at"?: string,"visit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "visit_needs_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visit_needs_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visit_needs_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visit_needs_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"visits": {
                  Row: {
                    "beneficiary_id": string,"card_code": string | null,"checked_out_at": string | null,"client_updated_at": string | null,"consent_data_at": string,"consent_followup_at": string | null,"consent_version": number,"created_at": string,"deleted_at": string | null,"edition_id": string,"field_updated_at": NonNullable<Json>,"household_size": number | null,"id": string,"registered_at": string,"registered_by_name": string | null,"registered_by_session": string | null,"status": Database["public"]['Enums']["visit_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "beneficiary_id": string,"card_code"?: string | null,"checked_out_at"?: string | null,"client_updated_at"?: string | null,"consent_data_at": string,"consent_followup_at"?: string | null,"consent_version": number,"created_at"?: string,"deleted_at"?: string | null,"edition_id": string,"field_updated_at"?: NonNullable<Json>,"household_size"?: number | null,"id": string,"registered_at": string,"registered_by_name"?: string | null,"registered_by_session"?: string | null,"status"?: Database["public"]['Enums']["visit_status"],"updated_at"?: string
                  }
                  Update: {
                    "beneficiary_id"?: string,"card_code"?: string | null,"checked_out_at"?: string | null,"client_updated_at"?: string | null,"consent_data_at"?: string,"consent_followup_at"?: string | null,"consent_version"?: number,"created_at"?: string,"deleted_at"?: string | null,"edition_id"?: string,"field_updated_at"?: NonNullable<Json>,"household_size"?: number | null,"id"?: string,"registered_at"?: string,"registered_by_name"?: string | null,"registered_by_session"?: string | null,"status"?: Database["public"]['Enums']["visit_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "visits_beneficiary_id_fkey"
      columns: ["beneficiary_id"]
isOneToOne: false
      referencedRelation: "beneficiaries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_registered_by_session_fkey"
      columns: ["registered_by_session"]
isOneToOne: false
      referencedRelation: "volunteer_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"volunteer_sessions": {
                  Row: {
                    "confidential_ack_at": string | null,"created_at": string,"designation": string | null,"device_label": string | null,"display_name": string,"edition_id": string,"expires_at": string,"id": string,"last_seen_at": string | null,"oldest_pending_at": string | null,"pending_ops": number,"phone": string | null,"revoked_at": string | null,"role": Database["public"]['Enums']["session_role"],"station_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confidential_ack_at"?: string | null,"created_at"?: string,"designation"?: string | null,"device_label"?: string | null,"display_name": string,"edition_id": string,"expires_at": string,"id"?: string,"last_seen_at"?: string | null,"oldest_pending_at"?: string | null,"pending_ops"?: number,"phone"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["session_role"],"station_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "confidential_ack_at"?: string | null,"created_at"?: string,"designation"?: string | null,"device_label"?: string | null,"display_name"?: string,"edition_id"?: string,"expires_at"?: string,"id"?: string,"last_seen_at"?: string | null,"oldest_pending_at"?: string | null,"pending_ops"?: number,"phone"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["session_role"],"station_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "volunteer_sessions_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "volunteer_sessions_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "volunteer_sessions_station_id_fkey"
      columns: ["station_id"]
isOneToOne: false
      referencedRelation: "stations_public"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "stations_public": {
                  Row: {
                    "color": string | null,"created_at": string,"edition_id": string,"enabled": boolean,"form_schema": Json | null,"icon": string | null,"id": string,"is_service": boolean,"kind": Database["public"]['Enums']["station_kind"],"name": string,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                           "color"?: string | null,"created_at"?: string | null,"edition_id"?: string | null,"enabled"?: boolean | null,"form_schema"?: Json | null,"icon"?: string | null,"id"?: string | null,"is_service"?: boolean | null,"kind"?: Database["public"]['Enums']["station_kind"] | null,"name"?: string | null,"sort_order"?: number | null,"updated_at"?: string | null
                         }
                        Update: {
                           "color"?: string | null,"created_at"?: string | null,"edition_id"?: string | null,"enabled"?: boolean | null,"form_schema"?: Json | null,"icon"?: string | null,"id"?: string | null,"is_service"?: boolean | null,"kind"?: Database["public"]['Enums']["station_kind"] | null,"name"?: string | null,"sort_order"?: number | null,"updated_at"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "stations_edition_id_fkey"
      columns: ["edition_id"]
isOneToOne: false
      referencedRelation: "editions"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_station":
{ Args: { "p_edition": string,"p_icon"?: string,"p_kind": Database["public"]['Enums']["station_kind"],"p_name": string }; Returns: string
                           },
"adjust_inventory":
{ Args: { "p_delta": number,"p_id": string,"p_item": string,"p_reason": string }; Returns: undefined
                           },
"apply_patch":
{ Args: { "p_client_updated_at": string,"p_fields": Json,"p_id": string,"p_table": string }; Returns: Json
                           },
"assign_followup":
{ Args: { "p_followup": string,"p_user": string }; Returns: undefined
                           },
"break_glass":
{ Args: { "p_kind": Database["public"]['Enums']["confidential_kind"],"p_reason": string,"p_visit": string }; Returns: Json
                           },
"close_edition":
{ Args: { "p_edition": string,"p_force"?: boolean }; Returns: Json
                           },
"create_edition":
{ Args: { "p_clone_from"?: string,"p_code_prefix": string,"p_ends_on": string,"p_is_training"?: boolean,"p_name": string,"p_org": string,"p_starts_on": string,"p_venue"?: string }; Returns: string
                           },
"dashboard_stats":
{ Args: { "p_edition": string }; Returns: Json
                           },
"edition_delta":
{ Args: { "p_edition": string,"p_since": string }; Returns: Json
                           },
"edition_snapshot":
{ Args: { "p_edition": string,"p_page"?: number,"p_page_size"?: number }; Returns: Json
                           },
"find_duplicates":
{ Args: { "p_edition": string,"p_name": string,"p_phone"?: string }; Returns: {
              "age_range": Database["public"]['Enums']["age_range"],"beneficiary_id": string,"card_code_this_edition": string,"community": string,"full_name": string,"gender": Database["public"]['Enums']["gender"],"language": string,"last_edition_name": string,"last_visit_year": number,"match_reason": string,"phone_last4": string,"visit_id_this_edition": string
            }[]
                           },
"generate_cards":
{ Args: { "p_count": number,"p_edition": string }; Returns: Json
                           },
"get_confidential":
{ Args: { "p_visit": string }; Returns: {
              "created_at": string,
"edition_id": string,
"kind": Database["public"]['Enums']["confidential_kind"],
"payload": NonNullable<Json>,
"redacted_at": string | null,
"service_record_id": string,
"visit_id": string
            }[]
                          SetofOptions: {
        from: "*"
        to: "confidential_records"
        isOneToOne: false
        isSetofReturn: true
      } },
"heartbeat":
{ Args: { "p_oldest"?: string,"p_pending"?: number }; Returns: Json
                           },
"join_station":
{ Args: { "p_confidential_ack"?: boolean,"p_designation"?: string,"p_device_label"?: string,"p_name": string,"p_phone"?: string,"p_pin": string,"p_role_pin"?: string }; Returns: Json
                           },
"join_station_token":
{ Args: { "p_confidential_ack"?: boolean,"p_designation"?: string,"p_device_label"?: string,"p_name": string,"p_phone"?: string,"p_role_pin"?: string,"p_token": string }; Returns: Json
                           },
"leave_session":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"list_assignees":
{ Args: { "p_edition": string }; Returns: {
              "display_name": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
            }[]
                           },
"list_followups":
{ Args: { "p_edition": string }; Returns: {
              "age_range": Database["public"]['Enums']["age_range"],"assignee_name": string,"assignee_user_id": string,"card_code": string,"community": string,"consented": boolean,"created_at": string,"due_on": string,"full_name": string,"gender": Database["public"]['Enums']["gender"],"id": string,"last_note": string,"last_outcome": string,"last_outcome_at": string,"phone": string,"preferred_time": string,"status": Database["public"]['Enums']["followup_status"],"type": Database["public"]['Enums']["followup_type"],"visit_id": string
            }[]
                           },
"log_export":
{ Args: { "p_dataset": string,"p_edition": string,"p_format": string,"p_rows": number }; Returns: undefined
                           },
"log_followup":
{ Args: { "p_followup": string,"p_note"?: string,"p_outcome": string,"p_status"?: Database["public"]['Enums']["followup_status"] }; Returns: undefined
                           },
"merge_beneficiaries":
{ Args: { "p_keep": string,"p_merge": string }; Returns: undefined
                           },
"move_session":
{ Args: { "p_session": string,"p_station": string }; Returns: undefined
                           },
"redact_expired_confidential":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"replace_card":
{ Args: { "p_new_code": string,"p_reason"?: string,"p_visit": string }; Returns: undefined
                           },
"request_lead_override":
{ Args: { "p_pin": string }; Returns: Json
                           },
"reserve_code_block":
{ Args: { "p_size"?: number }; Returns: Json
                           },
"resolve_flag":
{ Args: { "p_flag": string }; Returns: undefined
                           },
"revoke_session":
{ Args: { "p_session": string }; Returns: undefined
                           },
"search_beneficiaries":
{ Args: { "p_edition": string,"p_limit"?: number,"p_q": string }; Returns: {
              "age_range": Database["public"]['Enums']["age_range"],"beneficiary_id": string,"card_code": string,"community": string,"full_name": string,"gender": Database["public"]['Enums']["gender"],"phone_last4": string,"score": number,"visit_id": string
            }[]
                           },
"set_need":
{ Args: { "p_reason"?: string,"p_state": Database["public"]['Enums']["need_state"],"p_station": string,"p_visit": string }; Returns: undefined
                           },
"set_station_pins":
{ Args: { "p_join_pin"?: string,"p_lead_pin"?: string,"p_role_pin"?: string,"p_station": string }; Returns: undefined
                           },
"void_service_record":
{ Args: { "p_id": string,"p_reason"?: string }; Returns: undefined
                           }
          }
          Enums: {
            "age_range": "0-12"|"13-17"|"18-35"|"36-59"|"60+","card_status": "unassigned"|"assigned"|"void","confidential_kind": "medical"|"counselling","edition_status": "draft"|"live"|"closed","flag_scope": "all"|"medical"|"counselling"|"leads","followup_status": "new"|"assigned"|"contacted"|"completed"|"unreachable","followup_type": "salvation"|"rededication"|"prayer"|"counselling"|"counselling_urgent"|"medical_referral"|"fellowship","gender": "female"|"male"|"undisclosed","need_state": "pending"|"served"|"declined"|"referred","org_role": "super_admin"|"coordinator"|"followup"|"viewer","session_role": "volunteer"|"station_lead","station_kind": "registration"|"prayer"|"counselling"|"medical"|"food"|"clothing"|"checkout"|"custom","visit_status": "active"|"checked_out"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "age_range": ["0-12", "13-17", "18-35", "36-59", "60+"],"card_status": ["unassigned", "assigned", "void"],"confidential_kind": ["medical", "counselling"],"edition_status": ["draft", "live", "closed"],"flag_scope": ["all", "medical", "counselling", "leads"],"followup_status": ["new", "assigned", "contacted", "completed", "unreachable"],"followup_type": ["salvation", "rededication", "prayer", "counselling", "counselling_urgent", "medical_referral", "fellowship"],"gender": ["female", "male", "undisclosed"],"need_state": ["pending", "served", "declined", "referred"],"org_role": ["super_admin", "coordinator", "followup", "viewer"],"session_role": ["volunteer", "station_lead"],"station_kind": ["registration", "prayer", "counselling", "medical", "food", "clothing", "checkout", "custom"],"visit_status": ["active", "checked_out"]
          }
        }
} as const
