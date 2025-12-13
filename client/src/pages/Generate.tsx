import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Sparkles, Coins, Download, Loader2, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";
import { useToast } from "@/hooks/use-toast";

// Assets
import port1 from "@assets/generated_images/commercial_fashion_portrait_1.png";
import port2 from "@assets/generated_images/commercial_fashion_portrait_2.png";
import port3 from "@assets/generated_images/commercial_fashion_portrait_3.png";

export default function Generate() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // Generation form state
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("portrait");
  const [style, setStyle] = useState("editorial");
  const [quality, setQuality] = useState("medium");
  const [hdMode, setHdMode] = useState(false);

  const credits = user?.creditsRemaining || 0;
  const isOnTrial = user?.trialStatus === 'active';

  // Calculate credit cost based on quality and HD mode
  const calculateCreditCost = (): number => {
    const selectedQuality = hdMode ? "high" : quality;
    return selectedQuality === "high" ? 5 : selectedQuality === "medium" ? 3 : 1;
  };

  // Poll generation status
  useEffect(() => {
    if (!currentGenerationId) return;

    const pollInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const response = await fetch(`/api/generation/${currentGenerationId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          console.error("Failed to fetch generation status");
          return;
        }

        const data = await response.json();

        if (data.generation.status === "completed") {
          setGeneratedImageUrl(data.generation.imageUrl);
          setIsGenerating(false);
          setCurrentGenerationId(null);
          clearInterval(pollInterval);
        } else if (data.generation.status === "failed") {
          console.error("Generation failed");
          toast({
            title: "Generation Failed",
            description: "Your generation failed. Please try again.",
            variant: "destructive",
          });
          setIsGenerating(false);
          setCurrentGenerationId(null);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("Error polling generation:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [currentGenerationId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Prompt Required",
        description: "Please enter a prompt to generate your model.",
        variant: "destructive",
      });
      return;
    }

    const creditCost = calculateCreditCost();
    
    if (!isOnTrial && credits < creditCost) {
      toast({
        title: "Insufficient Credits",
        description: `You need ${creditCost} credits but only have ${credits}. Purchase more credits to continue.`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedImageUrl(null);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/generation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          style,
          quality: hdMode ? "high" : quality,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to start generation");
      }

      const data = await response.json();
      setCurrentGenerationId(data.id);
      
      // Refresh credits immediately since backend has deducted them
      await refreshUser();
    } catch (error) {
      console.error("Error starting generation:", error);
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to start generation. Please try again.",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  };

  const handleDownload = async (imageUrl: string, generationId: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `garmax-${generationId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        title: "Download Failed",
        description: "Failed to download image. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-white/10 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          {/* Left side: Navigation */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={18} className="mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-accent" />
              <h1 className="text-lg font-serif font-bold">AI Model Generator</h1>
            </div>
          </div>

          {/* Right side: Credits + UserMenu */}
          <div className="flex items-center gap-4">
            {!isOnTrial && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                <Coins size={16} className="text-accent" />
                <span className="text-sm">
                  <span className="font-bold text-foreground">{credits}</span>
                  <span className="text-muted-foreground ml-1">credits</span>
                </span>
              </div>
            )}
            {isOnTrial && (
              <Badge variant="secondary" className="text-xs">
                Trial Active
              </Badge>
            )}
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Controls */}
      <div className="lg:col-span-1 space-y-6 p-6 rounded-xl border border-white/10 bg-card/30 h-fit">
        <div className="space-y-3">
          <Label>Prompt</Label>
          <Textarea 
            placeholder="Describe your model (e.g. 'Scandinavian female model, minimal makeup, wearing beige trench coat, studio lighting')..." 
            className="min-h-[120px] bg-black/20 border-white/10 focus:border-accent/50"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isGenerating}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Aspect Ratio</Label>
            <Select value={aspectRatio} onValueChange={setAspectRatio} disabled={isGenerating}>
              <SelectTrigger className="bg-black/20 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="portrait">Portrait (3:4)</SelectItem>
                <SelectItem value="landscape">Landscape (16:9)</SelectItem>
                <SelectItem value="square">Square (1:1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Style</Label>
            <Select value={style} onValueChange={setStyle} disabled={isGenerating}>
              <SelectTrigger className="bg-black/20 border-white/10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="editorial">Editorial</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="street">Streetwear</SelectItem>
                <SelectItem value="candid">Candid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Quality</Label>
            <span className="text-xs text-muted-foreground capitalize">{quality}</span>
          </div>
          <Select value={quality} onValueChange={setQuality} disabled={isGenerating}>
            <SelectTrigger className="bg-black/20 border-white/10"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low (20 steps)</SelectItem>
              <SelectItem value="medium">Medium (28 steps)</SelectItem>
              <SelectItem value="high">High (40 steps)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between py-2">
          <Label htmlFor="hd-mode">High Definition Mode (4K)</Label>
          <Switch id="hd-mode" checked={hdMode} onCheckedChange={setHdMode} disabled={isGenerating} />
        </div>

        <Button 
          size="lg" 
          className="w-full bg-accent text-accent-foreground hover:bg-white hover:text-black transition-all"
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim() || (!isOnTrial && credits < calculateCreditCost())}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              Generate Model
              {!isOnTrial && (
                <span className="ml-2 flex items-center gap-1">
                  <Coins size={14} />
                  {calculateCreditCost()}
                </span>
              )}
              <Sparkles size={16} className="ml-2" />
            </>
          )}
        </Button>

        {!isOnTrial && credits < calculateCreditCost() && (
          <p className="text-sm text-center text-destructive">
            Insufficient credits. <Link href="/pricing" className="underline">Get more credits</Link>
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="lg:col-span-2 space-y-4">
        <div className="aspect-[4/3] rounded-xl overflow-hidden bg-black/20 border border-white/10 relative">
          {generatedImageUrl ? (
            <div className="relative w-full h-full group">
              <img 
                src={generatedImageUrl} 
                alt="Generated" 
                className="w-full h-full object-contain p-4"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => currentGenerationId && handleDownload(generatedImageUrl, currentGenerationId)}
                >
                  <Download size={16} className="mr-2"/> Download
                </Button>
              </div>
            </div>
          ) : isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-muted-foreground">Generating your model...</p>
              <p className="text-sm text-muted-foreground/60 mt-1">This may take 10-30 seconds</p>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <Sparkles size={48} className="text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">Your generated model will appear here</h3>
              <p className="text-sm text-muted-foreground">
                Fill in the prompt and click "Generate Model" to create AI-powered fashion imagery
              </p>
            </div>
          )}
        </div>

        {/* Inspiration Gallery */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Need Inspiration?</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="aspect-[3/4] rounded-lg overflow-hidden border border-white/10 relative group cursor-pointer hover:border-accent/50 transition-all">
              <img src={port1} alt="Example 1" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <p className="text-xs text-white">Editorial Style</p>
              </div>
            </div>
            <div className="aspect-[3/4] rounded-lg overflow-hidden border border-white/10 relative group cursor-pointer hover:border-accent/50 transition-all">
              <img src={port2} alt="Example 2" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <p className="text-xs text-white">Commercial Look</p>
              </div>
            </div>
            <div className="aspect-[3/4] rounded-lg overflow-hidden border border-white/10 relative group cursor-pointer hover:border-accent/50 transition-all">
              <img src={port3} alt="Example 3" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                <p className="text-xs text-white">Natural Portrait</p>
              </div>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
