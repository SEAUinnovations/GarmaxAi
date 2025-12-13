import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, ArrowLeft, Plus, Sparkles, Upload, Trash2, X, User, Image as ImageIcon, Check, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import GarmentUploader from "@/components/tryon/GarmentUploader";
import PhotoUploader from "@/components/tryon/PhotoUploader";
import TryonPreview from "@/components/tryon/TryonPreview";
import ProcessingModal from "@/components/tryon/ProcessingModal";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";

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
  const { user } = useAuth();
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
  const [ws, setWs] = useState<WebSocket | null>(null);
  const { toast } = useToast();

  // Initialize WebSocket connection on component mount
  // WebSocket provides real-time updates for try-on session progress
  useEffect(() => {
    // Connect to WebSocket server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/tryon`;
    
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('WebSocket connected to try-on service');
      toast({
        title: "Connected",
        description: "Real-time updates enabled"
      });
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle different types of WebSocket messages
        if (data.type === 'connected') {
          console.log('WebSocket connection confirmed');
        } else if (data.sessionId) {
          // This is a session status update
          // Update current session state with new progress/status
          setCurrentSession(prev => {
            if (prev?.id === data.sessionId) {
              return {
                ...prev,
                status: data.status,
                progress: data.progress,
                previewUrl: data.previewImageUrl || prev.previewUrl,
                resultUrl: data.renderedImageUrl || prev.resultUrl,
              };
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Fallback to polling if WebSocket fails
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          window.location.reload(); // Simple reconnection strategy
        }
      }, 5000);
    };

    setWs(websocket);

    // Cleanup WebSocket on component unmount
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, []);

  useEffect(() => {
    // Load user photos and wardrobe from API
    loadUserPhotos();
    loadWardrobe();
    loadSessionHistory();
  }, []);

  const loadUserPhotos = async () => {
    try {
      // Fetch user's uploaded photos from backend API
      // GET /api/tryon/photos returns list of photos with metadata
      const response = await fetch('/api/tryon/photos', {
        credentials: 'include', // Include cookies for authentication
      });

      if (!response.ok) {
        throw new Error('Failed to fetch photos');
      }

      const data = await response.json();
      
      // Map API response to UserPhoto type
      // Response format: { photos: [{ id, url, thumbnailUrl, type, uploadedAt, processed, smplData }] }
      const photos: UserPhoto[] = data.photos.map((photo: any) => ({
        id: photo.id,
        url: photo.url,
        thumbnailUrl: photo.thumbnailUrl,
        type: photo.type,
        uploadedAt: photo.uploadedAt,
        processed: photo.processed,
        smplData: photo.smplData,
      }));

      setUserPhotos(photos);
      setPhotoLimit({ current: photos.length, limit: 3 });
    } catch (error) {
      console.error('Load photos error:', error);
      toast({
        title: "Failed to load photos",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const loadWardrobe = async () => {
    try {
      // Fetch user's garment wardrobe from backend API
      // GET /api/tryon/garment returns list of uploaded garments
      const response = await fetch('/api/tryon/garment', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch wardrobe');
      }

      const data = await response.json();
      
      // Map API response to Garment type
      // Response format: { garments: [{ id, name, type, color, imageUrl, thumbnailUrl, isOverlayable }] }
      const garments: Garment[] = data.garments.map((garment: any) => ({
        id: garment.id,
        name: garment.name,
        type: garment.type,
        color: garment.color,
        imageUrl: garment.imageUrl,
        thumbnailUrl: garment.thumbnailUrl || garment.imageUrl,
        uploadedAt: garment.createdAt,
        isOverlayable: garment.isOverlayable,
      }));

      setWardrobe(garments);
    } catch (error) {
      console.error('Load wardrobe error:', error);
      toast({
        title: "Failed to load wardrobe",
        description: "Please try again later",
        variant: "destructive"
      });
    }
  };

  const loadSessionHistory = async () => {
    try {
      // Fetch user's recent try-on sessions
      // GET /api/tryon/sessions returns paginated list of sessions
      const response = await fetch('/api/tryon/sessions?limit=10', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const data = await response.json();
      setSessionHistory(data.sessions || []);
    } catch (error) {
      console.error('Failed to load session history:', error);
    }
  };
        
  const handlePhotoUpload = async (file: File, type: 'front' | 'side' | 'full-body') => {
    try {
      setShowPhotoUploader(false);
      
      // Upload photo to backend using FormData for multipart/form-data
      // Backend endpoint: POST /api/tryon/photos/upload
      // Expects: 'photo' field (file), 'type' field (string)
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('type', type);
      
      const response = await fetch('/api/tryon/photos/upload', {
        method: 'POST',
        credentials: 'include', // Include auth cookies
        body: formData,
        // Note: Do NOT set Content-Type header - browser auto-sets with boundary
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Upload failed');
      }
      
      // Backend returns the created photo object with S3 URLs
      // Response format: { id, url, thumbnailUrl, type, uploadedAt, processed, ... }
      const newPhoto: UserPhoto = await response.json();
      
      // Update local state with new photo
      setUserPhotos([...userPhotos, newPhoto]);
      setPhotoLimit({ ...photoLimit, current: photoLimit.current + 1 });
      
      toast({
        title: "Photo uploaded successfully",
        description: "Your photo is being processed for 3D pose estimation"
      });
      
    } catch (error) {
      console.error('Photo upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Please try again with a different photo",
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
      // Create try-on session via photo-based API
      // POST /api/tryon/session/create with photoId (not avatarId)
      // Backend validates: user owns photo, photo is SMPL-processed, garments exist
      const sessionData = {
        photoId: selectedPhoto.id, // Send photoId instead of avatarId
        garmentIds: selectedGarments,
        preferences: {
          renderQuality: 'standard',
          fitPreference: 'fitted'
        }
      };

      const response = await fetch('/api/tryon/session/create', {
        method: 'POST',
        credentials: 'include', // Include auth cookies
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create try-on session');
      }

      const session: TryonSession = await response.json();
      setCurrentSession(session);
      setShowProcessingModal(true);

      // Subscribe to WebSocket updates for this session
      // Backend will broadcast status changes: queued → processing → rendering → completed
      // WebSocket already connected via useEffect, now subscribe to this specific session
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: 'subscribe',
          sessionId: session.id
        }));
      }

      // Fallback: Start polling for session status updates if WebSocket fails
      // WebSocket is preferred for real-time updates, polling as backup
      pollSessionStatus(session.id);

      toast({
        title: "Try-on session started",
        description: "Processing your photo with SMPL pose estimation"
      });

    } catch (error) {
      console.error('Start try-on error:', error);
      toast({
        title: "Failed to start try-on",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive"
      });
    }
  };

  const pollSessionStatus = async (sessionId: string) => {
    const poll = async () => {
      try {
        // GET /api/tryon/session/:sessionId/status - polling fallback for WebSocket
        const response = await fetch(`/api/tryon/session/${sessionId}/status`, {
          credentials: 'include'
        });
        
        if (response.ok) {
          const session: TryonSession = await response.json();
          setCurrentSession(session);

          // Continue polling if still processing
          // Possible statuses: queued, processing, rendering, completed, failed, cancelled
          if (['queued', 'processing', 'rendering'].includes(session.status)) {
            setTimeout(poll, 2000); // Poll every 2 seconds
          } else {
            // Session complete or failed - add to history if completed
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
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Coins size={16} className="text-accent" />
              <span className="text-sm">
                <span className="font-bold text-foreground">{user?.creditsRemaining || 0}</span>
                <span className="text-muted-foreground ml-1">credits</span>
              </span>
            </div>
            <UserMenu />
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
