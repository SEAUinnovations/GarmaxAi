import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Link as LinkIcon, X, Image as ImageIcon, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

interface GarmentUploaderProps {
  onUploadComplete?: (garment: any) => void;
  onClose?: () => void;
}

export default function GarmentUploader({ onUploadComplete, onClose }: GarmentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedGarment, setUploadedGarment] = useState<any | null>(null);
  const [isOverlayOverride, setIsOverlayOverride] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find((file) =>
      file.type.startsWith("image/")
    );

    if (imageFile) {
      setSelectedFile(imageFile);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile && !urlInput.trim()) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (uploadMode === "file" && selectedFile) {
        // Simulate upload progress
        const formData = new FormData();
        formData.append("image", selectedFile);

        // TODO: Replace with actual API call
        const interval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(interval);
              return prev;
            }
            return prev + 10;
          });
        }, 200);

        // Mock API response
        await new Promise((resolve) => setTimeout(resolve, 2000));
        clearInterval(interval);
        setUploadProgress(100);

        const mockGarment = {
          id: `garment_${Date.now()}`,
          name: selectedFile.name.replace(/\.[^/.]+$/, ""),
          imageUrl: URL.createObjectURL(selectedFile),
          isOverlayable: Math.random() > 0.5,
          garmentType: "shirt",
          detectedColor: "#3B82F6",
          confidence: 0.92,
        };

        setUploadedGarment(mockGarment);
        onUploadComplete?.(mockGarment);
      } else if (uploadMode === "url" && urlInput.trim()) {
        // TODO: API call for URL analysis
        setUploadProgress(50);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setUploadProgress(100);

        const mockGarment = {
          id: `garment_${Date.now()}`,
          name: "Imported Garment",
          imageUrl: urlInput,
          isOverlayable: false,
          garmentType: "dress",
          detectedColor: "#EC4899",
          confidence: 0.87,
        };

        setUploadedGarment(mockGarment);
        onUploadComplete?.(mockGarment);
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleOverlay = async () => {
    if (!uploadedGarment) return;

    const newValue = !isOverlayOverride;
    setIsOverlayOverride(newValue);

    // TODO: Update garment in database
    setUploadedGarment({
      ...uploadedGarment,
      isOverlayable: newValue,
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUrlInput("");
    setUploadProgress(0);
    setUploadedGarment(null);
    setIsOverlayOverride(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <Card className="bg-card border-white/10 max-w-2xl w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold">Add Garment</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>

          {!uploadedGarment ? (
            <>
              {/* Upload Mode Toggle */}
              <div className="flex gap-2 mb-6">
                <Button
                  variant={uploadMode === "file" ? "default" : "outline"}
                  onClick={() => setUploadMode("file")}
                  className="flex-1"
                >
                  <Upload size={16} className="mr-2" />
                  Upload File
                </Button>
                <Button
                  variant={uploadMode === "url" ? "default" : "outline"}
                  onClick={() => setUploadMode("url")}
                  className="flex-1"
                >
                  <LinkIcon size={16} className="mr-2" />
                  From URL
                </Button>
              </div>

              {uploadMode === "file" ? (
                <>
                  {/* Drag & Drop Zone */}
                  <div
                    className={cn(
                      "border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer",
                      isDragging
                        ? "border-accent bg-accent/10"
                        : "border-white/10 hover:border-white/20",
                      selectedFile && "border-accent bg-accent/5"
                    )}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedFile ? (
                      <div className="space-y-4">
                        <div className="w-32 h-32 mx-auto rounded-lg overflow-hidden bg-white/5">
                          <img
                            src={URL.createObjectURL(selectedFile)}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-medium">{selectedFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                        >
                          <X size={14} className="mr-2" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <>
                        <ImageIcon size={48} className="mx-auto mb-4 text-white/20" />
                        <p className="text-lg font-medium mb-2">
                          Drop garment image here
                        </p>
                        <p className="text-sm text-muted-foreground mb-4">
                          or click to browse files
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Supports JPG, PNG, WebP up to 10MB
                        </p>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </>
              ) : (
                <>
                  {/* URL Input */}
                  <div className="space-y-2 mb-6">
                    <Label htmlFor="garment-url">Garment Image URL</Label>
                    <Input
                      id="garment-url"
                      type="url"
                      placeholder="https://example.com/garment.jpg"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste a direct link to a garment image from any website
                    </p>
                  </div>

                  {urlInput && (
                    <div className="rounded-lg overflow-hidden bg-white/5 max-h-64 flex items-center justify-center">
                      <img
                        src={urlInput}
                        alt="URL Preview"
                        className="max-w-full max-h-64 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-6 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Analyzing garment...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={(!selectedFile && !urlInput.trim()) || isUploading}
                  className="flex-1 bg-accent text-accent-foreground hover:bg-white hover:text-black"
                >
                  {isUploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Check size={16} className="mr-2" />
                      Add to Wardrobe
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Upload Success View */}
              <div className="space-y-6">
                <div className="flex gap-6">
                  <div className="w-48 h-48 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                    <img
                      src={uploadedGarment.imageUrl}
                      alt={uploadedGarment.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{uploadedGarment.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Type: <span className="capitalize">{uploadedGarment.garmentType}</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Confidence: {(uploadedGarment.confidence * 100).toFixed(0)}%
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm mb-2 block">Rendering Mode</Label>
                        <div
                          className={cn(
                            "p-3 rounded-lg border",
                            uploadedGarment.isOverlayable
                              ? "border-green-500/50 bg-green-500/10"
                              : "border-blue-500/50 bg-blue-500/10"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {uploadedGarment.isOverlayable ? (
                              <Check size={16} className="text-green-400" />
                            ) : (
                              <Sparkles size={16} className="text-blue-400" />
                            )}
                            <span className="font-medium">
                              {uploadedGarment.isOverlayable ? "3D Overlay" : "AI Prompt Rendering"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {uploadedGarment.isOverlayable
                              ? "Fast texture mapping for simple garments (10 credits)"
                              : "AI-powered rendering for complex patterns (15+ credits)"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                        <div>
                          <Label htmlFor="overlay-toggle" className="text-sm cursor-pointer">
                            Force AI Rendering
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Override automatic detection
                          </p>
                        </div>
                        <Switch
                          id="overlay-toggle"
                          checked={!uploadedGarment.isOverlayable}
                          onCheckedChange={handleToggleOverlay}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleReset} className="flex-1">
                    Add Another
                  </Button>
                  <Button
                    onClick={onClose}
                    className="flex-1 bg-accent text-accent-foreground hover:bg-white hover:text-black"
                  >
                    Done
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
