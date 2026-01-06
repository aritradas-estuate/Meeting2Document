import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth";
import { projectsApi, jobsApi, documentsApi, driveApi } from "@/lib/api";
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal";
import { DriveBrowser } from "@/components/drive/DriveBrowser";
import type { Project, ProcessingJob, JobWithResults, Document, DriveItem, Utterance, MeetingExtraction } from "@/types/api";
import {
  ArrowLeft,
  Folder,
  Clock,
  FileText,
  Play,
  SpinnerGap,
  Warning,
  CheckCircle,
  XCircle,
  File,
  ArrowClockwise,
  Trash,
  DownloadSimple,
  GoogleDriveLogo,
  Archive,
  ArrowCounterClockwise,
  CaretRight,
  CaretDown,
  Plus,
  X,
  Video,
  CheckSquare,
  Square,
  Eye,
} from "@phosphor-icons/react";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectDetail,
});

function ExtractionView({ data }: { data: MeetingExtraction }) {
  return (
    <div className="space-y-6">
      {data.summary && (
        <section>
          <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" weight="duotone" />
            Summary
          </h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted p-4 rounded-lg">
            {data.summary}
          </p>
        </section>
      )}

      {data.decisions && data.decisions.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" weight="duotone" />
            Decisions ({data.decisions.length})
          </h3>
          <div className="space-y-2">
            {data.decisions.map((d, i) => (
              <div key={i} className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20">
                <p className="font-medium text-sm">{d.decision}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Made by: {d.made_by} {d.context && `• ${d.context}`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.action_items && data.action_items.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-purple-500" weight="duotone" />
            Action Items ({data.action_items.length})
          </h3>
          <div className="space-y-2">
            {data.action_items.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                <Badge variant={a.priority === 'high' ? 'destructive' : a.priority === 'medium' ? 'default' : 'secondary'} className="shrink-0">
                  {a.priority || 'medium'}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.task}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assigned to: {a.assigned_to}
                    {a.due_date && ` • Due: ${a.due_date}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.concerns && data.concerns.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Warning className="h-5 w-5 text-yellow-500" weight="duotone" />
            Concerns ({data.concerns.length})
          </h3>
          <div className="space-y-2">
            {data.concerns.map((c, i) => (
              <div key={i} className="p-3 border-l-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 rounded-r-lg">
                <p className="text-sm font-medium">{c.concern}</p>
                <p className="text-xs text-muted-foreground mt-1">Raised by: {c.raised_by}</p>
                {c.resolution && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Resolution: {c.resolution}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {data.key_points && data.key_points.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <CaretRight className="h-5 w-5 text-blue-500" weight="bold" />
            Key Points ({data.key_points.length})
          </h3>
          <div className="space-y-2">
            {data.key_points.map((k, i) => (
              <div key={i} className="p-3 border rounded-lg">
                <p className="text-sm">{k.point}</p>
                {k.discussed_by && k.discussed_by.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Discussed by: {k.discussed_by.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {data.questions_raised && data.questions_raised.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="text-lg">❓</span>
            Questions Raised ({data.questions_raised.length})
          </h3>
          <div className="space-y-2">
            {data.questions_raised.map((q, i) => (
              <div key={i} className="p-3 border rounded-lg">
                <div className="flex items-start gap-2">
                  <Badge variant={q.answered ? 'default' : 'outline'} className="shrink-0">
                    {q.answered ? 'Answered' : 'Unanswered'}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{q.question}</p>
                    <p className="text-xs text-muted-foreground mt-1">Asked by: {q.asked_by}</p>
                    {q.answer && (
                      <p className="text-sm mt-2 p-2 bg-muted rounded">
                        <span className="font-medium">Answer:</span> {q.answer}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.follow_ups && data.follow_ups.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ArrowClockwise className="h-5 w-5 text-orange-500" weight="duotone" />
            Follow-ups ({data.follow_ups.length})
          </h3>
          <div className="space-y-2">
            {data.follow_ups.map((f, i) => (
              <div key={i} className="p-3 border rounded-lg flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <div>
                  <p className="text-sm">{f.item}</p>
                  <p className="text-xs text-muted-foreground mt-1">Owner: {f.owner}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.topics_discussed && data.topics_discussed.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Folder className="h-5 w-5 text-gray-500" weight="duotone" />
            Topics Discussed ({data.topics_discussed.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.topics_discussed.map((t, i) => (
              <Badge key={i} variant="outline" className="py-1 px-3">
                {t.topic}
                {t.duration_estimate && t.duration_estimate !== 'Unknown' && (
                  <span className="ml-1 text-muted-foreground">({t.duration_estimate})</span>
                )}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const navigate = useNavigate();
  const { isAuthenticated, checkAuth } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderFiles, setFolderFiles] = useState<Record<string, DriveItem[]>>({});
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<DriveItem[]>([]);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [isStartingProcessing, setIsStartingProcessing] = useState(false);
  const [viewingJobResults, setViewingJobResults] = useState<JobWithResults | null>(null);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [completedJobResults, setCompletedJobResults] = useState<JobWithResults[]>([]);
  const [viewingContent, setViewingContent] = useState<{
    type: 'transcript' | 'extraction';
    fileName: string;
    content: string;
    utterances?: Utterance[];
    extractionData?: MeetingExtraction;
  } | null>(null);

  const projectIdNum = parseInt(projectId, 10);
  const isArchived = project?.status?.toUpperCase() === "ARCHIVED";

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  // Load project data
  const loadProject = useCallback(async () => {
    if (!isAuthenticated || isNaN(projectIdNum)) return;

    setIsLoading(true);
    setError(null);

    try {
      const [projectData, jobsResponse, docsResponse] = await Promise.all([
        projectsApi.get(projectIdNum),
        jobsApi.list(projectIdNum),
        documentsApi.list(projectIdNum),
      ]);

      setProject(projectData);
      setJobs(jobsResponse.items);
      setDocuments(docsResponse.items);

      try {
        const completedJobs = jobsResponse.items.filter(j => j.status?.toUpperCase() === "COMPLETED");
        if (completedJobs.length > 0) {
          const resultsPromises = completedJobs.map(j => jobsApi.getWithResults(j.id));
          const results = await Promise.all(resultsPromises);
          setCompletedJobResults(results);
        } else {
          setCompletedJobResults([]);
        }
      } catch (resultsErr) {
        console.error("Failed to load extraction results:", resultsErr);
        setCompletedJobResults([]);
      }
    } catch (err) {
      console.error("Failed to load project data:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Error details:", { projectId: projectIdNum, errorMessage, err });
      setError(`Failed to load project: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, projectIdNum]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  const handleArchive = async () => {
    if (!project) return;
    setIsArchiving(true);
    try {
      await projectsApi.archive(project.id);
      navigate({ to: "/dashboard", search: { tab: "ARCHIVED" } });
    } catch (err) {
      console.error("Failed to archive project:", err);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleRestore = async () => {
    if (!project) return;
    setIsRestoring(true);
    try {
      const restored = await projectsApi.restore(project.id);
      setProject(restored);
    } catch (err) {
      console.error("Failed to restore project:", err);
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    if (!project) return;
    const wasArchived = isArchived;
    setIsDeleting(true);
    try {
      await projectsApi.permanentDelete(project.id);
      navigate({ to: "/dashboard", search: wasArchived ? { tab: "ARCHIVED" } : {} });
    } catch (err) {
      console.error("Failed to delete project:", err);
      setIsDeleting(false);
    }
  };

  const loadFolderFiles = useCallback(async (folderId: string) => {
    setLoadingFolders(prev => new Set(prev).add(folderId));
    try {
      const response = await driveApi.navigate(folderId);
      setFolderFiles(prev => ({ ...prev, [folderId]: response.items }));
    } catch (err) {
      console.error("Failed to load folder files:", err);
    } finally {
      setLoadingFolders(prev => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
  }, []);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
      if (!folderFiles[folderId]) {
        loadFolderFiles(folderId);
      }
    }
    setExpandedFolders(newExpanded);
  };

  const toggleFileSelection = (file: DriveItem) => {
    if (selectedFiles.some(f => f.id === file.id)) {
      setSelectedFiles(selectedFiles.filter(f => f.id !== file.id));
    } else {
      setSelectedFiles([...selectedFiles, file]);
    }
  };

  const selectAllVideosInFolder = (folderId: string) => {
    const files = folderFiles[folderId]?.filter(f => !f.is_folder && f.mime_type.includes("video")) || [];
    const newSelected = [...selectedFiles];
    files.forEach(file => {
      if (!newSelected.some(f => f.id === file.id)) {
        newSelected.push(file);
      }
    });
    setSelectedFiles(newSelected);
  };

  const deselectAllInFolder = (folderId: string) => {
    const folderFileIds = new Set(folderFiles[folderId]?.map(f => f.id) || []);
    setSelectedFiles(selectedFiles.filter(f => !folderFileIds.has(f.id)));
  };

  const handleAddFolder = async (folder: DriveItem) => {
    if (!project) return;
    const existingFolders = project.drive_folders || [];
    if (existingFolders.some(f => f.id === folder.id)) {
      setShowAddFolder(false);
      return;
    }
    const newFolders = [...existingFolders, { id: folder.id, name: folder.name }];
    try {
      const updated = await projectsApi.update(project.id, { drive_folders: newFolders });
      setProject(updated);
      setShowAddFolder(false);
    } catch (err) {
      console.error("Failed to add folder:", err);
    }
  };

  const handleRemoveFolder = async (folderId: string) => {
    if (!project) return;
    const newFolders = (project.drive_folders || []).filter(f => f.id !== folderId);
    try {
      const updated = await projectsApi.update(project.id, { drive_folders: newFolders });
      setProject(updated);
      setSelectedFiles(selectedFiles.filter(f => !f.parents?.includes(folderId)));
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    } catch (err) {
      console.error("Failed to remove folder:", err);
    }
  };

  const handleStartProcessing = async () => {
    if (!project) return;
    const videoFiles = selectedFiles.filter(f => f.mime_type.includes("video"));
    if (videoFiles.length === 0) return;

    setIsStartingProcessing(true);
    try {
      await jobsApi.create({
        project_id: project.id,
        video_files: videoFiles.map(f => ({
          id: f.id,
          name: f.name,
          mime_type: f.mime_type,
          size: f.size || undefined,
          web_view_link: f.web_view_link || undefined,
        })),
      });
      await loadProject();
      setSelectedFiles([]);
    } catch (err) {
      console.error("Failed to start processing:", err);
    } finally {
      setIsStartingProcessing(false);
    }
  };

  const handleViewResults = async (jobId: number) => {
    setIsLoadingResults(true);
    try {
      const jobWithResults = await jobsApi.getWithResults(jobId);
      setViewingJobResults(jobWithResults);
    } catch (err) {
      console.error("Failed to load job results:", err);
    } finally {
      setIsLoadingResults(false);
    }
  };

  const downloadTranscript = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExtraction = (fileName: string, content: Record<string, unknown>) => {
    const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\.[^/.]+$/, "")}_key_ideas.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFileIcon = (file: DriveItem) => {
    if (file.is_folder) {
      return <Folder className="h-4 w-4 text-blue-500" weight="duotone" />;
    }
    if (file.mime_type.includes("video")) {
      return <Video className="h-4 w-4 text-purple-500" weight="duotone" />;
    }
    return <File className="h-4 w-4 text-gray-500" weight="duotone" />;
  };

  const videoFileCount = selectedFiles.filter(f => f.mime_type.includes("video")).length;

  // Get job status badge (handles both uppercase and lowercase status values)
  const getJobStatusBadge = (status: ProcessingJob["status"]) => {
    const normalizedStatus = status?.toUpperCase();
    switch (normalizedStatus) {
      case "PENDING":
        return <Badge variant="outline">Pending</Badge>;
      case "DOWNLOADING":
      case "EXTRACTING":
      case "SYNTHESIZING":
      case "GENERATING":
      case "REVIEWING":
      case "ASSEMBLING":
      case "UPLOADING":
        return (
          <Badge className="bg-blue-500">
            <SpinnerGap className="h-3 w-3 mr-1 animate-spin" />
            {normalizedStatus.charAt(0) + normalizedStatus.slice(1).toLowerCase()}
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "FAILED":
        return (
          <Badge className="bg-destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Get document status badge
  const getDocStatusBadge = (status: Document["status"]) => {
    switch (status) {
      case "DRAFT":
        return <Badge variant="outline">Draft</Badge>;
      case "GENERATING":
        return (
          <Badge className="bg-blue-500">
            <SpinnerGap className="h-3 w-3 mr-1 animate-spin" />
            Generating
          </Badge>
        );
      case "COMPLETE":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (!isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <SpinnerGap className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-3 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/dashboard" })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12">
          <Card className="text-center py-12">
            <CardContent>
              <Warning className="h-16 w-16 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {error || "Project not found"}
              </h3>
              <p className="text-muted-foreground mb-4">
                The project you're looking for doesn't exist or you don't have
                access.
              </p>
              <Link to="/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/dashboard", search: isArchived ? { tab: "ARCHIVED" } : {} })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" weight="duotone" />
              <span className="text-lg font-bold">{project.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={loadProject}>
              <ArrowClockwise className="h-4 w-4" />
            </Button>
            {isArchived ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestore}
                  disabled={isRestoring}
                >
                  <ArrowCounterClockwise className="h-4 w-4 mr-2" />
                  {isRestoring ? "Restoring..." : "Restore"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete Forever
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  disabled={isArchiving}
                >
                  <Archive className="h-4 w-4 mr-2" />
                  {isArchiving ? "Archiving..." : "Archive"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete Forever
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {isArchived && (
        <div className="bg-muted border-b">
          <div className="container mx-auto px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Archive className="h-4 w-4" />
            <span>This project is archived. You can view its contents but cannot start new processing.</span>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{project.name}</CardTitle>
                {project.description && (
                  <CardDescription className="mt-1">
                    {project.description}
                  </CardDescription>
                )}
              </div>
              <Badge
                variant={
                  project.status === "COMPLETED" ? "default" : "secondary"
                }
              >
                {project.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              {project.drive_folders && project.drive_folders.length > 0 && (
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  <span>{project.drive_folders.length} folder{project.drive_folders.length > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  Created {new Date(project.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <File className="h-4 w-4" />
                <span>Schema: {project.schema_type}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isArchived && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Source Folders</CardTitle>
                  <CardDescription>Select video files from these folders to process</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAddFolder(!showAddFolder)}>
                  {showAddFolder ? (
                    <>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Folder
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {showAddFolder && (
                <div className="p-4 border rounded-lg bg-muted/30">
                  <DriveBrowser
                    onSelect={handleAddFolder}
                    onSelectCurrentFolder={handleAddFolder}
                    showOnlyFolders={false}
                    selectFoldersOnly={true}
                  />
                </div>
              )}

              {(!project.drive_folders || project.drive_folders.length === 0) && !showAddFolder ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No folders added yet</p>
                  <p className="text-sm mt-1">Add a folder to select files for processing</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {project.drive_folders?.map((folder) => {
                    const isExpanded = expandedFolders.has(folder.id);
                    const isLoadingFolder = loadingFolders.has(folder.id);
                    const files = folderFiles[folder.id] || [];
                    const videoFiles = files.filter(f => f.mime_type.includes("video"));
                    const selectedInFolder = files.filter(f => selectedFiles.some(sf => sf.id === f.id));

                    return (
                      <div key={folder.id} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 p-3 bg-muted/30">
                          <button
                            onClick={() => toggleFolder(folder.id)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {isExpanded ? (
                              <CaretDown className="h-4 w-4" />
                            ) : (
                              <CaretRight className="h-4 w-4" />
                            )}
                          </button>
                          <Folder className="h-5 w-5 text-primary" weight="duotone" />
                          <span className="font-medium flex-1">{folder.name}</span>
                          {isExpanded && videoFiles.length > 0 && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                if (selectedInFolder.length === videoFiles.length) {
                                  deselectAllInFolder(folder.id);
                                } else {
                                  selectAllVideosInFolder(folder.id);
                                }
                              }}
                            >
                              {selectedInFolder.length === videoFiles.length ? "Deselect All" : "Select All Videos"}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => handleRemoveFolder(folder.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {isExpanded && (
                          <div className="border-t">
                            {isLoadingFolder ? (
                              <div className="flex items-center justify-center py-8">
                                <SpinnerGap className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            ) : files.length === 0 ? (
                              <div className="text-center py-6 text-muted-foreground text-sm">
                                This folder is empty
                              </div>
                            ) : (
                              <div className="divide-y max-h-64 overflow-y-auto">
                                {files.map((file) => {
                                  const isSelected = selectedFiles.some(f => f.id === file.id);
                                  const isVideo = file.mime_type.includes("video");

                                  return (
                                    <div
                                      key={file.id}
                                      className={`flex items-center gap-3 px-4 py-2 ${
                                        isVideo ? "hover:bg-muted/50 cursor-pointer" : "opacity-60"
                                      } ${isSelected ? "bg-primary/10" : ""}`}
                                      onClick={() => isVideo && toggleFileSelection(file)}
                                    >
                                      {isVideo ? (
                                        isSelected ? (
                                          <CheckSquare className="h-4 w-4 text-primary" weight="fill" />
                                        ) : (
                                          <Square className="h-4 w-4 text-muted-foreground" />
                                        )
                                      ) : (
                                        <div className="w-4" />
                                      )}
                                      {getFileIcon(file)}
                                      <span className="flex-1 text-sm truncate">{file.name}</span>
                                      {!file.is_folder && file.size && (
                                        <span className="text-xs text-muted-foreground">
                                          {(file.size / 1024 / 1024).toFixed(1)} MB
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {(project.drive_folders?.length ?? 0) > 0 && (
                <div className="flex items-center gap-4 pt-4 border-t">
                  <Button
                    onClick={handleStartProcessing}
                    disabled={videoFileCount === 0 || isStartingProcessing}
                  >
                    {isStartingProcessing ? (
                      <>
                        <SpinnerGap className="h-4 w-4 mr-2 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        {videoFileCount === 0
                          ? "Select videos to process"
                          : `Process ${videoFileCount} video${videoFileCount > 1 ? "s" : ""}`}
                      </>
                    )}
                  </Button>
                  {selectedFiles.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])}>
                      Clear Selection
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Jobs Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Processing Jobs</h2>
          {jobs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <SpinnerGap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No processing jobs yet. Start processing to generate
                  documents.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <Card key={job.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Job #{job.id}
                      </CardTitle>
                      {getJobStatusBadge(job.status)}
                    </div>
                    <CardDescription>
                      {job.video_files.length} video file
                      {job.video_files.length !== 1 ? "s" : ""}
                      {job.supporting_files && job.supporting_files.length > 0
                        ? ` + ${job.supporting_files.length} supporting files`
                        : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {job.current_stage && (
                        <div className="flex items-center gap-2">
                          <SpinnerGap className="h-4 w-4 animate-spin" />
                          <span>Stage: {job.current_stage}</span>
                        </div>
                      )}
                      {job.started_at && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            Started:{" "}
                            {new Date(job.started_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {job.completed_at && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>
                            Completed:{" "}
                            {new Date(job.completed_at).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {job.error_message && (
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="h-4 w-4" />
                          <span>{job.error_message}</span>
                        </div>
                      )}
                    </div>

                    {/* Video files list */}
                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground mb-2">
                        Files:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {job.video_files.map((file) => (
                          <Badge key={file.id} variant="outline">
                            {file.name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Job actions */}
                    <div className="mt-4 flex gap-2">
                      {job.status?.toUpperCase() === "COMPLETED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewResults(job.id)}
                          disabled={isLoadingResults}
                        >
                          {isLoadingResults ? (
                            <SpinnerGap className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4 mr-2" />
                          )}
                          View Results
                        </Button>
                      )}
                      {job.status?.toUpperCase() === "FAILED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await jobsApi.retry(job.id);
                              loadProject();
                            } catch (err) {
                              console.error("Failed to retry job:", err);
                            }
                          }}
                        >
                          <ArrowClockwise className="h-4 w-4 mr-2" />
                          Retry
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Extractions</h2>
          {completedJobResults.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No extractions yet. Complete a processing job to see transcripts and key ideas here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedJobResults.map((jobResult) =>
                jobResult.extraction_result?.files
                  .filter((file) => file.status === "completed")
                  .map((file) => (
                    <div key={`${jobResult.id}-${file.file_id}`} className="space-y-3">
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-blue-500" weight="duotone" />
                              <div>
                                <CardTitle className="text-base">Transcript</CardTitle>
                                <CardDescription className="text-xs">
                                  {file.file_name} · Job #{jobResult.id}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingContent({
                                  type: 'transcript',
                                  fileName: file.file_name,
                                  content: file.transcription?.text || "No transcript available",
                                  utterances: file.transcription?.utterances
                                })}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadTranscript(file.file_name, file.transcription?.text || "")}
                                disabled={!file.transcription?.text}
                              >
                                <DownloadSimple className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>

                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="h-5 w-5 text-purple-500" weight="duotone" />
                              <div>
                                <CardTitle className="text-base">Key Ideas Extracted</CardTitle>
                                <CardDescription className="text-xs">
                                  {file.file_name} · Job #{jobResult.id}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setViewingContent({
                                  type: 'extraction',
                                  fileName: file.file_name,
                                  content: JSON.stringify(file.extraction || {}, null, 2),
                                  extractionData: file.extraction
                                })}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadExtraction(file.file_name, file.extraction || {})}
                                disabled={!file.extraction}
                              >
                                <DownloadSimple className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    </div>
                  ))
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Documents</h2>
          {documents.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No documents generated yet. Complete a processing job to see
                  documents here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {documents.map((doc) => (
                <Card key={doc.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{doc.title}</CardTitle>
                      {getDocStatusBadge(doc.status)}
                    </div>
                    <CardDescription>
                      Version {doc.version} · {doc.schema_type}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {doc.drive_file_url && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={doc.drive_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <GoogleDriveLogo className="h-4 w-4 mr-2" />
                            Open in Drive
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            const markdown = await documentsApi.getMarkdown(
                              doc.id
                            );
                            const blob = new Blob([markdown], {
                              type: "text/markdown",
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${doc.title}.md`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            console.error("Failed to download:", err);
                          }
                        }}
                      >
                        <DownloadSimple className="h-4 w-4 mr-2" />
                        Download MD
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>

      <DeleteConfirmationModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        projectName={project.name}
        onConfirm={handlePermanentDelete}
        isDeleting={isDeleting}
      />

      {viewingContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setViewingContent(null)}
          />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="text-lg font-semibold">
                  {viewingContent.type === 'transcript' ? 'Transcript' : 'Key Ideas Extracted'}
                </h2>
                <p className="text-sm text-muted-foreground">{viewingContent.fileName}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingContent(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-100px)]">
              {viewingContent.type === 'transcript' ? (
                viewingContent.utterances && viewingContent.utterances.length > 0 ? (
                  <div className="space-y-3">
                    {viewingContent.utterances.map((u, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <Badge variant="outline" className="shrink-0 font-mono">
                          Speaker {u.speaker}
                        </Badge>
                        <p className="text-sm flex-1">{u.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                    {viewingContent.content}
                  </pre>
                )
              ) : viewingContent.extractionData ? (
                <ExtractionView data={viewingContent.extractionData} />
              ) : (
                <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg">
                  {viewingContent.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {viewingJobResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setViewingJobResults(null)}
          />
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                Job #{viewingJobResults.id} Results
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingJobResults(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {viewingJobResults.extraction_result?.files.map((file, idx) => (
                <div key={idx} className="mb-6">
                  <h3 className="text-md font-semibold mb-2 flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    {file.file_name}
                    {file.status === "completed" ? (
                      <Badge className="bg-green-500">Completed</Badge>
                    ) : (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </h3>
                  
                  {file.error && (
                    <div className="text-destructive text-sm mb-2">
                      Error: {file.error}
                    </div>
                  )}

                  {file.transcription && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Transcript</h4>
                      <div className="bg-muted p-3 rounded-lg text-sm max-h-64 overflow-y-auto whitespace-pre-wrap">
                        {file.transcription.text}
                      </div>
                    </div>
                  )}

                  {file.extraction && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">AI Extraction</h4>
                      <div className="bg-muted p-3 rounded-lg text-sm max-h-64 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(file.extraction, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(!viewingJobResults.extraction_result?.files || 
                viewingJobResults.extraction_result.files.length === 0) && (
                <div className="text-center text-muted-foreground py-8">
                  No extraction results available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
