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
  FileText,
  CheckSquare,
  Square,
  SpinnerGap,
  Play,
  ArrowLeft,
  Video,
} from '@phosphor-icons/react'

interface SectionRecommendation {
  sectionId: string
  sectionTitle: string
  confidence: 'high' | 'medium' | 'low'
  summary: string
  sourceFileNames: string[]
}

interface SectionRecommendationsProps {
  recommendations: SectionRecommendation[]
  onStartGeneration: (selectedSectionIds: string[]) => void
  onBack: () => void
  isGenerating: boolean
}

const confidenceConfig = {
  high: {
    label: 'High Confidence',
    className: 'bg-green-500/10 text-green-600 border-green-500/30',
    dotClassName: 'bg-green-500',
  },
  medium: {
    label: 'Medium Confidence',
    className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
    dotClassName: 'bg-yellow-500',
  },
  low: {
    label: 'Low Confidence',
    className: 'bg-red-500/10 text-red-600 border-red-500/30',
    dotClassName: 'bg-red-500',
  },
}

export function SectionRecommendations({
  recommendations,
  onStartGeneration,
  onBack,
  isGenerating,
}: SectionRecommendationsProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const highAndMedium = recommendations
      .filter((r) => r.confidence === 'high' || r.confidence === 'medium')
      .map((r) => r.sectionId)
    return new Set(highAndMedium)
  })

  const toggleSelection = (sectionId: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId)
    } else {
      newSelected.add(sectionId)
    }
    setSelectedIds(newSelected)
  }

  const handleStartGeneration = () => {
    onStartGeneration(Array.from(selectedIds))
  }

  const sortedRecommendations = [...recommendations].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.confidence] - order[b.confidence]
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" weight="duotone" />
              AI Section Recommendations
            </CardTitle>
            <CardDescription>
              Based on your selected sources, the AI recommends these sections.
              Select which ones to generate.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={isGenerating}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {sortedRecommendations.map((rec) => {
            const isSelected = selectedIds.has(rec.sectionId)
            const config = confidenceConfig[rec.confidence]

            return (
              <div
                key={rec.sectionId}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-primary/5 border-primary/50'
                    : 'hover:bg-muted/50'
                }`}
                onClick={() => toggleSelection(rec.sectionId)}
              >
                <div className="flex items-start gap-3">
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
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{rec.sectionTitle}</span>
                      <Badge variant="outline" className={config.className}>
                        <span
                          className={`w-2 h-2 rounded-full mr-1.5 ${config.dotClassName}`}
                        />
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {rec.summary}
                    </p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      <Video className="h-3 w-3" />
                      <span>Sources: {rec.sourceFileNames.join(', ')}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedIds.size} of {recommendations.length} sections selected
          </p>
          <Button
            onClick={handleStartGeneration}
            disabled={selectedIds.size === 0 || isGenerating}
          >
            {isGenerating ? (
              <>
                <SpinnerGap className="h-4 w-4 mr-2 animate-spin" />
                Starting Generation...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Generate {selectedIds.size} Section
                {selectedIds.size !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
