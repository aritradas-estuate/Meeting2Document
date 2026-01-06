/**
 * API Client for MeetingsToDocument Backend
 */

import type {
  AuthResponse,
  GoogleAuthURL,
  User,
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectListResponse,
  ProcessingJob,
  JobWithResults,
  JobCreate,
  JobListResponse,
  Document,
  DocumentSection,
  DocumentListResponse,
  SharedDriveListResponse,
  DriveListResponse,
  DriveNavigationResponse,
  DriveItem,
  APIError,
} from '@/types/api';

// API Base URL - defaults to localhost:8000 for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: APIError
  ) {
    super(data?.detail || statusText);
    this.name = 'ApiError';
  }
}

const isBrowser = typeof window !== 'undefined';

function getToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem('auth_token');
}

export function setToken(token: string): void {
  if (!isBrowser) return;
  localStorage.setItem('auth_token', token);
}

export function clearToken(): void {
  if (!isBrowser) return;
  localStorage.removeItem('auth_token');
}

/**
 * Base fetch wrapper with auth and error handling
 */
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: APIError | undefined;
    try {
      errorData = await response.json();
    } catch {
      // Response might not be JSON
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================
// Auth API
// ============================================================

export const authApi = {
  /**
   * Get Google OAuth authorization URL
   */
  getGoogleAuthUrl: (redirectUri?: string): Promise<GoogleAuthURL> => {
    const params = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
    return apiFetch<GoogleAuthURL>(`/api/auth/google/url${params}`);
  },

  /**
   * Exchange Google OAuth code for tokens
   */
  googleCallback: (code: string, redirectUri?: string): Promise<AuthResponse> => {
    return apiFetch<AuthResponse>('/api/auth/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code, redirect_uri: redirectUri }),
    });
  },

  /**
   * Get current user info
   */
  me: (): Promise<User> => {
    return apiFetch<User>('/api/auth/me');
  },

  /**
   * Logout
   */
  logout: (): Promise<void> => {
    return apiFetch<void>('/api/auth/logout', { method: 'POST' });
  },
};

// ============================================================
// Projects API
// ============================================================

export const projectsApi = {
  list: (page = 1, pageSize = 20, status?: string | string[]): Promise<ProjectListResponse> => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (status) {
      const statusStr = Array.isArray(status) ? status.join(',') : status;
      params.set('status', statusStr.toLowerCase());
    }
    return apiFetch<ProjectListResponse>(`/api/projects?${params}`);
  },

  get: (id: number): Promise<Project> => {
    return apiFetch<Project>(`/api/projects/${id}`);
  },

  create: (data: ProjectCreate): Promise<Project> => {
    return apiFetch<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  update: (id: number, data: ProjectUpdate): Promise<Project> => {
    return apiFetch<Project>(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  archive: (id: number): Promise<void> => {
    return apiFetch<void>(`/api/projects/${id}`, { method: 'DELETE' });
  },

  restore: (id: number): Promise<Project> => {
    return apiFetch<Project>(`/api/projects/${id}/restore`, { method: 'POST' });
  },

  permanentDelete: (id: number): Promise<void> => {
    return apiFetch<void>(`/api/projects/${id}/permanent`, { method: 'DELETE' });
  },
};

// ============================================================
// Jobs API
// ============================================================

export const jobsApi = {
  list: (projectId: number, page = 1, size = 50): Promise<JobListResponse> => {
    return apiFetch<JobListResponse>(`/api/jobs?project_id=${projectId}&page=${page}&size=${size}`);
  },

  get: (id: number): Promise<ProcessingJob> => {
    return apiFetch<ProcessingJob>(`/api/jobs/${id}`);
  },

  getWithResults: (id: number): Promise<JobWithResults> => {
    return apiFetch<JobWithResults>(`/api/jobs/${id}`);
  },

  create: (data: JobCreate): Promise<ProcessingJob> => {
    return apiFetch<ProcessingJob>('/api/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Cancel a job
   */
  cancel: (id: number): Promise<void> => {
    return apiFetch<void>(`/api/jobs/${id}/cancel`, { method: 'POST' });
  },

  /**
   * Retry a failed job
   */
  retry: (id: number): Promise<ProcessingJob> => {
    return apiFetch<ProcessingJob>(`/api/jobs/${id}/retry`, { method: 'POST' });
  },
};

// ============================================================
// Documents API
// ============================================================

export const documentsApi = {
  list: (projectId: number, page = 1, size = 50): Promise<DocumentListResponse> => {
    return apiFetch<DocumentListResponse>(`/api/documents?project_id=${projectId}&page=${page}&size=${size}`);
  },

  /**
   * Get a single document
   */
  get: (id: number): Promise<Document> => {
    return apiFetch<Document>(`/api/documents/${id}`);
  },

  /**
   * Get document sections
   */
  getSections: (documentId: number): Promise<DocumentSection[]> => {
    return apiFetch<DocumentSection[]>(`/api/documents/${documentId}/sections`);
  },

  /**
   * Get document as markdown
   */
  getMarkdown: async (id: number): Promise<string> => {
    const token = getToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/api/documents/${id}/markdown`, {
      headers,
    });

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    return response.text();
  },

  /**
   * Upload document to Google Drive
   */
  uploadToDrive: (id: number, folderId?: string): Promise<Document> => {
    return apiFetch<Document>(`/api/documents/${id}/upload-to-drive`, {
      method: 'POST',
      body: JSON.stringify({ folder_id: folderId }),
    });
  },
};

// ============================================================
// Drive API
// ============================================================

export const driveApi = {
  /**
   * List shared drives
   */
  listSharedDrives: (pageToken?: string): Promise<SharedDriveListResponse> => {
    const params = pageToken ? `?page_token=${pageToken}` : '';
    return apiFetch<SharedDriveListResponse>(`/api/drive/shared-drives${params}`);
  },

  /**
   * List files in a folder
   */
  listFiles: (params: {
    folderId?: string;
    driveId?: string;
    query?: string;
    pageToken?: string;
  }): Promise<DriveListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.folderId) searchParams.set('folder_id', params.folderId);
    if (params.driveId) searchParams.set('drive_id', params.driveId);
    if (params.query) searchParams.set('query', params.query);
    if (params.pageToken) searchParams.set('page_token', params.pageToken);

    const qs = searchParams.toString();
    return apiFetch<DriveListResponse>(`/api/drive/files${qs ? `?${qs}` : ''}`);
  },

  /**
   * Navigate to a folder with breadcrumbs
   */
  navigate: (folderId: string, driveId?: string): Promise<DriveNavigationResponse> => {
    const params = driveId ? `?drive_id=${driveId}` : '';
    return apiFetch<DriveNavigationResponse>(`/api/drive/navigate/${folderId}${params}`);
  },

  /**
   * Get file info
   */
  getFile: (fileId: string, driveId?: string): Promise<DriveItem> => {
    const params = driveId ? `?drive_id=${driveId}` : '';
    return apiFetch<DriveItem>(`/api/drive/file/${fileId}${params}`);
  },
};

// ============================================================
// Health Check
// ============================================================

export const healthApi = {
  check: (): Promise<{ status: string; app: string }> => {
    return apiFetch<{ status: string; app: string }>('/health');
  },
};
