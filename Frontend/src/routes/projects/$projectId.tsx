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
import type { Project, ProcessingJob, Document, DriveItem } from "@/types/api";
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
} from "@phosphor-icons/react";

export const Route = createFileRoute("/projects/$projectId")({
  component: ProjectDetail,
});

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
    } catch (err) {
      console.error("Failed to load project:", err);
      setError("Failed to load project");
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

  // Get job status badge
  const getJobStatusBadge = (status: ProcessingJob["status"]) => {
    switch (status) {
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
            {status.charAt(0) + status.slice(1).toLowerCase()}
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
                    showOnlyFolders={true}
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
                    {job.status === "FAILED" && (
                      <div className="mt-4">
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
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Documents Section */}
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
    </div>
  );
}
