// Auto-generated types would come from `supabase gen types typescript`.
// This file defines them manually for Phase 1 to keep the workflow simple.
// Replace with generated types once the Supabase CLI is configured.

export type Role = 'admin' | 'office' | 'project_manager' | 'worker' | 'client'

export type AssignmentRole = 'project_manager' | 'worker' | 'client' | 'office_viewer'

export type ProjectStatus = 'planning' | 'in_progress' | 'finishing' | 'inspection' | 'completed'

export type MediaCategory =
  | 'before'
  | 'progress'
  | 'after'
  | 'final_result'
  | 'contract'
  | 'invoice'
  | 'budget'
  | 'plan'
  | 'other'
  | 'live_photo'

export type ImportType = 'projects' | 'budgets' | 'financials' | 'clients'

export type PhaseName =
  | 'progress'
  | 'demo'
  | 'foundation'
  | 'underground_plumbing'
  | 'framing'
  | 'plumbing'
  | 'electric'
  | 'windows'
  | 'black_paper'
  | 'ac'
  | 'insulation'
  | 'dry_wall'
  | 'tapping'
  | 'paint'
  | 'floor'
  | 'hot_mop'
  | 'tile'
  | 'kitchen_installation'
  | 'finish_materials_install'

export type PhaseStatus = 'not_started' | 'in_progress' | 'completed'

export const PHASE_ORDER: PhaseName[] = [
  'progress',
  'demo',
  'foundation',
  'underground_plumbing',
  'framing',
  'plumbing',
  'electric',
  'windows',
  'black_paper',
  'ac',
  'insulation',
  'dry_wall',
  'tapping',
  'paint',
  'floor',
  'hot_mop',
  'tile',
  'kitchen_installation',
  'finish_materials_install',
]

export const PHASE_LABELS: Record<PhaseName, string> = {
  progress:               'Progress',
  demo:                   'Demo',
  foundation:             'Foundation',
  underground_plumbing:   'Under Ground Plumbing',
  framing:                'Framing',
  plumbing:               'Plumbing',
  electric:               'Electric',
  windows:                'Windows',
  black_paper:            'Black Paper',
  ac:                     'AC',
  insulation:             'Insulation',
  dry_wall:               'Dry Wall',
  tapping:                'Tapping',
  paint:                  'Paint',
  floor:                  'Floor',
  hot_mop:                'Hot Mop',
  tile:                   'Tile',
  kitchen_installation:   'Kitchen Installation',
  finish_materials_install: 'Finish Materials Install',
}

export interface ConstructionPhase {
  id: string
  project_id: string
  phase_name: PhaseName
  status: PhaseStatus
  notes: string | null
  start_date: string | null
  end_date: string | null
  updated_by: string | null
  updated_at: string
}

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Profile {
  id: string
  full_name: string
  role: Role
  avatar_url: string | null
  created_at: string
}

