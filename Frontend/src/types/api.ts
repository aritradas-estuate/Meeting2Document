/**
 * API Types - Matches backend Pydantic schemas
 */

// ============================================================
// User & Auth Types
// ============================================================

export interface User {
  id: number;
  email: string;
  name: string;
  picture_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthResponse {
  user: User;
  token: TokenResponse;
}

export interface GoogleAuthURL {
  authorization_url: string;
}

// ============================================================
// Project Types
// ============================================================

export type ProjectStatus = 'ACTIVE' | 'PROCESSING' | 'COMPLETED' | 'ARCHIVED';

export interface DriveFolder {
  id: string;
  name: string;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  drive_folders: DriveFolder[] | null;
  schema_type: string;
  model_config: Record<string, unknown> | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
  drive_folders?: DriveFolder[];
  schema_type?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  drive_folders?: DriveFolder[];
  status?: ProjectStatus;
  model_config?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type JobListResponse = PaginatedResponse<ProcessingJob>;
export type DocumentListResponse = PaginatedResponse<Document>;

export interface ProjectListResponse {
  items: Project[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// ============================================================
// Job Types
// ============================================================

export type JobStatus =
  | 'PENDING'
  | 'DOWNLOADING'
  | 'EXTRACTING'
  | 'SYNTHESIZING'
  | 'GENERATING'
  | 'REVIEWING'
  | 'ASSEMBLING'
  | 'UPLOADING'
  | 'COMPLETED'
  | 'FAILED';

export interface VideoFile {
  id: string;
  name: string;
  mime_type: string;
  size: number | null;
}

export interface ProcessingJob {
  id: number;
  project_id: number;
  status: JobStatus;
  video_files: VideoFile[];
  supporting_files: VideoFile[] | null;
  current_stage: string | null;
  stage_progress: Record<string, unknown>;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobFileInput {
  id: string;
  name: string;
  mime_type: string;
  size?: number;
  web_view_link?: string;
}

export interface JobCreate {
  project_id: number;
  video_files: JobFileInput[];
  supporting_files?: JobFileInput[];
}

// ============================================================
// Document Types
// ============================================================

export type DocumentStatus = 'DRAFT' | 'GENERATING' | 'COMPLETE';
export type SectionStatus = 'PENDING' | 'GENERATING' | 'REVIEWING' | 'COMPLETE' | 'SKIPPED';

export interface Document {
  id: number;
  project_id: number;
  job_id: number | null;
  title: string;
  schema_type: string;
  content: Record<string, unknown> | null;
  markdown_content: string | null;
  drive_file_id: string | null;
  drive_file_url: string | null;
  version: number;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
}

export interface DocumentSection {
  id: number;
  document_id: number;
  section_id: string;
  section_title: string;
  content: string | null;
  status: SectionStatus;
  generation_history: unknown[];
  review_count: number;
  final_draft_number: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Google Drive Types
// ============================================================

export interface DriveItem {
  id: string;
  name: string;
  mime_type: string;
  size: number | null;
  created_time: string | null;
  modified_time: string | null;
  web_view_link: string | null;
  icon_link: string | null;
  thumbnail_link: string | null;
  parents: string[] | null;
  is_folder: boolean;
}

export interface SharedDrive {
  id: string;
  name: string;
  color_rgb: string | null;
  background_image_link: string | null;
}

export interface SharedDriveListResponse {
  drives: SharedDrive[];
  next_page_token: string | null;
}

export interface DriveListResponse {
  items: DriveItem[];
  next_page_token: string | null;
}

export interface DriveBreadcrumb {
  id: string;
  name: string;
}

export interface DriveNavigationResponse {
  items: DriveItem[];
  breadcrumbs: DriveBreadcrumb[];
  current_folder: DriveItem | null;
  next_page_token: string | null;
}

// ============================================================
// API Error Type
// ============================================================

export interface APIError {
  detail: string;
  code?: string;
}
