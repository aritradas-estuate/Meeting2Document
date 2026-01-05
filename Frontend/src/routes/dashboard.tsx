import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth";
import { projectsApi } from "@/lib/api";
import type { Project } from "@/types/api";
import { 
  Plus, 
  Folder, 
  Clock, 
  Spinner,
  FileText,
  SignOut,
  User,
  Archive,
  CircleNotch,
} from "@phosphor-icons/react";

type TabStatus = "ACTIVE" | "PROCESSING" | "ARCHIVED";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  validateSearch: (search: Record<string, unknown>): { tab?: TabStatus } => {
    const tab = search.tab as string | undefined;
    if (tab?.toUpperCase() === "ARCHIVED") return { tab: "ARCHIVED" };
    if (tab?.toUpperCase() === "PROCESSING") return { tab: "PROCESSING" };
    return { tab: "ACTIVE" };
  },
});

function Dashboard() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const { user, isAuthenticated, logout, checkAuth } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabStatus>(tab || "ACTIVE");

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      loadProjects(activeTab);
    }
  }, [isAuthenticated, activeTab]);

  const loadProjects = async (tab: TabStatus) => {
    try {
      setIsLoading(true);
      let statusFilter: string | string[];
      if (tab === "ACTIVE") {
        statusFilter = ["active", "processing"];
      } else if (tab === "PROCESSING") {
        statusFilter = "processing";
      } else {
        statusFilter = "archived";
      }
      const response = await projectsApi.list(1, 50, statusFilter);
      setProjects(response.items);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  const getStatusBadge = (status: Project["status"]) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="secondary">Active</Badge>;
      case "PROCESSING":
        return <Badge className="bg-blue-500">Processing</Badge>;
      case "COMPLETED":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "ARCHIVED":
        return <Badge variant="outline">Archived</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" weight="duotone" />
            <span className="text-lg font-bold">MeetingsToDocument</span>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2 text-sm">
                {user.picture_url ? (
                  <img 
                    src={user.picture_url} 
                    alt={user.name}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <User className="h-8 w-8 p-1 bg-muted rounded-full" />
                )}
                <span className="hidden md:inline">{user.name}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <SignOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground">
              Manage your document generation projects
            </p>
          </div>
          <Link to="/projects/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>

        <div className="flex gap-1 mb-6 border-b">
          <button
            onClick={() => {
              setActiveTab("ACTIVE");
              navigate({ to: "/dashboard", search: {} });
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "ACTIVE"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Active Projects
          </button>
          <button
            onClick={() => {
              setActiveTab("PROCESSING");
              navigate({ to: "/dashboard", search: { tab: "PROCESSING" } });
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "PROCESSING"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <CircleNotch className="h-4 w-4" />
            Processing
          </button>
          <button
            onClick={() => {
              setActiveTab("ARCHIVED");
              navigate({ to: "/dashboard", search: { tab: "ARCHIVED" } });
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === "ARCHIVED"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive className="h-4 w-4" />
            Archived
          </button>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              {activeTab === "ACTIVE" && (
                <>
                  <Folder className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No active projects</h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first project to start generating documents from meetings
                  </p>
                  <Link to="/projects/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Project
                    </Button>
                  </Link>
                </>
              )}
              {activeTab === "PROCESSING" && (
                <>
                  <CircleNotch className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No processing projects</h3>
                  <p className="text-muted-foreground">
                    Projects currently being processed will appear here
                  </p>
                </>
              )}
              {activeTab === "ARCHIVED" && (
                <>
                  <Archive className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No archived projects</h3>
                  <p className="text-muted-foreground">
                    Completed projects that you archive will appear here
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const isArchived = project.status === "ARCHIVED";
              return (
                <Link key={project.id} to={`/projects/${project.id}`}>
                  <Card className={`hover:border-primary/50 transition-colors cursor-pointer h-full ${isArchived ? "opacity-70" : ""}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {isArchived && <Archive className="h-4 w-4 text-muted-foreground" />}
                          <CardTitle className="text-lg">{project.name}</CardTitle>
                        </div>
                        {getStatusBadge(project.status)}
                      </div>
                      {project.description && (
                        <CardDescription className="line-clamp-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {project.drive_folders && project.drive_folders.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Folder className="h-4 w-4" />
                            <span className="truncate max-w-[120px]">
                              {project.drive_folders.length === 1 
                                ? project.drive_folders[0].name 
                                : `${project.drive_folders.length} folders`}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            {new Date(project.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
