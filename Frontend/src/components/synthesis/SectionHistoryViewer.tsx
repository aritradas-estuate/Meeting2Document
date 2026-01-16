import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ClockCounterClockwise,
  CheckCircle,
  XCircle,
  CaretLeft,
  CaretRight,
  ChatText,
  Code,
  Eye,
} from '@phosphor-icons/react'

interface GenerationHistoryEntry {
  draftNumber: number
  content: string
  generatedAt: number
  writerModel: string
  reviewerModel?: string
  reviewerFeedback?: string
  approved: boolean
}

interface SectionHistoryViewerProps {
  sectionTitle: string
  generationHistory: GenerationHistoryEntry[]
  finalDraftNumber?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SectionHistoryViewer({
  sectionTitle,
  generationHistory,
  finalDraftNumber,
  open,
  onOpenChange,
}: SectionHistoryViewerProps) {
  const [currentDraftIndex, setCurrentDraftIndex] = useState(
    generationHistory.length - 1,
  )
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered')

  const currentDraft = generationHistory[currentDraftIndex]
  const hasPrevious = currentDraftIndex > 0
  const hasNext = currentDraftIndex < generationHistory.length - 1

  const goToPrevious = () => {
    if (hasPrevious) setCurrentDraftIndex(currentDraftIndex - 1)
  }

  const goToNext = () => {
    if (hasNext) setCurrentDraftIndex(currentDraftIndex + 1)
  }

  if (!currentDraft) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClockCounterClockwise
              className="h-5 w-5 text-primary"
              weight="duotone"
            />
            {sectionTitle} - Generation History
          </DialogTitle>
          <DialogDescription>
            View all drafts and reviewer feedback for this section
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPrevious}
              disabled={!hasPrevious}
            >
              <CaretLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              Draft {currentDraft.draftNumber} of {generationHistory.length}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNext}
              disabled={!hasNext}
            >
              <CaretRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {currentDraft.draftNumber === finalDraftNumber && (
              <Badge className="bg-green-500">Final Version</Badge>
            )}
            {currentDraft.approved ? (
              <Badge
                variant="outline"
                className="text-green-600 border-green-500"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Approved
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-yellow-600 border-yellow-500"
              >
                <XCircle className="h-3 w-3 mr-1" />
                Revision Requested
              </Badge>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              Generated at {new Date(currentDraft.generatedAt).toLocaleString()}{' '}
              using {currentDraft.writerModel}
            </div>
            <div className="flex border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'rendered' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-7"
                onClick={() => setViewMode('rendered')}
              >
                <Eye className="h-3 w-3 mr-1" />
                Preview
              </Button>
              <Button
                variant={viewMode === 'source' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-7"
                onClick={() => setViewMode('source')}
              >
                <Code className="h-3 w-3 mr-1" />
                Source
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Draft Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[300px] overflow-y-auto border rounded-lg p-4">
                {viewMode === 'rendered' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {currentDraft.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {currentDraft.content}
                  </pre>
                )}
              </div>
            </CardContent>
          </Card>

          {currentDraft.reviewerFeedback && (
            <Card className="border-yellow-500/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ChatText
                    className="h-4 w-4 text-yellow-500"
                    weight="duotone"
                  />
                  Reviewer Feedback
                </CardTitle>
                {currentDraft.reviewerModel && (
                  <CardDescription className="text-xs">
                    Reviewed by {currentDraft.reviewerModel}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-sm whitespace-pre-wrap">
                    {currentDraft.reviewerFeedback}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="border-t pt-3">
          <div className="flex justify-center gap-1">
            {generationHistory.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentDraftIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentDraftIndex
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
