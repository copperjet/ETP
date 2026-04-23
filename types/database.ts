export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'ap' | 'sick';
export type UserRole = 'admin' | 'super_admin' | 'hrt' | 'st' | 'finance' | 'frontdesk' | 'parent';
export type ReportStatus = 'draft' | 'pending_approval' | 'approved' | 'finance_pending' | 'released';
export type SubscriptionPlan = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface School {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  country: string | null;
  timezone: string | null;
  currency: string | null;
  subscription_plan: SubscriptionPlan;
  subscription_status: string;
  created_at: string;
}

export interface Student {
  id: string;
  school_id: string;
  student_number: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  photo_url: string | null;
  section_id: string | null;
  grade_id: string | null;
  stream_id: string | null;
  enrollment_date: string | null;
  status: string;
  created_at: string;
}

export interface Staff {
  id: string;
  school_id: string;
  auth_user_id: string | null;
  full_name: string;
  staff_number: string;
  email: string;
  department: string | null;
  photo_url: string | null;
  status: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  school_id: string;
  student_id: string;
  stream_id: string;
  semester_id: string;
  date: string;
  status: AttendanceStatus;
  submitted_by: string;
  is_locked: boolean;
  admin_override: boolean;
  created_at: string;
  updated_at: string;
}

export interface Mark {
  id: string;
  school_id: string;
  student_id: string;
  subject_id: string;
  stream_id: string;
  semester_id: string;
  assessment_type: string;
  value: number | null;
  is_na: boolean;
  entered_by: string;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  school_id: string;
  student_id: string;
  semester_id: string;
  status: ReportStatus;
  hrt_comment: string | null;
  overall_percentage: number | null;
  class_position: number | null;
  pdf_url: string | null;
  approved_by: string | null;
  approved_at: string | null;
  released_at: string | null;
  finance_cleared_by: string | null;
  finance_cleared_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DayBookEntry {
  id: string;
  school_id: string;
  student_id: string;
  date: string;
  category: string;
  description: string;
  created_by: string;
  send_to_parent: boolean;
  edit_window_closes_at: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      schools: { Row: School; Insert: Partial<School>; Update: Partial<School> };
      students: { Row: Student; Insert: Partial<Student>; Update: Partial<Student> };
      staff: { Row: Staff; Insert: Partial<Staff>; Update: Partial<Staff> };
      attendance_records: { Row: AttendanceRecord; Insert: Partial<AttendanceRecord>; Update: Partial<AttendanceRecord> };
      marks: { Row: Mark; Insert: Partial<Mark>; Update: Partial<Mark> };
      reports: { Row: Report; Insert: Partial<Report>; Update: Partial<Report> };
      day_book_entries: { Row: DayBookEntry; Insert: Partial<DayBookEntry>; Update: Partial<DayBookEntry> };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}
