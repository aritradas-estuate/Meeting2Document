/**
 * Frontend Types
 * 
 * Types used by frontend components for Google Drive integration
 * and meeting extraction data display.
 */

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
  source?: "my_drive" | "shared_drive";
  driveId?: string;
}

export interface SharedDrive {
  id: string;
  name: string;
  color_rgb: string | null;
  background_image_link: string | null;
}

export interface DriveBreadcrumb {
  id: string;
  name: string;
}

// ============================================================
// Meeting Extraction Types
// ============================================================

export interface Utterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface MeetingExtraction {
  summary: string;
  decisions: Array<{ decision: string; made_by: string; context: string }>;
  action_items: Array<{ task: string; assigned_to: string; due_date: string | null; priority: string | null }>;
  key_points: Array<{ point: string; discussed_by: string[] }>;
  questions_raised: Array<{ question: string; asked_by: string; answered: boolean; answer: string | null }>;
  concerns: Array<{ concern: string; raised_by: string; resolution: string | null }>;
  topics_discussed: Array<{ topic: string; duration_estimate: string }>;
  follow_ups: Array<{ item: string; owner: string }>;
}

export type TranscriptStatus = "pending" | "transcribing" | "completed" | "failed";
export type ExtractionStatus = "pending" | "extracting" | "completed" | "failed";

export interface Transcript {
  _id: string;
  _creationTime: number;
  jobId: string;
  projectId: string;
  fileId: string;
  fileName: string;
  fileSize?: number;
  status: TranscriptStatus;
  assemblyAiTranscriptId?: string;
  publicUrl?: string;
  text?: string;
  utterances?: Utterance[];
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

export interface KeyIdea {
  _id: string;
  _creationTime: number;
  jobId: string;
  projectId: string;
  transcriptId: string;
  fileId: string;
  fileName: string;
  status: ExtractionStatus;
  extraction?: MeetingExtraction;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}
