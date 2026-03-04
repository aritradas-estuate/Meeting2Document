import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type {
  DriveItem,
  SharedDrive,
  DriveBreadcrumb,
} from "@/types/api";
import { FileTypeIcon, isSupportedFile } from "@/lib/fileTypes";
import {
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
  selectFoldersOnly?: boolean;
  locationMode?: "shared_only" | "my_and_shared";
}

type ViewState =
  | { type: "drives" }
  | {
      type: "folder";
      folderId: string;
      source: "my_drive" | "shared_drive";
      driveId?: string;
      rootId: string;
      rootName: string;
    };

export function DriveBrowser({
  onSelect,
  onSelectCurrentFolder,
  selectedIds = [],
  showOnlyFolders = false,
  selectFoldersOnly = false,
  locationMode = "shared_only",
}: DriveBrowserProps) {
  const listSharedDrivesAction = useAction(api.actions.drive.listSharedDrives);
  const navigateAction = useAction(api.actions.drive.navigate);

  const [viewState, setViewState] = useState<ViewState>({ type: "drives" });
  const [sharedDrives, setSharedDrives] = useState<SharedDrive[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<DriveBreadcrumb[]>([]);
  const [currentFolder, setCurrentFolder] = useState<DriveItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharedDrivesError, setSharedDrivesError] = useState<string | null>(
    null,
  );

  const loadSharedDrives = useCallback(async () => {
    setIsLoading(true);
    setSharedDrivesError(null);
    if (locationMode === "shared_only") {
      setError(null);
    }
    try {
      const response = await listSharedDrivesAction({});
      setSharedDrives(response.drives);
    } catch (err) {
      if (locationMode === "shared_only") {
        setError("Failed to load shared drives");
      } else {
        setSharedDrivesError(
          "Couldn't load shared drives. You can still browse My Drive.",
        );
        setSharedDrives([]);
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [listSharedDrivesAction, locationMode]);

  const loadFolder = useCallback(
    async (
      folderId: string,
      source: "my_drive" | "shared_drive",
      driveId?: string,
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await navigateAction({ folderId, driveId });
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
          source,
          driveId,
        }));
        setItems(transformedItems);
        setBreadcrumbs(response.breadcrumbs);
        const folder = response.currentFolder;
        setCurrentFolder({
          id: folder.id,
          name: folder.name,
          mime_type: folder.mimeType,
          is_folder: folder.isFolder,
          size: null,
          created_time: null,
          modified_time: null,
          web_view_link: null,
          icon_link: null,
          thumbnail_link: null,
          parents: null,
          source,
          driveId,
        });
      } catch (err) {
        setError("Failed to load folder contents");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [navigateAction]
  );

  // Initial load
  useEffect(() => {
    if (viewState.type === "drives") {
      loadSharedDrives();
      setBreadcrumbs([]);
      setItems([]);
      setCurrentFolder(null);
    } else {
      loadFolder(viewState.folderId, viewState.source, viewState.driveId);
    }
  }, [viewState, loadSharedDrives, loadFolder]);

  const handleMyDriveSelect = () => {
    setViewState({
      type: "folder",
      folderId: "root",
      source: "my_drive",
      rootId: "root",
      rootName: "My Drive",
    });
  };

  // Navigate to a shared drive root
  const handleDriveSelect = (drive: SharedDrive) => {
    setViewState({
      type: "folder",
      folderId: drive.id,
      source: "shared_drive",
      driveId: drive.id,
      rootId: drive.id,
      rootName: drive.name,
    });
  };

  // Navigate to a folder
  const handleFolderClick = (item: DriveItem) => {
    if (!item.is_folder || viewState.type !== "folder") return;
    setViewState({
      ...viewState,
      folderId: item.id,
    });
  };

  // Navigate via breadcrumb
  const handleBreadcrumbClick = (crumb: DriveBreadcrumb, index: number) => {
    if (viewState.type !== "folder") return;
    setViewState({
      ...viewState,
      folderId: index === 0 ? viewState.rootId : crumb.id,
    });
  };

  // Go back to drives list
  const handleBackToDrives = () => {
    setViewState({ type: "drives" });
  };

  // Handle item selection (for folders that can be selected)
  const handleItemSelect = (item: DriveItem) => {
    onSelect(item);
  };

  // Get icon for a drive item
  const getItemIcon = (item: DriveItem) => {
    const mimeType = item.is_folder ? 'application/vnd.google-apps.folder' : item.mime_type;
    const isSupported = isSupportedFile(mimeType);
    return (
      <FileTypeIcon
        mimeType={mimeType}
        className={`h-5 w-5 ${!isSupported ? 'opacity-60' : ''}`}
      />
    );
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
              : loadFolder(
                  viewState.folderId,
                  viewState.source,
                  viewState.driveId,
                )
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
    if (locationMode === "my_and_shared") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground border-b pb-3">
            <HardDrives className="h-4 w-4" weight="duotone" />
            <span>Select Drive Location</span>
          </div>

          <button
            onClick={handleMyDriveSelect}
            className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left w-full"
          >
            <House className="h-5 w-5 text-primary" weight="duotone" />
            <span className="font-medium">My Drive</span>
          </button>

          {sharedDrivesError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 flex items-center gap-2">
              <Warning className="h-4 w-4 shrink-0" weight="duotone" />
              <span>{sharedDrivesError}</span>
            </div>
          )}

          {sharedDrives.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Shared Drives
              </p>
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
            </div>
          )}

          {sharedDrives.length === 0 && !sharedDrivesError && (
            <p className="text-xs text-muted-foreground">
              No shared drives found. You can still browse My Drive.
            </p>
          )}
        </div>
      );
    }

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
            handleBreadcrumbClick(
              { id: viewState.rootId, name: viewState.rootName },
              0,
            )
          }
          className="shrink-0"
        >
          {viewState.rootName}
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
            const canSelect = selectFoldersOnly
              ? item.is_folder
              : item.is_folder || !showOnlyFolders;

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
