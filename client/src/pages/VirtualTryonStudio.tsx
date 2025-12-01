import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, ArrowLeft, Plus, Sparkles, Upload, Trash2, X, User, Image as ImageIcon, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import GarmentUploader from "@/components/tryon/GarmentUploader";
import PhotoUploader from "@/components/tryon/PhotoUploader";
import TryonPreview from "@/components/tryon/TryonPreview";
import ProcessingModal from "@/components/tryon/ProcessingModal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export interface UserPhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  type: 'front' | 'side' | 'full-body';
  uploadedAt: string;
  processed: boolean;
  smplData?: any;
}

export interface Garment {
  id: string;
  name: string;
  type: string;
  color: string;
  imageUrl: string;
  thumbnailUrl: string;
  uploadedAt: string;
  isOverlayable?: boolean;
}

export type ProcessingStatus = 'uploading' | 'processing' | 'pose-estimation' | 'smpl-generation' | 'guidance-creation' | 'ai-rendering' | 'finalizing' | 'completed' | 'failed';

export interface TryonSession {
  id: string;
  status: ProcessingStatus;
  progress: number;
  photoId: string;
  garmentIds: string[];
  previewUrl?: string;
  resultUrl?: string;
  finalUrl?: string;
  createdAt: string;
  completedAt?: string;
  processingMode?: 'LAMBDA' | 'ECS';
}

