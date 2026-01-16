import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  SpinnerGap,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Eye,
  ClockCounterClockwise,
} from '@phosphor-icons/react'
import { Id } from '../../../convex/_generated/dataModel'
import { SectionHistoryViewer } from './SectionHistoryViewer'

interface GenerationHistoryEntry {
  draftNumber: number
  content: string
  generatedAt: number
  writerModel: string
  reviewerModel?: string
  reviewerFeedback?: string
  approved: boolean
}

interface SectionProgress {
  _id: Id<'documentSections'>
  sectionId: string
  sectionTitle: string
  status: 'pending' | 'generating' | 'reviewing' | 'complete' | 'skipped'
  reviewCount: number
  finalDraftNumber?: number
  generationHistory?: GenerationHistoryEntry[]
}

interface GenerationProgressProps {
  sections: SectionProgress[]
  onViewDocument: () => void
  documentId?: Id<'documents'>
}

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Waiting',
    className: 'text-muted-foreground',
    badgeVariant: 'outline' as const,
    animate: false,
  },
  generating: {
    icon: SpinnerGap,
    label: 'Writing',
    className: 'text-blue-500',
    badgeVariant: 'default' as const,
    animate: true,
  },
  reviewing: {
    icon: SpinnerGap,
    label: 'Reviewing',
    className: 'text-purple-500',
    badgeVariant: 'default' as const,
    animate: true,
  },
  complete: {
    icon: CheckCircle,
    label: 'Complete',
    className: 'text-green-500',
    badgeVariant: 'default' as const,
    animate: false,
  },
  skipped: {
    icon: XCircle,
    label: 'Skipped',
    className: 'text-muted-foreground',
    badgeVariant: 'outline' as const,
    animate: false,
  },
}

export function GenerationProgress({
  sections,
  onViewDocument,
  documentId,
}: GenerationProgressProps) {
  const [historySection, setHistorySection] = useState<SectionProgress | null>(
    null,
  )

  const completedCount = sections.filter((s) => s.status === 'complete').length
  const totalCount = sections.length
  const isAllComplete = completedCount === totalCount
  const isGenerating = sections.some(
    (s) => s.status === 'generating' || s.status === 'reviewing',
  )

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" weight="duotone" />
                Generating Document
              </CardTitle>
              <CardDescription>
                {isAllComplete
                  ? 'All sections generated successfully!'
                  : `${completedCount} of ${totalCount} sections complete`}
              </CardDescription>
            </div>
            {isAllComplete && documentId && (
              <Button onClick={onViewDocument}>
                <Eye className="h-4 w-4 mr-2" />
                View Document
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {sections.map((section) => {
              const config = statusConfig[section.status]
              const Icon = config.icon
              const hasHistory =
                section.generationHistory &&
                section.generationHistory.length > 0

              return (
                <div
                  key={section._id}
                  className="flex items-center gap-3 p-3 border rounded-lg"
                >
                  <div className={config.className}>
                    <Icon
                      className={`h-5 w-5 ${config.animate ? 'animate-spin' : ''}`}
                      weight={
                        section.status === 'complete' ? 'fill' : 'regular'
                      }
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {section.sectionTitle}
                    </p>
                    {section.status === 'complete' &&
                      section.finalDraftNumber && (
                        <p className="text-xs text-muted-foreground">
                          Completed in {section.finalDraftNumber} iteration
                          {section.finalDraftNumber !== 1 ? 's' : ''}
                        </p>
                      )}
                  </div>
                  {hasHistory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setHistorySection(section)}
                    >
                      <ClockCounterClockwise className="h-4 w-4" />
                    </Button>
                  )}
                  <Badge
                    variant={config.badgeVariant}
                    className={
                      section.status === 'generating'
                        ? 'bg-blue-500'
                        : section.status === 'reviewing'
                          ? 'bg-purple-500'
                          : section.status === 'complete'
                            ? 'bg-green-500'
                            : ''
                    }
                  >
                    {config.animate && (
                      <SpinnerGap className="h-3 w-3 mr-1 animate-spin" />
                    )}
                    {config.label}
                  </Badge>
                </div>
              )
            })}
          </div>

          {isGenerating && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                Each section goes through a writer/reviewer loop. This may take
                a few minutes per section.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {historySection && historySection.generationHistory && (
        <SectionHistoryViewer
          sectionTitle={historySection.sectionTitle}
          generationHistory={historySection.generationHistory}
          finalDraftNumber={historySection.finalDraftNumber}
          open={!!historySection}
          onOpenChange={(open) => {
            if (!open) setHistorySection(null)
          }}
        />
      )}
    </>
  )
}
