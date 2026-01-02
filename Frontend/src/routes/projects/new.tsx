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
  Check
} from "@phosphor-icons/react";

export const Route = createFileRoute("/projects/new")({
  component: NewProject,
});

function NewProject() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<DriveItem | null>(null);
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
        drive_folder_id: selectedFolder?.id,
        drive_folder_name: selectedFolder?.name,
      });
      
      navigate({ to: `/projects/${project.id}` });
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFolderSelect = (item: DriveItem) => {
    if (item.is_folder) {
      setSelectedFolder(item);
    }
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
                <CardTitle>Select Google Drive Folder</CardTitle>
                <CardDescription>
                  Choose a folder containing your meeting recordings (optional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedFolder ? (
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
                    <Folder className="h-5 w-5 text-primary" weight="duotone" />
                    <span className="font-medium">{selectedFolder.name}</span>
                    <Check className="h-5 w-5 text-green-500 ml-auto" />
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setSelectedFolder(null)}
                    >
                      Change
                    </Button>
                  </div>
                ) : null}
                
                <DriveBrowser 
                  onSelect={handleFolderSelect}
                  selectedId={selectedFolder?.id}
                  showOnlyFolders={false}
                />
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setStep("details")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  Skip & Create
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={isSubmitting || !selectedFolder}
                >
                  {isSubmitting ? "Creating..." : "Create Project"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
