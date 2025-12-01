import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Download, 
  Maximize2, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserPhoto, TryonSession, ProcessingStatus, Garment } from "@/pages/VirtualTryonStudio";

interface TryonPreviewProps {
  session: TryonSession | null;
  photo: UserPhoto | null;
  selectedGarments?: string[];
  garments?: Garment[];
  onRetry?: () => void;
  onDownload?: () => void;
  onFullscreen?: () => void;
}

function TryonPreview({ 
  session, 
  photo, 
  selectedGarments = [],
  garments = [],
  onRetry, 
  onDownload, 
  onFullscreen 
}: TryonPreviewProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Mock processing progress based on status
  const getProcessingProgress = (status: ProcessingStatus) => {
    switch (status) {
      case 'uploading': return 10;
      case 'processing': return 45;
      case 'pose-estimation': return 25;
      case 'smpl-generation': return 40;
      case 'guidance-creation': return 60;
      case 'ai-rendering': return 80;
      case 'finalizing': return 95;
      case 'completed': return 100;
      case 'failed': return 0;
      default: return 0;
    }
  };

  const getStatusIcon = (status: ProcessingStatus) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'failed':
        return <AlertCircle className="text-red-500" size={16} />;
      default:
        return <Loader2 className="animate-spin text-accent" size={16} />;
    }
  };

  const getStatusMessage = (status: ProcessingStatus) => {
    switch (status) {
      case 'uploading': return 'Uploading your photo...';
      case 'processing': return 'Analyzing photo...';
      case 'pose-estimation': return 'Detecting pose and body shape...';
      case 'smpl-generation': return 'Creating 3D body model...';
      case 'guidance-creation': return 'Generating garment guidance...';
      case 'ai-rendering': return 'AI rendering in progress...';
      case 'finalizing': return 'Finalizing your try-on...';
      case 'completed': return 'Try-on complete!';
      case 'failed': return 'Processing failed. Please try again.';
      default: return 'Preparing...';
    }
  };

  // Simulate video playback for completed results
  useEffect(() => {
    if (isPlaying && session?.status === 'completed') {
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          const duration = 10; // 10 second preview
          if (prev >= duration) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
      
      return () => clearInterval(interval);
    }
  }, [isPlaying, session?.status]);

  const handlePlayPause = () => {
    if (!session || session.status !== 'completed') return;
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const selectedGarmentObjects = garments.filter(g => selectedGarments.includes(g.id));

  // Show empty state only when neither photo nor session exists AND no garments selected
  if (!session && !photo && selectedGarments.length === 0) {
    return (
      <Card className="h-full bg-white/5">
        <CardContent className="h-full flex flex-col items-center justify-center text-center p-8">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Play size={32} className="text-white/20" />
          </div>
          <h3 className="text-xl font-medium mb-2">AI Try-On Preview</h3>
          <p className="text-muted-foreground mb-4">
            Select a photo and garment to see your AI-generated try-on
          </p>
          <Badge variant="outline" className="bg-white/5">
            Ready to Generate
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // Show garment selection state when garments are selected but no photo
  if (!session && !photo && selectedGarments.length > 0) {
    return (
      <Card className="h-full bg-white/5">
        <CardContent className="h-full flex flex-col items-center justify-center text-center p-8">
          <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Play size={32} className="text-white/20" />
          </div>
          <h3 className="text-xl font-medium mb-2">AI Try-On Preview</h3>
          <p className="text-muted-foreground mb-4">
            Upload a photo to try on your selected garments
          </p>
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">
              Selected Garments ({selectedGarments.length}):
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {selectedGarmentObjects.map((garment) => (
                <Badge key={garment.id} variant="secondary" className="bg-accent/20 text-accent">
                  {garment.name}
                </Badge>
              ))}
            </div>
          </div>
          <Badge variant="outline" className="bg-white/5">
            Select Photo to Continue
          </Badge>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full bg-white/5">
      <CardContent className="h-full p-6 flex flex-col">
        {/* Header with Status */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">Try-On Preview</h3>
            {session && (
              <div className="flex items-center gap-2">
                {getStatusIcon(session.status)}
                <Badge 
                  variant={session.status === 'completed' ? 'default' : 'secondary'}
                  className={cn(
                    session.status === 'completed' && 'bg-green-500/20 text-green-400',
                    session.status === 'failed' && 'bg-red-500/20 text-red-400'
                  )}
                >
                  {session.status === 'completed' ? 'Complete' : 
                   session.status === 'failed' ? 'Failed' : 'Processing'}
                </Badge>
              </div>
            )}
          </div>
          
          {session?.status === 'completed' && (
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={onFullscreen}>
                <Maximize2 size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDownload}>
                <Download size={16} />
              </Button>
            </div>
          )}
        </div>

        {/* Main Preview Area */}
        <div className="flex-1 flex flex-col">
          <div className="aspect-[3/4] bg-white/5 rounded-lg overflow-hidden mb-4 relative">
            {/* Original Photo (while processing or ready to process) */}
            {photo && (session?.status !== 'completed' || !session) && (
              <>
                <img 
                  src={photo.url} 
                  alt="Original"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMzc0MTUxIi8+CjxjaXJjbGUgY3g9IjE1MCIgY3k9IjEyMCIgcj0iNDAiIGZpbGw9IiM2QjcyODAiLz4KPHBhdGggZD0iTTkwIDMwMEM5MCAyNTUgMTE1IDIyMCAxNTAgMjIwUzIxMCAyNTUgMjEwIDMwMFY0MDBIOTBWMzAwWiIgZmlsbD0iIzZCNzI4MCIvPgo8dGV4dCB4PSIxNTAiIHk9IjM1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzlDQTNBRiIgZm9udC1zaXplPSIxNCI+UGhvdG8gUGxhY2Vob2xkZXI8L3RleHQ+Cjwvc3ZnPgo=';
                  }}
                />
                {/* Selected Garments Overlay when no session is active */}
                {!session && selectedGarments.length > 0 && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="text-center space-y-3 p-4">
                      <div className="bg-white/10 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-white mb-2">Ready to Try On</h4>
                        <div className="space-y-1">
                          {selectedGarmentObjects.slice(0, 3).map((garment) => (
                            <div key={garment.id} className="text-xs text-white/80">
                              {garment.name}
                            </div>
                          ))}
                          {selectedGarments.length > 3 && (
                            <div className="text-xs text-white/60">
                              +{selectedGarments.length - 3} more
                            </div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-white/60">
                        Click "Generate Try-On" to start
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Result Image/Video (when completed) */}
            {session?.status === 'completed' && session.resultUrl && (
              <div className="w-full h-full relative">
                {session.resultUrl.includes('.mp4') ? (
                  // Video result
                  <video 
                    className="w-full h-full object-cover"
                    src={session.resultUrl}
                    loop
                    muted
                    ref={(video) => {
                      if (video) {
                        if (isPlaying) {
                          video.currentTime = currentTime;
                          video.play();
                        } else {
                          video.pause();
                        }
                      }
                    }}
                  />
                ) : (
                  // Image result
                  <img 
                    src={session.resultUrl} 
                    alt="Try-on result"
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Play/Pause Overlay */}
                <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button 
                    variant="ghost"
                    size="icon"
                    className="h-16 w-16 bg-black/50 hover:bg-black/70 rounded-full"
                    onClick={handlePlayPause}
                  >
                    {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Processing Overlay */}
            {session && session.status !== 'completed' && session.status !== 'failed' && (
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                <h4 className="text-lg font-medium mb-2">
                  {getStatusMessage(session.status)}
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  This may take a few minutes...
                </p>
                <div className="w-full max-w-xs">
                  <Progress 
                    value={getProcessingProgress(session.status)} 
                    className="bg-white/10"
                  />
                  <p className="text-xs text-center mt-2">
                    {getProcessingProgress(session.status)}% complete
                  </p>
                </div>
              </div>
            )}
            
            {/* Error Overlay */}
            {session?.status === 'failed' && (
              <div className="absolute inset-0 bg-red-500/20 flex flex-col items-center justify-center text-center p-6">
                <AlertCircle size={48} className="text-red-400 mb-4" />
                <h4 className="text-lg font-medium mb-2">Processing Failed</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Something went wrong during processing. Please try again.
                </p>
                <Button onClick={onRetry} variant="outline">
                  <RotateCcw size={16} className="mr-2" />
                  Retry
                </Button>
              </div>
            )}
            
            {/* Empty State */}
            {!photo && !session && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
                  <Play size={24} className="text-white/40" />
                </div>
                <p className="text-muted-foreground">
                  Upload a photo to start your try-on
                </p>
              </div>
            )}
          </div>

          {/* Video Controls (for completed results) */}
          {session?.status === 'completed' && session.resultUrl?.includes('.mp4') && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={handlePlayPause}>
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleRestart}>
                  <RotateCcw size={16} />
                </Button>
                <div className="flex-1 flex items-center gap-2">
                  <Progress value={(currentTime / 10) * 100} className="flex-1" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {currentTime.toFixed(1)}s / 10.0s
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Processing Timeline (for in-progress sessions) */}
          {session && session.status !== 'completed' && session.status !== 'failed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Estimated time: 2-5 minutes
                </span>
              </div>
              
              {/* Processing Steps */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { key: 'pose-estimation', label: 'Pose Detection' },
                  { key: 'smpl-generation', label: '3D Model' },
                  { key: 'guidance-creation', label: 'Guidance' },
                  { key: 'ai-rendering', label: 'AI Rendering' }
                ].map(({ key, label }) => {
                  const isActive = session.status === key;
                  const isComplete = getProcessingProgress(session.status) > getProcessingProgress(key as ProcessingStatus);
                  
                  return (
                    <div key={key} className={cn(
                      "flex items-center gap-2 p-2 rounded",
                      isActive && "bg-accent/10 text-accent",
                      isComplete && "text-green-400"
                    )}>
                      {isComplete ? (
                        <CheckCircle size={12} className="text-green-400" />
                      ) : isActive ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-white/20" />
                      )}
                      <span>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Session Info */}
          {session && (
            <div className="mt-4 p-3 bg-white/5 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Session ID:</span>
                <span className="font-mono">{session.id.slice(0, 8)}</span>
              </div>
              {session.createdAt && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Started:</span>
                  <span>{new Date(session.createdAt).toLocaleTimeString()}</span>
                </div>
              )}
              {session.completedAt && (
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Completed:</span>
                  <span>{new Date(session.completedAt).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default TryonPreview;