export interface Project {
  id: string
  project_code: string
  name: string
  address: string | null
  status: ProjectStatus
  start_date: string | null
  estimated_end_date: string | null
  actual_end_date: string | null
  budget_total: number | null
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectAssignment {
  id: string
  project_id: string
  user_id: string
  assignment_role: AssignmentRole
  assigned_at: string
}

export interface MediaFile {
  id: string
  project_id: string
  uploaded_by: string
  file_path: string
  file_name: string
  file_type: string
  file_size: number | null
  category: MediaCategory
  description: string | null
  reviewed: boolean
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

export interface ImportLog {
  id: string
  uploaded_by: string
  source_file_name: string
  source_file_path: string | null
  import_type: ImportType
  total_rows: number
  successful_rows: number
  failed_rows: number
  status: ImportStatus
  errors_json: unknown | null
  created_at: string
}

export interface ProjectSection {
  id: string
  project_id: string
  name: string
  display_order: number
  created_at: string
  updated_at: string
}

export interface ProjectItem {
  id: string
  project_id: string
  section_id: string
  category: string | null
  worker: string | null
  material: string | null
  quantity: number | null
  raw_quantity: string | null
  unit: string | null
  unit_price: number | null
  total_price: number | null
  vendor: string | null
  status: string | null
  notes: string | null
  display_order: number
  created_at: string
  updated_at: string
}

// Returns the effective total for a line item.
// Uses stored total_price if present; falls back to quantity * unit_price.
export function getItemTotal(item: Pick<ProjectItem, 'total_price' | 'quantity' | 'unit_price'>): number | null {
  if (item.total_price != null) return item.total_price
  if (item.quantity != null && item.unit_price != null) return item.quantity * item.unit_price
  return null
}

export interface ProjectImportRun {
  id: string
  project_id: string
  imported_by: string
  source_file_name: string
  source_file_path: string | null
  total_rows_found: number
  sections_created: number
  items_created: number
  total_rows_skipped: number
  empty_rows_skipped: number
  parse_warnings: { row_number: number; message: string }[] | null
  status: 'completed' | 'failed_partial' | 'failed'
  created_at: string
}

// Section with its items — used throughout the project detail UI
export interface SectionWithItems extends ProjectSection {
  project_items: ProjectItem[]
}

// Joined types used in UI
export interface ProjectWithAssignments extends Project {
  project_assignments: (ProjectAssignment & { profiles: Profile })[]
}

export interface AssignmentWithProfile extends ProjectAssignment {
  profiles: Profile
}

export type NotificationType =
  | 'photo_uploaded'
  | 'status_changed'
  | 'phase_updated'
  | 'item_added'
  | 'budget_updated'
  | 'new_message'
  | 'project_chat'

export interface Notification {
  id: string
  user_id: string
  project_id: string | null
  type: NotificationType
  message: string
  is_read: boolean
  created_at: string
}

export type ActivityAction =
  | 'project_created'
  | 'project_updated'
  | 'project_deleted'
  | 'status_changed'
  | 'phase_updated'
  | 'media_uploaded'
  | 'media_deleted'
  | 'photo_reviewed'
  | 'item_added'
  | 'member_added'
  | 'member_removed'
  | 'import_completed'

export interface ActivityLog {
  id: string
  project_id: string | null
  user_id: string | null
  action: ActivityAction
  entity_type: string | null
  entity_id: string | null
  description: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface ActivityLogWithProfile extends ActivityLog {
  profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
  projects: Pick<Project, 'id' | 'project_code' | 'name'> | null
}

// ── Messaging ─────────────────────────────────────────────────────────

export interface Message {
  id:              string
  conversation_id: string
  sender_id:       string
  body:            string
  created_at:      string
  attachment_path: string | null
  attachment_name: string | null
  attachment_type: string | null
  attachment_size: number | null
}

export interface MessageWithSender extends Message {
  sender: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

export interface ConversationSummary {
  id:          string
  updatedAt:   string
  otherUser:   Pick<Profile, 'id' | 'full_name' | 'avatar_url' | 'role'> | null
  lastMessage: { body: string; created_at: string; sender_id: string } | null
  unreadCount: number
}

export interface ProjectConversation {
  projectId:   string
  projectCode: string
  projectName: string
  lastMessage: { body: string; created_at: string; sender_id: string | null } | null
  unreadCount: number
}

// ── Project Chat ──────────────────────────────────────────────

export type ChatMessageType = 'user' | 'system'

export interface ProjectChatMessage {
  id:              string
  project_id:      string
  sender_id:       string | null   // null for system messages
  body:            string
  created_at:      string
  message_type:    ChatMessageType
  system_event:    string | null
  attachment_path: string | null
  attachment_name: string | null
  attachment_type: string | null
  attachment_size: number | null
}

export interface ProjectChatMessageWithSender extends ProjectChatMessage {
  sender: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
}

// ── Live photos ───────────────────────────────────────────────────────

export interface LivePhotoWithUploader extends MediaFile {
  profiles: Pick<Profile, 'id' | 'full_name' | 'avatar_url'> | null
  reviewer_profile: Pick<Profile, 'id' | 'full_name'> | null
}

// Supabase Database shape (used for typed client)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      projects: {
        Row: Project
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Project, 'id' | 'created_at'>>
      }
      project_assignments: {
        Row: ProjectAssignment
        Insert: Omit<ProjectAssignment, 'id' | 'assigned_at'>
        Update: Partial<Omit<ProjectAssignment, 'id' | 'assigned_at'>>
      }
      media_files: {
        Row: MediaFile
        Insert: Omit<MediaFile, 'id' | 'created_at'>
        Update: Partial<Omit<MediaFile, 'id' | 'created_at'>>
      }
      import_logs: {
        Row: ImportLog
        Insert: Omit<ImportLog, 'id' | 'created_at'>
        Update: Partial<Omit<ImportLog, 'id' | 'created_at'>>
      }
    }
    Functions: {
      is_assigned_to_project: {
        Args: { p_id: string }
        Returns: boolean
      }
      get_my_role: {
        Args: Record<string, never>
        Returns: Role
      }
    }
  }
}
