import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DriveBrowser } from '@/components/drive/DriveBrowser'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import type { DriveItem } from '@/types/api'
import {
  X,
  GoogleDriveLogo,
  SpinnerGap,
  CheckCircle,
  Warning,
  Export,
} from '@phosphor-icons/react'

interface ExportToGoogleDriveProps {
  documentId: Id<'documents'>
  documentTitle: string
  onClose: () => void
  onSuccess?: (webViewLink: string) => void
}

export function ExportToGoogleDrive({
  documentId,
  documentTitle,
  onClose,
  onSuccess,
}: ExportToGoogleDriveProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportedUrl, setExportedUrl] = useState<string | null>(null)

  const exportToGoogleDocs = useAction(
    (api as any).actions?.["export"]?.exportToGoogleDocs
  )

  const handleExport = async (folder?: DriveItem) => {
    if (!exportToGoogleDocs) {
      setError('Export function not available. Please refresh the page.')
      return
    }

    setIsExporting(true)
    setError(null)

    try {
      const result = await exportToGoogleDocs({
        documentId,
        folderId: folder?.id,
      })
      setExportedUrl(result.webViewLink)
      onSuccess?.(result.webViewLink)
    } catch (err: any) {
      console.error('Export failed:', err)
      setError(err.message || 'Failed to export to Google Drive')
    } finally {
      setIsExporting(false)
    }
  }

  if (exportedUrl) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-background rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
          <div className="flex flex-col items-center text-center gap-4">
            <CheckCircle
              className="h-12 w-12 text-green-500"
              weight="duotone"
            />
            <div>
              <h3 className="text-lg font-semibold">Export Successful!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your document has been exported to Google Docs.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
              <Button className="flex-1" asChild>
                <a
                  href={exportedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GoogleDriveLogo className="h-4 w-4 mr-2" />
                  Open in Drive
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-2xl max-h-[85vh] overflow-hidden mx-4 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Export className="h-5 w-5 text-primary" weight="duotone" />
              Export to Google Drive
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Select a folder to export "{documentTitle}"
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <Warning className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Export Failed</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {isExporting ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <SpinnerGap className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Exporting to Google Docs...
              </p>
            </div>
          ) : (
            <DriveBrowser
              onSelect={() => {}}
              onSelectCurrentFolder={(folder) => handleExport(folder)}
              showOnlyFolders={true}
              selectFoldersOnly={true}
            />
          )}
        </div>

        <div className="border-t p-4 flex justify-between items-center shrink-0">
          <p className="text-xs text-muted-foreground">
            Or export to your Drive root:
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport()}
            disabled={isExporting}
          >
            {isExporting ? (
              <SpinnerGap className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <GoogleDriveLogo className="h-4 w-4 mr-2" />
            )}
            Export to My Drive
          </Button>
        </div>
      </div>
    </div>
  )
}
