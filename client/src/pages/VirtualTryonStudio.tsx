import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, ArrowLeft, Plus, Sparkles, Upload, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import GarmentUploader from "@/components/tryon/GarmentUploader";
import TryonCanvas from "@/components/tryon/TryonCanvas";
import ProcessingModal from "@/components/tryon/ProcessingModal";

export default function VirtualTryonStudio() {
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [selectedGarments, setSelectedGarments] = useState<string[]>([]);
  const [avatars, setAvatars] = useState<any[]>([]);
  const [wardrobe, setWardrobe] = useState<any[]>([]);
  const [avatarLimit, setAvatarLimit] = useState({ current: 0, limit: 1 });
  const [showRpmModal, setShowRpmModal] = useState(false);
  const [showGarmentUploader, setShowGarmentUploader] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<any>(null);
  const [rpmIframeUrl] = useState("https://demo.readyplayer.me/avatar?frameApi");

  useEffect(() => {
    // TODO: Fetch avatars from API
    // fetchAvatars();
    // fetchWardrobe();
  }, []);

  // Ready Player Me message handler
  useEffect(() => {
    const handleRpmMessage = (event: MessageEvent) => {
      // Verify message is from Ready Player Me
      if (event.data?.source !== "readyplayerme") return;

      // Avatar exported successfully
      if (event.data.eventName === "v1.avatar.exported") {
        const avatarUrl = event.data.data.url; // .glb file URL
        console.log("Avatar created:", avatarUrl);
        
        // Create avatar object
        const newAvatar = {
          id: `avatar_${Date.now()}`,
          rpmAvatarId: avatarUrl,
          thumbnailUrl: avatarUrl.replace(".glb", ".png"), // RPM provides thumbnails
          createdAt: new Date().toISOString(),
        };

        // Add to avatars list
        setAvatars([...avatars, newAvatar]);
        setAvatarLimit({ ...avatarLimit, current: avatarLimit.current + 1 });
        
        // TODO: Save to backend
        // await fetch('/api/tryon/avatars', {
        //   method: 'POST',
        //   body: JSON.stringify({ rpmAvatarId: avatarUrl })
        // });
        
        setShowRpmModal(false);
      }

      // User closed the editor
      if (event.data.eventName === "v1.frame.ready") {
        console.log("Ready Player Me iframe ready");
      }
    };

    window.addEventListener("message", handleRpmMessage);
    return () => window.removeEventListener("message", handleRpmMessage);
  }, [avatars, avatarLimit]);

  const handleStartTryon = async () => {
    if (!selectedAvatar || selectedGarments.length === 0) return;

    // TODO: Create try-on session via API
    setProcessingStatus({
      sessionId: `session_${Date.now()}`,
      status: "queued",
      progress: 0,
    });
    setShowProcessingModal(true);

    // Simulate processing
    setTimeout(() => {
      setProcessingStatus({ sessionId: `session_${Date.now()}`, status: "processing", progress: 25 });
    }, 2000);
    setTimeout(() => {
      setProcessingStatus({ sessionId: `session_${Date.now()}`, status: "processing", progress: 75 });
    }, 4000);
    setTimeout(() => {
      setProcessingStatus({
        sessionId: `session_${Date.now()}`,
        status: "preview",
        previewUrl: "https://via.placeholder.com/800x600/1a1a1a/8B5CF6?text=Preview",
      });
    }, 6000);
  };

  const handleConfirmPreview = async () => {
    setProcessingStatus({ ...processingStatus, status: "rendering", progress: 0 });
    setTimeout(() => {
      setProcessingStatus({ ...processingStatus, status: "rendering", progress: 50 });
    }, 2000);
    setTimeout(() => {
      setProcessingStatus({
        ...processingStatus,
        status: "complete",
        previewUrl: "https://via.placeholder.com/800x600/1a1a1a/10B981?text=Final+Render",
      });
    }, 4000);
  };

  const handleSwitchToAI = async () => {
    // TODO: Switch to AI-only rendering
    handleConfirmPreview();
  };

  const handleCancelSession = async () => {
    // TODO: Cancel session and refund
    setShowProcessingModal(false);
    setProcessingStatus(null);
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
              <h1 className="text-lg font-serif font-bold">3D Virtual Try-On Studio</h1>
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
          {/* Left Panel - Avatar Selector */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="bg-card border-white/10">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Your Avatars</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {avatarLimit.current}/{avatarLimit.limit}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Create Avatar Button */}
                <Button
                  variant="outline"
                  className="w-full border-dashed border-accent/50 hover:border-accent hover:bg-accent/10"
                  onClick={() => setShowRpmModal(true)}
                  disabled={avatarLimit.current >= avatarLimit.limit}
                >
                  <Plus size={16} className="mr-2" />
                  Create Avatar
                </Button>

                {avatarLimit.current >= avatarLimit.limit && (
                  <p className="text-xs text-center text-muted-foreground">
                    <Link href="/pricing" className="text-accent hover:underline">
                      Upgrade to Studio
                    </Link>{" "}
                    for 3 custom avatars
                  </p>
                )}

                {/* Avatar List */}
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {/* Demo Avatar */}
                  <div
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      selectedAvatar === "demo"
                        ? "border-accent bg-accent/10"
                        : "border-white/10 hover:border-white/20"
                    )}
                    onClick={() => setSelectedAvatar("demo")}
                  >
                    <div className="aspect-square bg-white/5 rounded-md mb-2 flex items-center justify-center">
                      <Camera size={32} className="text-white/20" />
                    </div>
                    <p className="text-sm font-medium">Demo Avatar</p>
                    <p className="text-xs text-muted-foreground">Default model</p>
                  </div>

                  {avatars.map((avatar) => (
                    <div
                      key={avatar.id}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all relative",
                        selectedAvatar === avatar.id
                          ? "border-accent bg-accent/10"
                          : "border-white/10 hover:border-white/20"
                      )}
                      onClick={() => setSelectedAvatar(avatar.id)}
                    >
                      <div className="aspect-square bg-white/5 rounded-md mb-2">
                        {avatar.thumbnailUrl && (
                          <img
                            src={avatar.thumbnailUrl}
                            alt={avatar.id}
                            className="w-full h-full object-cover rounded-md"
                          />
                        )}
                      </div>
                      <p className="text-sm font-medium">Custom Avatar</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 bg-black/50 hover:bg-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          // deleteAvatar(avatar.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Center Panel - 3D Canvas */}
          <div className="lg:col-span-6">
            <Card className="bg-card border-white/10 h-full">
              <CardHeader>
                <CardTitle className="text-lg">3D Preview</CardTitle>
              </CardHeader>
              <CardContent className="h-[calc(100%-5rem)]">
                <div className="w-full h-full bg-black/40 rounded-lg flex items-center justify-center">
                  {selectedAvatar ? (
                    <TryonCanvas
                      avatarUrl={selectedAvatar === "demo" ? undefined : selectedAvatar}
                      garments={wardrobe.filter((g) => selectedGarments.includes(g.id))}
                    />
                  ) : (
                    <div className="text-center space-y-4">
                      <Camera size={64} className="mx-auto text-white/10" />
                      <p className="text-muted-foreground">Select an avatar to begin</p>
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
                disabled={!selectedAvatar || selectedGarments.length === 0}
                onClick={handleStartTryon}
              >
                <Sparkles size={18} className="mr-2" />
                Generate Try-On
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
                          "p-2 rounded-lg border cursor-pointer transition-all",
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
                        <div className="aspect-square bg-white/5 rounded mb-1">
                          <img
                            src={garment.imageUrl}
                            alt={garment.name}
                            className="w-full h-full object-cover rounded"
                          />
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

      {/* Ready Player Me Modal */}
      {showRpmModal && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
          {/* Header */}
          <div className="h-16 bg-card border-b border-white/10 flex items-center justify-between px-6">
            <h2 className="text-xl font-serif font-bold">Create Your Avatar</h2>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowRpmModal(false)}
            >
              <X size={20} />
            </Button>
          </div>
          
          {/* Ready Player Me Iframe */}
          <div className="flex-1 relative">
            <iframe
              src={rpmIframeUrl}
              allow="camera *; microphone *; clipboard-write"
              className="w-full h-full border-0"
              title="Ready Player Me Avatar Creator"
            />
          </div>
          
          {/* Info Footer */}
          <div className="h-12 bg-card/50 border-t border-white/10 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">
              Customize your avatar • No photos needed • Powered by Ready Player Me
            </p>
          </div>
        </div>
      )}

      {/* Garment Uploader */}
      {showGarmentUploader && (
        <GarmentUploader
          onUploadComplete={(garment) => {
            setWardrobe([...wardrobe, garment]);
            setShowGarmentUploader(false);
          }}
          onClose={() => setShowGarmentUploader(false)}
        />
      )}

      {/* Processing Modal */}
      {showProcessingModal && processingStatus && (
        <ProcessingModal
          sessionId={processingStatus.sessionId}
          status={processingStatus.status}
          progress={processingStatus.progress}
          previewUrl={processingStatus.previewUrl}
          onConfirm={handleConfirmPreview}
          onSwitchToAI={handleSwitchToAI}
          onCancel={handleCancelSession}
          onClose={() => setShowProcessingModal(false)}
        />
      )}
    </div>
  );
}
