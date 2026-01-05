import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { driveApi } from "@/lib/api";
import type {
  DriveItem,
  SharedDrive,
  DriveBreadcrumb,
} from "@/types/api";
import {
  Folder,
  File,
  Video,
  HardDrives,
  CaretRight,
  House,
  SpinnerGap,
  Warning,
  ArrowClockwise,
  Check,
  CheckSquare,
  Square,
} from "@phosphor-icons/react";

interface DriveBrowserProps {
  onSelect: (item: DriveItem) => void;
  onSelectCurrentFolder?: (folder: DriveItem) => void;
  selectedIds?: string[];
  showOnlyFolders?: boolean;
}

type ViewState =
  | { type: "drives" }
  | { type: "folder"; folderId: string; driveId?: string };

export function DriveBrowser({
  onSelect,
  onSelectCurrentFolder,
  selectedIds = [],
  showOnlyFolders = false,
}: DriveBrowserProps) {
  const [viewState, setViewState] = useState<ViewState>({ type: "drives" });
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<DriveBreadcrumb[]>([]);
  const [currentDriveId, setCurrentDriveId] = useState<string | undefined>();
  const [currentDriveName, setCurrentDriveName] = useState<string>("");
  const [currentFolder, setCurrentFolder] = useState<DriveItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load shared drives
  const loadSharedDrives = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await driveApi.listSharedDrives();
      setSharedDrives(response.drives);
    } catch (err) {
      setError("Failed to load shared drives");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadFolder = useCallback(
    async (folderId: string, driveId?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await driveApi.navigate(folderId, driveId);
        setItems(response.items);
        setBreadcrumbs(response.breadcrumbs);
        setCurrentFolder(response.current_folder);
      } catch (err) {
        setError("Failed to load folder contents");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial load
  useEffect(() => {
    if (viewState.type === "drives") {
      loadSharedDrives();
      setBreadcrumbs([]);
      setItems([]);
    } else {
      loadFolder(viewState.folderId, viewState.driveId);
    }
  }, [viewState, loadSharedDrives, loadFolder]);

  // Navigate to a shared drive root
  const handleDriveSelect = (drive: SharedDrive) => {
    setCurrentDriveId(drive.id);
    setCurrentDriveName(drive.name);
    setViewState({ type: "folder", folderId: drive.id, driveId: drive.id });
  };

  // Navigate to a folder
  const handleFolderClick = (item: DriveItem) => {
    if (item.is_folder) {
      setViewState({
        type: "folder",
        folderId: item.id,
        driveId: currentDriveId,
      });
    }
  };

  // Navigate via breadcrumb
  const handleBreadcrumbClick = (crumb: DriveBreadcrumb, index: number) => {
    // If clicking on a breadcrumb, navigate to that folder
    if (index === 0 && currentDriveId) {
      // First breadcrumb is the drive root
      setViewState({
        type: "folder",
        folderId: currentDriveId,
        driveId: currentDriveId,
      });
    } else {
      setViewState({
        type: "folder",
        folderId: crumb.id,
        driveId: currentDriveId,
      });
    }
  };

  // Go back to drives list
  const handleBackToDrives = () => {
    setViewState({ type: "drives" });
    setCurrentDriveId(undefined);
    setCurrentDriveName("");
  };

  // Handle item selection (for folders that can be selected)
  const handleItemSelect = (item: DriveItem) => {
    onSelect(item);
  };

  // Get icon for a drive item
  const getItemIcon = (item: DriveItem) => {
    if (item.is_folder) {
      return <Folder className="h-5 w-5 text-blue-500" weight="duotone" />;
    }
    if (item.mime_type.includes("video")) {
      return <Video className="h-5 w-5 text-purple-500" weight="duotone" />;
    }
    return <File className="h-5 w-5 text-gray-500" weight="duotone" />;
  };

  // Format file size
  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Filter items based on showOnlyFolders
  const displayItems = showOnlyFolders
    ? items.filter((item) => item.is_folder)
    : items;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <SpinnerGap className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Warning className="h-8 w-8 text-destructive" weight="duotone" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            viewState.type === "drives"
              ? loadSharedDrives()
              : loadFolder(viewState.folderId, viewState.driveId)
          }
        >
          <ArrowClockwise className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // Shared drives view
  if (viewState.type === "drives") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground border-b pb-3">
          <HardDrives className="h-4 w-4" weight="duotone" />
          <span>Select a Shared Drive</span>
        </div>

        {sharedDrives.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No shared drives found</p>
            <p className="text-xs mt-1">
              You need access to at least one shared drive
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {sharedDrives.map((drive) => (
              <button
                key={drive.id}
                onClick={() => handleDriveSelect(drive)}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left w-full"
              >
                <HardDrives
                  className="h-5 w-5 text-primary"
                  weight="duotone"
                />
                <span className="font-medium">{drive.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Folder view
  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm border-b pb-3 overflow-x-auto">
        <Button
          variant="ghost"
          size="xs"
          onClick={handleBackToDrives}
          className="shrink-0"
        >
          <House className="h-4 w-4" />
        </Button>
        <CaretRight className="h-3 w-3 text-muted-foreground shrink-0" />
        <Button
          variant="ghost"
          size="xs"
          onClick={() =>
            currentDriveId &&
            handleBreadcrumbClick({ id: currentDriveId, name: currentDriveName }, 0)
          }
          className="shrink-0"
        >
          {currentDriveName || "Drive"}
        </Button>

        {breadcrumbs.slice(1).map((crumb, index) => (
          <div key={crumb.id} className="flex items-center gap-1 shrink-0">
            <CaretRight className="h-3 w-3 text-muted-foreground" />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => handleBreadcrumbClick(crumb, index + 1)}
            >
              {crumb.name}
            </Button>
          </div>
        ))}

        {onSelectCurrentFolder && currentFolder && (
          <Button
            variant="outline"
            size="xs"
            onClick={() => onSelectCurrentFolder(currentFolder)}
            className="ml-auto shrink-0"
          >
            <Check className="h-3 w-3 mr-1" />
            Select This Folder
          </Button>
        )}
      </div>

      {displayItems.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>This folder is empty</p>
        </div>
      ) : (
        <div className="grid gap-1 max-h-80 overflow-y-auto">
          {displayItems.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const canSelect = item.is_folder || !showOnlyFolders;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                  isSelected
                    ? "bg-primary/10 border-primary"
                    : "hover:bg-muted/50 border-transparent"
                }`}
              >
                {canSelect && (
                  <button
                    onClick={() => handleItemSelect(item)}
                    className="shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-5 w-5 text-primary" weight="fill" />
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                )}

                <button
                  onClick={() =>
                    item.is_folder ? handleFolderClick(item) : undefined
                  }
                  className={`shrink-0 ${item.is_folder ? "cursor-pointer" : "cursor-default"}`}
                  disabled={!item.is_folder}
                >
                  {getItemIcon(item)}
                </button>

                <button
                  onClick={() =>
                    item.is_folder ? handleFolderClick(item) : undefined
                  }
                  className={`flex-1 text-left truncate text-sm ${
                    item.is_folder
                      ? "hover:text-primary cursor-pointer"
                      : "cursor-default text-muted-foreground"
                  }`}
                  disabled={!item.is_folder}
                >
                  {item.name}
                </button>

                {!item.is_folder && item.size && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatSize(item.size)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
