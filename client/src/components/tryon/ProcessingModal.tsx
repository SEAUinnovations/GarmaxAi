import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Check, Sparkles, AlertCircle, Clock, X, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProcessingModalProps {
  sessionId: string;
  status: "queued" | "processing" | "preview" | "rendering" | "complete" | "failed";
  progress?: number;
  previewUrl?: string;
  autoConfirmSeconds?: number;
  onConfirm?: () => void;
  onSwitchToAI?: () => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export default function ProcessingModal({
  sessionId,
  status,
  progress = 0,
  previewUrl,
  autoConfirmSeconds = 30,
  onConfirm,
  onSwitchToAI,
  onCancel,
  onClose,
}: ProcessingModalProps) {
  const [countdown, setCountdown] = useState(autoConfirmSeconds);

  // Auto-confirm countdown for preview stage
  useEffect(() => {
    if (status === "preview" && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            onConfirm?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status, countdown, onConfirm]);

  const getStatusConfig = () => {
    switch (status) {
      case "queued":
        return {
          icon: Clock,
          title: "Queued for Processing",
          description: "Your request is in the queue. This usually takes a few seconds.",
          color: "text-blue-400",
          bgColor: "bg-blue-500/10",
          showProgress: false,
        };
      case "processing":
        return {
          icon: Sparkles,
          title: "Generating Preview",
          description: "Analyzing garments and preparing 3D overlay...",
          color: "text-accent",
          bgColor: "bg-accent/10",
          showProgress: true,
        };
      case "preview":
        return {
          icon: Check,
          title: "Preview Ready",
          description: "Review the overlay preview before final rendering.",
          color: "text-green-400",
          bgColor: "bg-green-500/10",
          showProgress: false,
        };
      case "rendering":
        return {
          icon: Zap,
          title: "Rendering Final Output",
          description: "Creating high-quality render. This may take 1-2 minutes.",
          color: "text-accent",
          bgColor: "bg-accent/10",
          showProgress: true,
        };
      case "complete":
        return {
          icon: Check,
          title: "Complete!",
          description: "Your virtual try-on is ready.",
          color: "text-green-400",
          bgColor: "bg-green-500/10",
          showProgress: false,
        };
      case "failed":
        return {
          icon: AlertCircle,
          title: "Processing Failed",
          description: "Something went wrong. Your credits have been refunded.",
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          showProgress: false,
        };
      default:
        return {
          icon: Sparkles,
          title: "Processing",
          description: "Please wait...",
          color: "text-accent",
          bgColor: "bg-accent/10",
          showProgress: false,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <Card className="bg-card border-white/10 max-w-3xl w-full">
        <CardContent className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={cn("p-3 rounded-full", config.bgColor)}>
                <Icon className={cn("w-6 h-6", config.color)} />
              </div>
              <div>
                <h2 className="text-2xl font-serif font-bold">{config.title}</h2>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </div>
            </div>
            {(status === "complete" || status === "failed") && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={20} />
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          {config.showProgress && (
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {status === "processing" ? "Analyzing..." : "Rendering..."}
                </span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Preview Stage */}
          {status === "preview" && previewUrl && (
            <div className="space-y-6">
              {/* Auto-confirm countdown */}
              <div className="flex items-center justify-center gap-3 p-4 bg-accent/10 rounded-lg border border-accent/50">
                <Clock className="w-5 h-5 text-accent" />
                <p className="text-sm">
                  Auto-confirming in{" "}
                  <span className="font-bold text-lg text-accent">{countdown}s</span>
                </p>
              </div>

              {/* Preview Image */}
              <div className="rounded-lg overflow-hidden bg-black/40 border border-white/10">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="border-destructive/50 hover:bg-destructive/10"
                >
                  <X size={16} className="mr-2" />
                  Cancel (Full Refund)
                </Button>
                <Button
                  variant="outline"
                  onClick={onSwitchToAI}
                  className="border-blue-500/50 hover:bg-blue-500/10"
                >
                  <Sparkles size={16} className="mr-2" />
                  Use AI Only (+5 credits)
                </Button>
                <Button
                  onClick={onConfirm}
                  className="bg-accent text-accent-foreground hover:bg-white hover:text-black"
                >
                  <Check size={16} className="mr-2" />
                  Looks Good!
                </Button>
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  Overlay preview shows how garments map to your avatar
                </p>
                <p className="text-xs text-muted-foreground">
                  Switching to AI-only rendering adds 5 credits but may provide better results for complex patterns
                </p>
              </div>
            </div>
          )}

          {/* Processing Stage */}
          {(status === "queued" || status === "processing" || status === "rendering") && (
            <div className="space-y-6">
              {/* Status Updates */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      status === "queued" ? "bg-blue-400 animate-pulse" : "bg-green-400"
                    )}
                  />
                  <span className="text-sm">Session created</span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      status === "processing" || status === "rendering"
                        ? "bg-accent animate-pulse"
                        : "bg-white/20"
                    )}
                  />
                  <span className="text-sm">
                    {status === "processing" || status === "rendering"
                      ? "Processing your request..."
                      : "Waiting to process"}
                  </span>
                </div>
                {status === "rendering" && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                    <span className="text-sm">Rendering high-quality output...</span>
                  </div>
                )}
              </div>

              {/* Cancel Button */}
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={onCancel}>
                  Cancel & Refund
                </Button>
              </div>
            </div>
          )}

          {/* Complete Stage */}
          {status === "complete" && previewUrl && (
            <div className="space-y-6">
              <div className="rounded-lg overflow-hidden bg-black/40 border border-white/10">
                <img
                  src={previewUrl}
                  alt="Final render"
                  className="w-full h-auto max-h-96 object-contain"
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Close
                </Button>
                <Button
                  className="flex-1 bg-accent text-accent-foreground hover:bg-white hover:text-black"
                  onClick={() => {
                    // TODO: Download image
                    console.log("Download image");
                  }}
                >
                  Download
                </Button>
              </div>
            </div>
          )}

          {/* Failed Stage */}
          {status === "failed" && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/50">
                <p className="text-sm">
                  We encountered an error while processing your request.
                  <br />
                  All credits have been automatically refunded.
                </p>
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {/* Session Info */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-muted-foreground text-center">
              Session ID: {sessionId}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
