import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useAuthStore } from "@/stores/auth";
import { projectsApi } from "@/lib/api";
import { DriveBrowser } from "@/components/drive/DriveBrowser";
import type { DriveItem } from "@/types/api";
import { 
  ArrowLeft, 
  FileText,
  Folder,
  X
} from "@phosphor-icons/react";

export const Route = createFileRoute("/projects/new")({
  component: NewProject,
});

function NewProject() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFolders, setSelectedFolders] = useState<DriveItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"details" | "folder">("details");

  if (!isAuthenticated) {
    navigate({ to: "/" });
    return null;
  }

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    setIsSubmitting(true);
    try {
      const project = await projectsApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        drive_folders: selectedFolders.length > 0 
          ? selectedFolders.map(f => ({ id: f.id, name: f.name }))
          : undefined,
      });
      
      navigate({ to: `/projects/${project.id}` });
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFolderSelect = (item: DriveItem) => {
    if (!item.is_folder) return;
    
    if (selectedFolders.some(f => f.id === item.id)) {
      setSelectedFolders(selectedFolders.filter(f => f.id !== item.id));
    } else {
      setSelectedFolders([...selectedFolders, item]);
    }
  };

  const handleRemoveFolder = (folderId: string) => {
    setSelectedFolders(selectedFolders.filter(f => f.id !== folderId));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/dashboard" })}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" weight="duotone" />
            <span className="text-lg font-bold">New Project</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {step === "details" ? (
          <Card>
            <CardHeader>
              <CardTitle>Project Details</CardTitle>
              <CardDescription>
                Give your project a name and optional description
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">Project Name *</FieldLabel>
                  <Input
                    id="name"
                    placeholder="e.g., Acme Corp Q1 Implementation"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="description">Description</FieldLabel>
                  <Textarea
                    id="description"
                    placeholder="Brief description of this project..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </Field>
                <Field orientation="horizontal">
                  <Button 
                    onClick={() => setStep("folder")}
                    disabled={!name.trim()}
                  >
                    Next: Select Folder
                  </Button>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select Google Drive Folders</CardTitle>
                <CardDescription>
                  Choose folders containing your meeting recordings (optional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedFolders.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-sm font-medium text-muted-foreground">Selected Folders:</p>
                    {selectedFolders.map((folder) => (
                      <div key={folder.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <Folder className="h-5 w-5 text-primary" weight="duotone" />
                        <span className="font-medium flex-1">{folder.name}</span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleRemoveFolder(folder.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <DriveBrowser 
                  onSelect={handleFolderSelect}
                  onSelectCurrentFolder={handleFolderSelect}
                  selectedIds={selectedFolders.map(f => f.id)}
                  showOnlyFolders={false}
                  selectFoldersOnly={true}
                />
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep("details")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating..." : selectedFolders.length === 0 ? "Create Without Folders" : `Create Project (${selectedFolders.length} folder${selectedFolders.length > 1 ? 's' : ''})`}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
