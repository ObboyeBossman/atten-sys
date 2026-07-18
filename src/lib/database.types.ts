// ============================================================
// Supabase Database types — generated from 0001_schema.sql
// These mirror the actual DB schema. Update if schema changes.
// ============================================================

export type UserRole = 'super_admin' | 'student' | 'lecturer'
export type MembershipStatus = 'active' | 'promoted' | 'completed' | 'removed'
export type SemesterStatus = 'upcoming' | 'active' | 'archived'
export type ArrivalStatus = 'present' | 'late' | 'absent'
export type DisputeStatus = 'pending' | 'approved' | 'rejected'

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          role: UserRole
          phone: string | null
          is_active: boolean
          must_change_password: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }
      super_admins: {
        Row: { id: string; name: string }
        Insert: { id: string; name: string }
        Update: Partial<{ name: string }>
      }
      students: {
        Row: {
          id: string
          name: string
          index_number: string
          photo_path: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['students']['Row'], 'created_at'>
        Update: Partial<Pick<Database['public']['Tables']['students']['Row'], 'name' | 'photo_path'>>
      }
      lecturers: {
        Row: {
          id: string
          name: string
          staff_id: string
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['lecturers']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Pick<Database['public']['Tables']['lecturers']['Row'], 'name' | 'staff_id' | 'phone'>>
      }
      faculties: {
        Row: { id: string; name: string; created_at: string; updated_at: string }
        Insert: { id?: string; name: string }
        Update: Partial<{ name: string }>
      }
      departments: {
        Row: { id: string; faculty_id: string; name: string; created_at: string; updated_at: string }
        Insert: { id?: string; faculty_id: string; name: string }
        Update: Partial<{ faculty_id: string; name: string }>
      }
      programmes: {
        Row: { id: string; department_id: string; name: string; code: string; created_at: string; updated_at: string }
        Insert: { id?: string; department_id: string; name: string; code: string }
        Update: Partial<{ name: string; code: string }>
      }
      qualification_types: {
        Row: { id: string; programme_id: string; name: string; code: string; created_at: string; updated_at: string }
        Insert: { id?: string; programme_id: string; name: string; code: string }
        Update: Partial<{ name: string; code: string }>
      }
      levels: {
        Row: { id: string; qualification_type_id: string; name: string; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; qualification_type_id: string; name: string; sort_order: number }
        Update: Partial<{ name: string; sort_order: number }>
      }
      academic_years: {
        Row: {
          id: string
          name: string
          year_code: string
          start_date: string
          end_date: string
          is_current: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['academic_years']['Row'], 'id' | 'is_current' | 'created_at' | 'updated_at'> & { id?: string; is_current?: boolean }
        Update: Partial<Pick<Database['public']['Tables']['academic_years']['Row'], 'name' | 'start_date' | 'end_date'>>
      }
      app_semesters: {
        Row: {
          id: string
          academic_year_id: string
          name: string
          start_date: string
          end_date: string
          status: SemesterStatus
          auto_open: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['app_semesters']['Row'], 'id' | 'status' | 'created_at' | 'updated_at'> & { id?: string; status?: SemesterStatus }
        Update: Partial<Pick<Database['public']['Tables']['app_semesters']['Row'], 'name' | 'start_date' | 'end_date' | 'auto_open'>>
      }
      groups: {
        Row: {
          id: string
          qualification_type_id: string
          level_id: string
          academic_year_id: string
          group_name: string
          is_archived: boolean
          archived_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['groups']['Row'], 'id' | 'is_archived' | 'archived_at' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Pick<Database['public']['Tables']['groups']['Row'], 'group_name' | 'is_archived' | 'archived_at'>>
      }
      groups_secrets: {
        Row: { group_id: string; default_password: string; updated_at: string }
        Insert: { group_id: string; default_password: string }
        Update: Partial<{ default_password: string }>
      }
      group_memberships: {
        Row: {
          id: string
          student_id: string
          group_id: string
          status: MembershipStatus
          is_course_rep: boolean
          joined_at: string
          exited_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['group_memberships']['Row'], 'id' | 'joined_at'> & { id?: string }
        Update: Partial<Pick<Database['public']['Tables']['group_memberships']['Row'], 'status' | 'is_course_rep' | 'exited_at'>>
      }
      courses: {
        Row: {
          id: string
          group_id: string
          semester_id: string
          name: string
          code: string
          credit_hours: number
          lecturer_id: string | null
          lecturer_assigned_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['courses']['Row'], 'id' | 'lecturer_assigned_at' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Pick<Database['public']['Tables']['courses']['Row'], 'name' | 'code' | 'credit_hours' | 'lecturer_id'>>
      }
      timetables: {
        Row: {
          id: string
          course_id: string
          group_id: string
          day_of_week: number
          start_time: string
          end_time: string
          venue: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['timetables']['Row'], 'id' | 'created_at'> & { id?: string }
        Update: Partial<Pick<Database['public']['Tables']['timetables']['Row'], 'day_of_week' | 'start_time' | 'end_time' | 'venue'>>
      }
      class_sessions: {
        Row: {
          id: string
          course_id: string
          semester_id: string
          timetable_id: string | null
          duration_minutes: number
          venue: string | null
          notes: string | null
          created_by: string | null
          started_at: string
          ended_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['class_sessions']['Row'], 'id' | 'started_at' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Pick<Database['public']['Tables']['class_sessions']['Row'], 'ended_at' | 'notes' | 'venue'>>
      }
      attendance: {
        Row: {
          id: string
          session_id: string
          student_id: string
          status: ArrivalStatus
          checked_in_at: string | null
          latitude: number | null
          longitude: number | null
          gps_accuracy: number | null
          geo_verified: boolean
          selfie_path: string | null
          device_token: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['attendance']['Row'], 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Pick<Database['public']['Tables']['attendance']['Row'], 'status'>>
      }
      attendance_disputes: {
        Row: {
          id: string
          attendance_id: string
          raised_by: string
          reason: string
          status: DisputeStatus
          resolved_by: string | null
          resolved_at: string | null
          resolution_note: string | null
          raised_at: string
        }
        Insert: Omit<Database['public']['Tables']['attendance_disputes']['Row'], 'id' | 'status' | 'resolved_by' | 'resolved_at' | 'resolution_note' | 'raised_at'> & { id?: string }
        Update: Partial<Pick<Database['public']['Tables']['attendance_disputes']['Row'], 'status' | 'resolved_by' | 'resolved_at' | 'resolution_note'>>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          session_id: string | null
          title: string
          body: string | null
          is_read: boolean
          is_dismissed: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'is_read' | 'is_dismissed' | 'created_at'> & { id?: string }
        Update: Partial<Pick<Database['public']['Tables']['notifications']['Row'], 'is_read' | 'is_dismissed'>>
      }
      audit_log: {
        Row: {
          id: string
          actor_id: string | null
          action: string
          table_name: string
          record_id: string | null
          old_data: Record<string, unknown> | null
          new_data: Record<string, unknown> | null
          created_at: string
        }
        Insert: never
        Update: never
      }
      system_settings: {
        Row: {
          key: string
          value: string
          description: string | null
          updated_by: string | null
          updated_at: string
        }
        Insert: never
        Update: Partial<Pick<Database['public']['Tables']['system_settings']['Row'], 'value'>>
      }
      course_lecturer_history: {
        Row: {
          id: string
          course_id: string
          lecturer_id: string
          assigned_at: string
          removed_at: string | null
        }
        Insert: never
        Update: never
      }
    }
    Functions: {
      open_academic_year: { Args: { year_id: string }; Returns: void }
      open_semester: { Args: { semester_id: string }; Returns: void }
      close_semester: { Args: { semester_id: string }; Returns: void }
      close_session: { Args: { session_id: string; force: boolean }; Returns: void }
      add_student_to_group: {
        Args: { p_group_id: string; p_serial: number; p_name?: string }
        Returns: { outcome: string; index_number: string; email: string }[]
      }
      promote_students_to_new_year: {
        Args: { source_year_id: string; target_year_id: string }
        Returns: { student_id: string; student_name: string; outcome: 'promoted' | 'completed' | 'error'; new_group_name: string | null; detail: string | null }[]
      }
    }
  }
}
