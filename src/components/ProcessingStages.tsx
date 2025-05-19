
import React from "react";
import { Check, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export type ProcessingStage = "uploading" | "converting" | "transcribing" | "completed" | "failed";

interface ProcessingStagesProps {
  currentStage: ProcessingStage;
  progress: {
    uploading: number;
    converting: number;
    transcribing: number;
  };
  error?: string | null;
}

const ProcessingStages: React.FC<ProcessingStagesProps> = ({ 
  currentStage, 
  progress,
  error 
}) => {
  // Define all stages in order
  const stages: { id: ProcessingStage; label: string }[] = [
    { id: "uploading", label: "Uploading File" },
    { id: "converting", label: "Converting Format" },
    { id: "transcribing", label: "Processing Transcription" },
    { id: "completed", label: "Completed" }
  ];

  // Helper function to determine a stage's status
  const getStageStatus = (stageId: ProcessingStage) => {
    if (currentStage === "failed") {
      return stageId === currentStage ? "error" : "pending";
    }
    
    const stageIndex = stages.findIndex(s => s.id === stageId);
    const currentIndex = stages.findIndex(s => s.id === currentStage);
    
    if (stageIndex < currentIndex || (stageId === currentStage && currentStage === "completed")) {
      return "completed";
    } else if (stageId === currentStage) {
      return "active";
    } else {
      return "pending";
    }
  };

  // Get progress value for a specific stage
  const getStageProgress = (stageId: ProcessingStage): number => {
    if (currentStage === "failed") return 0;
    if (getStageStatus(stageId) === "completed") return 100;
    if (getStageStatus(stageId) !== "active") return 0;
    
    return progress[stageId as keyof typeof progress] || 0;
  };

  return (
    <div className="space-y-4">
      {currentStage === "failed" && error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-2">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      <div className="space-y-3">
        {stages.map((stage) => {
          const status = getStageStatus(stage.id);
          
          return (
            <div key={stage.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center 
                    ${status === 'completed' ? 'bg-green-500' : 
                      status === 'active' ? 'bg-primary' : 
                      status === 'error' ? 'bg-red-500' : 'bg-muted'}`}>
                    {status === 'completed' ? (
                      <Check className="h-3 w-3 text-white" />
                    ) : status === 'pending' ? (
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/30"></span>
                    ) : status === 'error' ? (
                      <span className="text-white text-xs">!</span>
                    ) : (
                      <Clock className="h-3 w-3 text-white animate-pulse" />
                    )}
                  </div>
                  <span className={`text-sm font-medium 
                    ${status === 'active' ? 'text-primary' : 
                      status === 'completed' ? 'text-muted-foreground' : 
                      status === 'error' ? 'text-red-600' : 'text-muted-foreground/70'}`}>
                    {stage.label}
                  </span>
                </div>
                
                {status === 'active' && (
                  <span className="text-xs font-medium text-primary">
                    {getStageProgress(stage.id)}%
                  </span>
                )}
              </div>
              
              {status === 'active' && (
                <Progress 
                  value={getStageProgress(stage.id)} 
                  className={`h-2 ${stage.id === 'converting' ? 'bg-amber-100' : ''}`}
                />
              )}
              
              {stage.id === "converting" && status === "active" && (
                <p className="text-xs text-amber-600 mt-1">
                  Converting audio format for better transcription quality
                </p>
              )}
              
              {stage.id === "transcribing" && status === "active" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Processing with OpenAI Whisper AI (this may take several minutes)
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProcessingStages;
