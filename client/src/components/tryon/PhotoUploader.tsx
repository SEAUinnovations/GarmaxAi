import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Image as ImageIcon, X, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface PhotoUploaderProps {
  onUpload: (file: File, type: 'front' | 'side' | 'full-body') => Promise<void>;
  onClose: () => void;
  maxFiles: number;
}

function PhotoUploader({ onUpload, onClose, maxFiles }: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [photoType, setPhotoType] = useState<'front' | 'side' | 'full-body'>('front');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  
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
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select a valid image file",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 10MB",
        variant: "destructive"
      });
      return;
    }

    setSelectedFile(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      await onUpload(selectedFile, photoType);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setTimeout(() => {
        onClose();
      }, 500);

    } catch (error) {
      setIsUploading(false);
      setUploadProgress(0);
      console.error('Upload failed:', error);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Photo Type Selection */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Photo Type</Label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'front', label: 'Front View', description: 'Face forward, arms at sides' },
            { value: 'side', label: 'Side View', description: 'Profile view, optional' },
            { value: 'full-body', label: 'Full Body', description: 'Full body visible' }
          ].map(({ value, label, description }) => (
            <div
              key={value}
              className={cn(
                "p-3 rounded-lg border cursor-pointer transition-all text-center",
                photoType === value
                  ? "border-accent bg-accent/10"
                  : "border-white/10 hover:border-white/20"
              )}
              onClick={() => setPhotoType(value as any)}
            >
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* File Upload Area */}
      <div className="space-y-4">
        {!selectedFile ? (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all",
              isDragging
                ? "border-accent bg-accent/10"
                : "border-white/20 hover:border-accent/50"
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon size={48} className="mx-auto mb-4 text-white/20" />
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Upload Your Photo</h3>
              <p className="text-muted-foreground">Drag and drop or click to select</p>
              <p className="text-sm text-muted-foreground">
                Supports JPG, PNG, WebP • Max 10MB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview */}
            <div className="relative">
              <div className="aspect-[3/4] bg-white/5 rounded-lg overflow-hidden">
                <img
                  src={previewUrl!}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8 bg-black/50 hover:bg-destructive"
                onClick={handleReset}
              >
                <X size={16} />
              </Button>
            </div>

            {/* File Info */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
              <div>
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB • {photoType} view
                </p>
              </div>
              <Badge variant="outline">{photoType}</Badge>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Uploading...</span>
              <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="p-4 bg-accent/5 border border-accent/20 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-accent mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-accent">Tips for Best Results</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Use good lighting with minimal shadows</li>
              <li>• Stand against a plain background</li>
              <li>• Wear form-fitting clothes for better pose detection</li>
              <li>• Ensure your full body is visible in the frame</li>
              <li>• Face the camera directly for front view photos</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || maxFiles <= 0}
          className="flex-1"
        >
          {isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Upload size={16} className="mr-2" />
              Upload Photo
            </>
          )}
        </Button>
      </div>

      {maxFiles <= 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Photo limit reached. Delete existing photos or upgrade your plan.
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileSelect(file);
        }}
      />
    </div>
  );
}

export default PhotoUploader;