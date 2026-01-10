import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
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
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal";
import { DriveBrowser } from "@/components/drive/DriveBrowser";
import type { DriveItem, Utterance, MeetingExtraction } from "@/types/api";
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
  const { isAuthenticated, isUserReady } = useAuthStore();

  const convexProjectId = projectId as Id<"projects">;
  
  const project = useQuery(api.projects.get, isUserReady ? { projectId: convexProjectId } : "skip");
  const jobs = useQuery(api.jobs.list, isUserReady ? { projectId: convexProjectId } : "skip");
  const documents = useQuery(api.documents.list, isUserReady ? { projectId: convexProjectId } : "skip");
  const transcripts = useQuery(api.transcripts.list, isUserReady ? { projectId: convexProjectId } : "skip");
  const keyIdeasList = useQuery(api.keyIdeas.list, isUserReady ? { projectId: convexProjectId } : "skip");
  
  const archiveProject = useMutation(api.projects.archive);
  const restoreProject = useMutation(api.projects.restore);
  const deleteProject = useMutation(api.projects.permanentDelete);
  const updateProject = useMutation(api.projects.update);
  const createJob = useMutation(api.jobs.create);
  const retryJob = useMutation(api.jobs.retry);
  const navigateDrive = useAction(api.actions.drive.navigate);

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

  const [viewingContent, setViewingContent] = useState<{
    type: 'transcript' | 'extraction';
    fileName: string;
    content: string;
    utterances?: Utterance[];
    extractionData?: MeetingExtraction;
  } | null>(null);

  const isLoading = !isUserReady || project === undefined;
  const error = isUserReady && project === null ? "Project not found" : null;
  const isArchived = project?.status === "archived";
  
  const extractions = useMemo(() => {
    if (!transcripts || !keyIdeasList) return [];
    
    return transcripts.map((transcript: any) => ({
      transcript,
      keyIdea: keyIdeasList.find((k: any) => k.transcriptId === transcript._id),
    }));
  }, [transcripts, keyIdeasList]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  const handleArchive = async () => {
    if (!project) return;
    setIsArchiving(true);
    try {
      await archiveProject({ projectId: convexProjectId });
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
      await restoreProject({ projectId: convexProjectId });
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
      await deleteProject({ projectId: convexProjectId });
      navigate({ to: "/dashboard", search: wasArchived ? { tab: "ARCHIVED" } : {} });
    } catch (err) {
      console.error("Failed to delete project:", err);
      setIsDeleting(false);
    }
  };

  const loadFolderFiles = useCallback(async (folderId: string) => {
    setLoadingFolders(prev => new Set(prev).add(folderId));
    try {
      const response = await navigateDrive({ folderId });
      const transformedItems: DriveItem[] = response.items.map((item) => ({
        id: item.id,
        name: item.name,
        mime_type: item.mimeType,
        size: item.size,
        is_folder: item.isFolder,
        created_time: item.createdTime,
        modified_time: item.modifiedTime,
        web_view_link: item.webViewLink,
        icon_link: item.iconLink,
        thumbnail_link: item.thumbnailLink,
        parents: item.parents,
      }));
      setFolderFiles(prev => ({ ...prev, [folderId]: transformedItems }));
    } catch (err) {
      console.error("Failed to load folder files:", err);
    } finally {
      setLoadingFolders(prev => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
  }, [navigateDrive]);

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
    const existingFolders = project.driveFolders || [];
    if (existingFolders.some(f => f.id === folder.id)) {
      setShowAddFolder(false);
      return;
    }
    const newFolders = [...existingFolders, { id: folder.id, name: folder.name }];
    try {
      await updateProject({ projectId: convexProjectId, driveFolders: newFolders });
      setShowAddFolder(false);
    } catch (err) {
      console.error("Failed to add folder:", err);
    }
  };

  const handleRemoveFolder = async (folderId: string) => {
    if (!project) return;
    const newFolders = (project.driveFolders || []).filter(f => f.id !== folderId);
    try {
      await updateProject({ projectId: convexProjectId, driveFolders: newFolders });
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
      await createJob({
        projectId: convexProjectId,
        videoFiles: videoFiles.map(f => ({
          id: f.id,
          name: f.name,
          mimeType: f.mime_type,
          size: f.size || undefined,
          webViewLink: f.web_view_link || undefined,
        })),
      });
      setSelectedFiles([]);
    } catch (err) {
      console.error("Failed to start processing:", err);
    } finally {
      setIsStartingProcessing(false);
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

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      case "transcribing":
      case "extracting":
        return (
          <Badge className="bg-blue-500">
            <SpinnerGap className="h-3 w-3 mr-1 animate-spin" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
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

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "generating":
        return (
          <Badge className="bg-blue-500">
            <SpinnerGap className="h-3 w-3 mr-1 animate-spin" />
            Generating
          </Badge>
        );
      case "complete":
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
            <Button variant="ghost" size="sm" onClick={() => {}}>
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
                  project.status === "archived" ? "outline" : "secondary"
                }
              >
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              {project.driveFolders && project.driveFolders.length > 0 && (
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  <span>{project.driveFolders.length} folder{project.driveFolders.length > 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  Created {new Date(project._creationTime).toLocaleDateString()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <File className="h-4 w-4" />
                <span>Schema: {project.schemaType}</span>
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

              {(!project.driveFolders || project.driveFolders.length === 0) && !showAddFolder ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Folder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No folders added yet</p>
                  <p className="text-sm mt-1">Add a folder to select files for processing</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {project.driveFolders?.map((folder) => {
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

              {(project.driveFolders?.length ?? 0) > 0 && (
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
                          ? "Select videos to extract"
                          : `Extract ${videoFileCount} video${videoFileCount > 1 ? "s" : ""}`}
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

        <section>
          <h2 className="text-xl font-semibold mb-4">Extraction Jobs</h2>
          {(jobs ?? []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No extraction jobs yet. Start an extraction to generate
                  transcripts and key ideas.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {(jobs ?? []).map((job) => (
                <Card key={job._id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Job
                      </CardTitle>
                      {getJobStatusBadge(job.status)}
                    </div>
                    <CardDescription>
                      {job.videoFiles.length} video file
                      {job.videoFiles.length !== 1 ? "s" : ""}
                      {job.supportingFiles && job.supportingFiles.length > 0
                        ? ` + ${job.supportingFiles.length} supporting files`
                        : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {job.currentStage && (
                        <div className="flex items-center gap-2">
                          {job.status === "completed" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : job.status === "failed" ? (
                            <XCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <SpinnerGap className="h-4 w-4 animate-spin" />
                          )}
                          <span>Stage: {job.currentStage}</span>
                        </div>
                      )}
                      {job.startedAt && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            Started:{" "}
                            {new Date(job.startedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {job.completedAt && (
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          <span>
                            Completed:{" "}
                            {new Date(job.completedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                      {job.errorMessage && (
                        <div className="flex items-center gap-2 text-destructive">
                          <XCircle className="h-4 w-4" />
                          <span>{job.errorMessage}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4">
                      <p className="text-xs text-muted-foreground mb-2">
                        Files:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {job.videoFiles.map((file) => (
                          <Badge key={file.id} variant="outline">
                            {file.name}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {job.status === "failed" && (
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await retryJob({ jobId: job._id });
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

        <section>
          <h2 className="text-xl font-semibold mb-4">Extractions</h2>
          {extractions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  No extractions yet. Start an extraction job to see transcripts and key ideas here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
              {extractions.map(({ transcript, keyIdea }: { transcript: any; keyIdea: any }) => {
                const isInProgress = transcript.status !== "completed" && transcript.status !== "failed" ||
                  (keyIdea && keyIdea.status !== "completed" && keyIdea.status !== "failed");
                
                return (
                  <Card key={transcript._id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Video className="h-5 w-5 text-purple-500 shrink-0" weight="duotone" />
                        <CardTitle 
                          className="text-sm font-medium truncate flex-1" 
                          title={transcript.fileName}
                        >
                          {transcript.fileName.length > 80 
                            ? `${transcript.fileName.slice(0, 80)}...` 
                            : transcript.fileName}
                        </CardTitle>
                        {isInProgress && (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            <SpinnerGap className="h-3 w-3 mr-1 animate-spin" />
                            In Progress
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4 text-blue-500" weight="duotone" />
                          <span>Transcript</span>
                        </div>
                        {transcript.status === "completed" ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setViewingContent({
                                type: 'transcript',
                                fileName: transcript.fileName,
                                content: transcript.text || "No transcript available",
                                utterances: transcript.utterances
                              })}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => downloadTranscript(transcript.fileName, transcript.text || "")}
                              disabled={!transcript.text}
                            >
                              <DownloadSimple className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : transcript.status === "failed" ? (
                          <Badge variant="destructive" className="text-xs">Failed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <SpinnerGap className="h-3 w-3 mr-1 animate-spin" />
                            {transcript.status === "transcribing" ? "Transcribing" : "Pending"}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4 text-purple-500" weight="duotone" />
                          <span>Key Ideas</span>
                        </div>
                        {keyIdea?.status === "completed" ? (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => setViewingContent({
                                type: 'extraction',
                                fileName: transcript.fileName,
                                content: JSON.stringify(keyIdea.extraction || {}, null, 2),
                                extractionData: keyIdea.extraction
                              })}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => downloadExtraction(transcript.fileName, keyIdea.extraction || {})}
                              disabled={!keyIdea.extraction}
                            >
                              <DownloadSimple className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : keyIdea?.status === "failed" ? (
                          <Badge variant="destructive" className="text-xs">Failed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            <SpinnerGap className="h-3 w-3 mr-1 animate-spin" />
                            {keyIdea?.status === "extracting" ? "Extracting" : "Pending"}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Documents</h2>
          {(documents ?? []).length === 0 ? (
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
              {(documents ?? []).map((doc) => (
                <Card key={doc._id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{doc.title}</CardTitle>
                      {getDocStatusBadge(doc.status)}
                    </div>
                    <CardDescription>
                      Version {doc.version} · {doc.schemaType}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {doc.driveFileUrl && (
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={doc.driveFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <GoogleDriveLogo className="h-4 w-4 mr-2" />
                            Open in Drive
                          </a>
                        </Button>
                      )}
                      {doc.markdownContent && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const blob = new Blob([doc.markdownContent || ""], {
                              type: "text/markdown",
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${doc.title}.md`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <DownloadSimple className="h-4 w-4 mr-2" />
                          Download MD
                        </Button>
                      )}
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

    </div>
  );
}