export default function VirtualTryonStudio() {
  const [userPhotos, setUserPhotos] = useState<UserPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<UserPhoto | null>(null);
  const [selectedGarments, setSelectedGarments] = useState<string[]>([]);
  const [wardrobe, setWardrobe] = useState<Garment[]>([]);
  const [photoLimit, setPhotoLimit] = useState({ current: 0, limit: 3 });
  const [showPhotoUploader, setShowPhotoUploader] = useState(false);
  const [showGarmentUploader, setShowGarmentUploader] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [currentSession, setCurrentSession] = useState<TryonSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<TryonSession[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Load user photos and wardrobe from API
    loadUserPhotos();
    loadWardrobe();
    loadSessionHistory();
  }, []);

  const loadUserPhotos = async () => {
    try {
      // TODO: Replace with actual API call
      const mockPhotos: UserPhoto[] = [
        {
          id: 'demo-photo-1',
          url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=600&fit=crop&crop=face',
          thumbnailUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=200&fit=crop&crop=face',
          type: 'front',
          uploadedAt: new Date().toISOString(),
          processed: true,
          smplData: { confidence: 0.85, bodyShape: 'athletic' }
        }
      ];
      setUserPhotos(mockPhotos);
      setPhotoLimit({ current: mockPhotos.length, limit: 3 });
    } catch (error) {
      toast({
        title: "Failed to load photos",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const loadWardrobe = async () => {
    try {
      // TODO: Replace with actual API call  
      const mockGarments: Garment[] = [
        {
          id: 'demo-shirt-1',
          name: 'Blue Cotton T-Shirt',
          type: 'shirt',
          color: 'blue',
          imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80',
          thumbnailUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=150&q=80',
          uploadedAt: new Date().toISOString(),
          isOverlayable: false
        },
        {
          id: 'demo-dress-1',
          name: 'Summer Floral Dress',
          type: 'dress',
          color: 'floral',
          imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&q=80',
          thumbnailUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=150&q=80',
          uploadedAt: new Date().toISOString(),
          isOverlayable: true
        },
        {
          id: 'demo-jacket-1',
          name: 'Black Leather Jacket',
          type: 'jacket',
          color: 'black',
          imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&q=80',
          thumbnailUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=150&q=80',
          uploadedAt: new Date().toISOString(),
          isOverlayable: false
        }
      ];
      setWardrobe(mockGarments);
    } catch (error) {
      toast({
        title: "Failed to load wardrobe",
        description: "Please try again later", 
        variant: "destructive"
      });
    }
  };

  const loadSessionHistory = async () => {
    try {
      // TODO: Load recent try-on sessions
      setSessionHistory([]);
    } catch (error) {
      console.error('Failed to load session history:', error);
    }
  };
        
  const handlePhotoUpload = async (file: File, type: 'front' | 'side' | 'full-body') => {
    try {
      setShowPhotoUploader(false);
      
      // Upload photo to backend
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('type', type);
      
      // TODO: Replace with actual API endpoint
      const response = await fetch('/api/tryon/photos/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      let newPhoto: UserPhoto;
      if (response.ok) {
        newPhoto = await response.json();
      } else {
        // Fallback: create photo object with blob URL for preview
        const previewUrl = URL.createObjectURL(file);
        newPhoto = {
          id: `photo_${Date.now()}`,
          url: previewUrl,
          thumbnailUrl: previewUrl,
          type,
          uploadedAt: new Date().toISOString(),
          processed: false
        };
      }
      
      setUserPhotos([...userPhotos, newPhoto]);
      setPhotoLimit({ ...photoLimit, current: photoLimit.current + 1 });
      
      toast({
        title: "Photo uploaded successfully",
        description: "Your photo is being processed for 3D pose estimation"
      });
      
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Please try again with a different photo",
        variant: "destructive"
      });
    }
  };

  const handleGarmentUpload = async (garmentData: any) => {
    try {
      const newGarment: Garment = {
        id: `garment_${Date.now()}`,
        ...garmentData,
        uploadedAt: new Date().toISOString()
      };
      
      setWardrobe([...wardrobe, newGarment]);
      setShowGarmentUploader(false);
      
      toast({
        title: "Garment added to wardrobe",
        description: "Ready to use in try-on sessions"
      });
      
    } catch (error) {
      toast({
        title: "Failed to add garment",
        description: "Please try again",
        variant: "destructive"
      });
    }
  };

  const handleStartTryon = async () => {
    if (!selectedPhoto || selectedGarments.length === 0) {
      toast({
        title: "Missing selection",
        description: "Please select a photo and at least one garment",
        variant: "destructive"
      });
      return;
    }

    try {
      // Create try-on session via new photo-based API
      const sessionData = {
        photoId: selectedPhoto.id,
        garmentIds: selectedGarments,
        preferences: {
          renderQuality: 'standard',
          fitPreference: 'fitted'
        }
      };

      const response = await fetch('/api/tryon/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });

      if (!response.ok) {
        throw new Error('Failed to create try-on session');
      }

      const session: TryonSession = await response.json();
      setCurrentSession(session);
      setShowProcessingModal(true);

      // Start polling for session status updates
      pollSessionStatus(session.id);

      toast({
        title: "Try-on session started",
        description: "Processing your photo with SMPL pose estimation"
      });

    } catch (error) {
      toast({
        title: "Failed to start try-on",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const pollSessionStatus = async (sessionId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`/api/tryon/sessions/${sessionId}/status`);
        if (response.ok) {
          const session: TryonSession = await response.json();
          setCurrentSession(session);

          // Continue polling if still processing
          if (['queued', 'processing', 'rendering'].includes(session.status)) {
            setTimeout(poll, 2000); // Poll every 2 seconds
          } else {
            // Session complete or failed
            if (session.status === 'completed') {
              setSessionHistory([session, ...sessionHistory]);
            }
          }
        }
      } catch (error) {
        console.error('Failed to poll session status:', error);
      }
    };

    poll();
  };

  const handleCancelSession = async () => {
    if (currentSession) {
      try {
        await fetch(`/api/tryon/sessions/${currentSession.id}/cancel`, {
          method: 'POST'
        });
        
        toast({
          title: "Session cancelled",
          description: "Your credits have been refunded"
        });
      } catch (error) {
        console.error('Failed to cancel session:', error);
      }
    }
    
    setShowProcessingModal(false);
    setCurrentSession(null);
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await fetch(`/api/tryon/photos/${photoId}`, {
        method: 'DELETE'
      });
      
      setUserPhotos(userPhotos.filter(p => p.id !== photoId));
      if (selectedPhoto?.id === photoId) {
        setSelectedPhoto(null);
      }
      setPhotoLimit({ ...photoLimit, current: photoLimit.current - 1 });
      
      toast({
        title: "Photo deleted",
        description: "Photo has been removed from your collection"
      });
    } catch (error) {
      toast({
        title: "Failed to delete photo",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-white/10 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={18} className="mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Camera size={20} className="text-accent" />
              <h1 className="text-lg font-serif font-bold">AI Virtual Try-On Studio</h1>
              <Badge variant="secondary" className="text-xs">Photo-First</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Credits: <span className="font-bold text-foreground">45</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content - Three Panel Layout */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
          {/* Left Panel - Photo Selector */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="bg-card border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Your Photos</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {photoLimit.current}/{photoLimit.limit}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Upload Photo Button */}
                <Button
                  variant="outline"
                  className="w-full border-dashed border-accent/50 hover:border-accent hover:bg-accent/10"
                  onClick={() => setShowPhotoUploader(true)}
                  disabled={photoLimit.current >= photoLimit.limit}
                >
                  <ImageIcon size={16} className="mr-2" />
                  Upload Photo
                </Button>

                {photoLimit.current >= photoLimit.limit && (
                  <p className="text-xs text-center text-muted-foreground">
                    <Link href="/pricing" className="text-accent hover:underline">
                      Upgrade to Pro
                    </Link>{" "}
                    for unlimited photos
                  </p>
                )}

                {/* Photo List */}
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {userPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all relative",
                        selectedPhoto?.id === photo.id
                          ? "border-accent bg-accent/10"
                          : "border-white/10 hover:border-white/20"
                      )}
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <div className="aspect-square bg-white/5 rounded-md mb-2 overflow-hidden">
                        <img
                          src={photo.thumbnailUrl}
                          alt={`Photo ${photo.type}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium capitalize">{photo.type} View</p>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={photo.processed ? "default" : "secondary"} 
                            className="text-xs"
                          >
                            {photo.processed ? "Processed" : "Processing"}
                          </Badge>
                          {photo.smplData?.confidence && (
                            <span className="text-xs text-muted-foreground">
                              {Math.round(photo.smplData.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 bg-black/50 hover:bg-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          // handleDeletePhoto(photo.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                  
                  {userPhotos.length === 0 && (
                    <div className="text-center py-8">
                      <User size={48} className="mx-auto text-white/10 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No photos yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload a photo to get started
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - AI Preview */}
          <div className="lg:col-span-6">
            <Card className="bg-card border-white/10 h-full">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>AI Try-On Preview</span>
                  {currentSession && (
                    <Badge variant="outline" className="text-xs">
                      {currentSession.processingMode || 'LAMBDA'} Processing
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-5rem)]">
                <div className="w-full h-full bg-black/40 rounded-lg flex items-center justify-center relative overflow-hidden">
                  {selectedPhoto && selectedGarments.length > 0 ? (
                    <TryonPreview
                      photo={selectedPhoto}
                      session={currentSession}
                      selectedGarments={selectedGarments}
                      garments={wardrobe}
                      onRetry={() => {
                        if (currentSession) {
                          handleStartTryon();
                        }
                      }}
                      onDownload={() => {
                        if (currentSession?.resultUrl) {
                          const a = document.createElement('a');
                          a.href = currentSession.resultUrl;
                          a.download = `tryon-result-${currentSession.id}.jpg`;
                          a.click();
                        }
                      }}
                      onFullscreen={() => {
                        if (currentSession?.resultUrl) {
                          window.open(currentSession.resultUrl, '_blank');
                        }
                      }}
                    />
                  ) : selectedPhoto ? (
                    <div className="text-center space-y-4 relative">
                      <div className="relative max-w-full max-h-[80%] mx-auto">
                        <img 
                          src={selectedPhoto.url || selectedPhoto.thumbnailUrl} 
                          alt="Selected photo" 
                          className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            // Use a better person placeholder
                            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDMwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjMzc0MTUxIi8+CjxjaXJjbGUgY3g9IjE1MCIgY3k9IjEyMCIgcj0iNDAiIGZpbGw9IiM2QjcyODAiLz4KPHBhdGggZD0iTTkwIDMwMEM5MCAyNTUgMTE1IDIyMCAxNTAgMjIwUzIxMCAyNTUgMjEwIDMwMFY0MDBIOTBWMzAwWiIgZmlsbD0iIzZCNzI4MCIvPgo8dGV4dCB4PSIxNTAiIHk9IjM1MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzlDQTNBRiIgZm9udC1zaXplPSIxNCI+UGhvdG8gUGxhY2Vob2xkZXI8L3RleHQ+Cjwvc3ZnPgo=';
                          }}
                        />
                        {/* Photo Info Overlay */}
                        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                          {selectedPhoto.type} • {selectedPhoto.processed ? 'Processed' : 'Processing...'}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-muted-foreground">Select garments to start try-on</p>
                        {selectedGarments.length > 0 && (
                          <p className="text-sm text-accent">
                            {selectedGarments.length} garment{selectedGarments.length > 1 ? 's' : ''} selected
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <TryonPreview
                      photo={selectedPhoto}
                      session={currentSession}
                      selectedGarments={selectedGarments}
                      garments={wardrobe}
                      onRetry={() => {
                        if (currentSession) {
                          handleStartTryon();
                        }
                      }}
                      onDownload={() => {
                        if (currentSession?.resultUrl) {
                          const a = document.createElement('a');
                          a.href = currentSession.resultUrl;
                          a.download = `tryon-result-${currentSession.id}.jpg`;
                          a.click();
                        }
                      }}
                      onFullscreen={() => {
                        // TODO: Implement fullscreen view
                      }}
                    />
                  )}
                  
                  {/* Processing Overlay */}
                  {currentSession && ['queued', 'processing', 'rendering'].includes(currentSession.status) && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-center space-y-3">
                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-sm text-white">
                          {currentSession.status === 'processing' && 'Processing photo and pose estimation...'}
                          {currentSession.status === 'ai-rendering' && 'AI rendering in progress...'}
                          {currentSession.status === 'finalizing' && 'Finalizing your try-on...'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Progress: {currentSession.progress}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="mt-4 flex gap-3">
              <Button
                size="lg"
                className="flex-1 bg-accent text-accent-foreground hover:bg-white hover:text-black"
                disabled={!selectedPhoto || selectedGarments.length === 0 || (!!currentSession && ['processing', 'pose-estimation', 'smpl-generation', 'guidance-creation', 'ai-rendering', 'finalizing'].includes(currentSession.status))}
                onClick={handleStartTryon}
              >
                <Sparkles size={18} className="mr-2" />
                {currentSession && ['queued', 'processing', 'rendering'].includes(currentSession.status) 
                  ? 'Processing...' 
                  : 'Generate Try-On'
                }
              </Button>
              

            </div>
          </div>

          {/* Right Panel - Wardrobe */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="bg-card border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Wardrobe</span>
                  <Button variant="ghost" size="sm" onClick={() => setShowGarmentUploader(true)}>
                    <Upload size={14} className="mr-2" />
                    Upload
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[70vh] overflow-y-auto">
                  {wardrobe.length === 0 ? (
                    <div className="text-center py-8">
                      <Upload size={48} className="mx-auto text-white/10 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No garments yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Upload images to get started
                      </p>
                    </div>
                  ) : (
                    wardrobe.map((garment) => (
                      <div
                        key={garment.id}
                        className={cn(
                          "p-2 rounded-lg border cursor-pointer transition-all group relative",
                          selectedGarments.includes(garment.id)
                            ? "border-accent bg-accent/10"
                            : "border-white/10 hover:border-white/20"
                        )}
                        onClick={() => {
                          setSelectedGarments((prev) =>
                            prev.includes(garment.id)
                              ? prev.filter((id) => id !== garment.id)
                              : [...prev, garment.id]
                          );
                        }}
                      >
                        <div className="aspect-square bg-white/5 rounded mb-1 relative overflow-hidden">
                          <img
                            src={garment.imageUrl || garment.thumbnailUrl}
                            alt={garment.name}
                            className="w-full h-full object-cover rounded transition-transform group-hover:scale-105"
                            onError={(e) => {
                              const img = e.target as HTMLImageElement;
                              // Use a simple gradient placeholder
                              img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjMzc0MTUxIi8+CjxwYXRoIGQ9Ik0xMiAxNUwyOCAyNSIgc3Ryb2tlPSIjNkI3MjgwIiBzdHJva2Utd2lkdGg9IjIiLz4KPHBhdGggZD0iTTI4IDE1TDEyIDI1IiBzdHJva2U9IiM2QjcyODAiIHN0cm9rZS13aWR0aD0iMiIvPgo8L3N2Zz4K';
                            }}
                          />
                          {/* Preview Overlay */}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ImageIcon size={20} className="text-white" />
                          </div>
                          {/* Selection Indicator */}
                          {selectedGarments.includes(garment.id) && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                              <Check size={14} className="text-accent-foreground" />
                            </div>
                          )}
                        </div>
                        <p className="text-xs font-medium">{garment.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <span
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded",
                              garment.isOverlayable
                                ? "bg-green-500/20 text-green-400"
                                : "bg-blue-500/20 text-blue-400"
                            )}
                          >
                            {garment.isOverlayable ? "Overlay" : "AI Prompt"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>



      {/* Garment Uploader Modal */}
      {showGarmentUploader && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <GarmentUploader
            onUploadComplete={handleGarmentUpload}
            onClose={() => setShowGarmentUploader(false)}
          />
        </div>
      )}


    </div>
  );
}
