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
  Video,
  FileText,
  CheckSquare,
  Square,
  SpinnerGap,
  Lightning,
} from '@phosphor-icons/react'
import { Id } from '../../../convex/_generated/dataModel'

interface ExtractionData {
  transcript: {
    _id: Id<'transcripts'>
    fileName: string
    status: string
    text?: string
  }
  keyIdea?: {
    _id: Id<'keyIdeas'>
    status: string
    extraction?: any
  }
}

interface SourceSelectorProps {
  extractions: ExtractionData[]
  onStartSynthesis: (
    selectedSources: Array<{
      transcriptId: Id<'transcripts'>
      keyIdeaId: Id<'keyIdeas'>
      fileName: string
    }>,
  ) => void
  isStarting: boolean
}

export function SourceSelector({
  extractions,
  onStartSynthesis,
  isStarting,
}: SourceSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const completedExtractions = extractions.filter(
    (e) =>
      e.transcript.status === 'completed' && e.keyIdea?.status === 'completed',
  )

  const toggleSelection = (transcriptId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(transcriptId)) {
      newSelected.delete(transcriptId)
    } else {
      newSelected.add(transcriptId)
    }
    setSelectedIds(newSelected)
  }

  const selectAll = () => {
    setSelectedIds(new Set(completedExtractions.map((e) => e.transcript._id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleStartSynthesis = () => {
    const selectedSources = completedExtractions
      .filter((e) => selectedIds.has(e.transcript._id))
      .map((e) => ({
        transcriptId: e.transcript._id,
        keyIdeaId: e.keyIdea!._id,
        fileName: e.transcript.fileName,
      }))

    onStartSynthesis(selectedSources)
  }

  if (completedExtractions.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No completed extractions available. Complete an extraction job first
            to use document synthesis.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Lightning className="h-5 w-5 text-primary" weight="duotone" />
              Document Synthesis
            </CardTitle>
            <CardDescription>
              Select transcripts and key ideas to generate a Solution Design
              Document
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={selectedIds.size === completedExtractions.length}
            >
              Select All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {completedExtractions.map(({ transcript, keyIdea }) => {
            const isSelected = selectedIds.has(transcript._id)
            const summaryPreview = keyIdea?.extraction?.summary
              ? keyIdea.extraction.summary.substring(0, 150) + '...'
              : null

            return (
              <div
                key={transcript._id}
                className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-primary/10 border-primary/50'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleSelection(transcript._id)}
              >
                <div className="pt-0.5">
                  {isSelected ? (
                    <CheckSquare
                      className="h-5 w-5 text-primary"
                      weight="fill"
                    />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <Video
                  className="h-5 w-5 text-purple-500 shrink-0 mt-0.5"
                  weight="duotone"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {transcript.fileName}
                  </p>
                  {summaryPreview && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {summaryPreview}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      <FileText className="h-3 w-3 mr-1" />
                      Transcript
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Lightning className="h-3 w-3 mr-1" />
                      Key Ideas
                    </Badge>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size} of {completedExtractions.length} selected
          </p>
          <Button
            onClick={handleStartSynthesis}
            disabled={selectedIds.size === 0 || isStarting}
          >
            {isStarting ? (
              <>
                <SpinnerGap className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Lightning className="h-4 w-4 mr-2" />
                Analyze & Recommend Sections
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
