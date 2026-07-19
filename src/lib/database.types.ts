// ============================================================
// Supabase Database types — generated from 0001_schema.sql
// These mirror the actual DB schema. Update if schema changes.
// All Insert/Update types are written as explicit flat objects
// (no Omit/Pick self-references) to satisfy Vercel's strict TS.
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
        Insert: {
          id: string
          role: UserRole
          phone?: string | null
          is_active?: boolean
          must_change_password?: boolean
        }
        Update: {
          role?: UserRole
          phone?: string | null
          is_active?: boolean
          must_change_password?: boolean
        }
      }
      super_admins: {
        Row: { id: string; name: string }
        Insert: { id: string; name: string }
        Update: { name?: string }
      }
      students: {
        Row: {
          id: string
          name: string
          index_number: string
          photo_path: string | null
          created_at: string
        }
        Insert: {
          id: string
          name: string
          index_number: string
          photo_path?: string | null
        }
        Update: {
          name?: string
          photo_path?: string | null
        }
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
        Insert: {
          id: string
          name: string
          staff_id: string
          phone?: string | null
        }
        Update: {
          name?: string
          staff_id?: string
          phone?: string | null
        }
      }
      faculties: {
        Row: { id: string; name: string; created_at: string; updated_at: string }
        Insert: { id?: string; name: string }
        Update: { name?: string }
      }
      departments: {
        Row: { id: string; faculty_id: string; name: string; created_at: string; updated_at: string }
        Insert: { id?: string; faculty_id: string; name: string }
        Update: { faculty_id?: string; name?: string }
      }
      programmes: {
        Row: { id: string; department_id: string; name: string; code: string; created_at: string; updated_at: string }
        Insert: { id?: string; department_id: string; name: string; code: string }
        Update: { name?: string; code?: string }
      }
      qualification_types: {
        Row: { id: string; programme_id: string; name: string; code: string; created_at: string; updated_at: string }
        Insert: { id?: string; programme_id: string; name: string; code: string }
        Update: { name?: string; code?: string }
      }
      levels: {
        Row: { id: string; qualification_type_id: string; name: string; sort_order: number; created_at: string; updated_at: string }
        Insert: { id?: string; qualification_type_id: string; name: string; sort_order: number }
        Update: { name?: string; sort_order?: number }
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
        Insert: {
          id?: string
          name: string
          year_code: string
          start_date: string
          end_date: string
          is_current?: boolean
        }
        Update: {
          name?: string
          start_date?: string
          end_date?: string
        }
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
        Insert: {
          id?: string
          academic_year_id: string
          name: string
          start_date: string
          end_date: string
          status?: SemesterStatus
          auto_open: boolean
        }
        Update: {
          name?: string
          start_date?: string
          end_date?: string
          auto_open?: boolean
        }
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
        Insert: {
          id?: string
          qualification_type_id: string
          level_id: string
          academic_year_id: string
          group_name: string
        }
        Update: {
          group_name?: string
          is_archived?: boolean
          archived_at?: string | null
        }
      }
      groups_secrets: {
        Row: { group_id: string; default_password: string; updated_at: string }
        Insert: { group_id: string; default_password: string }
        Update: { default_password?: string }
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
        Insert: {
          id?: string
          student_id: string
          group_id: string
          status: MembershipStatus
          is_course_rep: boolean
          exited_at?: string | null
        }
        Update: {
          status?: MembershipStatus
          is_course_rep?: boolean
          exited_at?: string | null
        }
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
        Insert: {
          id?: string
          group_id: string
          semester_id: string
          name: string
          code: string
          credit_hours: number
          lecturer_id?: string | null
        }
        Update: {
          name?: string
          code?: string
          credit_hours?: number
          lecturer_id?: string | null
        }
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
        Insert: {
          id?: string
          course_id: string
          group_id: string
          day_of_week: number
          start_time: string
          end_time: string
          venue?: string | null
        }
        Update: {
          day_of_week?: number
          start_time?: string
          end_time?: string
          venue?: string | null
        }
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
        Insert: {
          id?: string
          course_id: string
          semester_id: string
          timetable_id?: string | null
          duration_minutes: number
          venue?: string | null
          notes?: string | null
          created_by?: string | null
        }
        Update: {
          ended_at?: string | null
          notes?: string | null
          venue?: string | null
        }
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
        Insert: {
          id?: string
          session_id: string
          student_id: string
          status: ArrivalStatus
          checked_in_at?: string | null
          latitude?: number | null
          longitude?: number | null
          gps_accuracy?: number | null
          geo_verified?: boolean
          selfie_path?: string | null
          device_token?: string | null
        }
        Update: {
          status?: ArrivalStatus
        }
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
        Insert: {
          id?: string
          attendance_id: string
          raised_by: string
          reason: string
        }
        Update: {
          status?: DisputeStatus
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
        }
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
        Insert: {
          id?: string
          user_id: string
          session_id?: string | null
          title: string
          body?: string | null
        }
        Update: {
          is_read?: boolean
          is_dismissed?: boolean
        }
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
        Update: { value?: string }
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
