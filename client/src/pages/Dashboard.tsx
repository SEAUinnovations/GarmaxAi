import { Link } from "wouter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, Download, Grid, LayoutDashboard, Settings, LogOut, Plus, History, User, Sparkles, CreditCard, Coins, Lock, Zap, Clock } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";

// Assets
import port1 from "@assets/generated_images/commercial_fashion_portrait_1.png";
import port2 from "@assets/generated_images/commercial_fashion_portrait_2.png";
import port3 from "@assets/generated_images/commercial_fashion_portrait_3.png";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"generate" | "history" | "tryon">("generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [userPlan] = useState<"free" | "studio" | "pro">("free");
  const [credits, setCredits] = useState(0);
  const [tryonQuota] = useState({ used: 0, limit: 0 });
  const [trialStatus, setTrialStatus] = useState<string | null>(null);
  const [isOnTrial, setIsOnTrial] = useState(false);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);

  // Generation form state
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("portrait");
  const [style, setStyle] = useState("editorial");
  const [quality, setQuality] = useState("medium");
  const [hdMode, setHdMode] = useState(false);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem("auth_token");
        const response = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const userData = await response.json();
          setCredits(userData.creditsRemaining || 0);
          setTrialStatus(userData.trialStatus);
          setIsOnTrial(userData.trialStatus === 'active');
          setTrialExpiresAt(userData.trialExpiresAt);
          
          // Calculate days remaining
          if (userData.trialStatus === 'active' && userData.trialExpiresAt) {
            const now = new Date();
            const expiresAt = new Date(userData.trialExpiresAt);
            const diffTime = expiresAt.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysRemaining(diffDays > 0 ? diffDays : 0);
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUserData();
  }, []);

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
          // Refresh user credits after generation completes
          const token = localStorage.getItem("auth_token");
          const userResponse = await fetch("/api/auth/me", {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            setCredits(userData.creditsRemaining || 0);
          }
        } else if (data.generation.status === "failed") {
          console.error("Generation failed");
          alert("Generation failed. Please try again.");
          setIsGenerating(false);
          setCurrentGenerationId(null);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error("Error polling generation:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [currentGenerationId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert("Please enter a prompt");
      return;
    }

    const creditCost = calculateCreditCost();
    
    // Check if user has enough credits (only if not on trial)
    if (!isOnTrial && credits < creditCost) {
      alert(`Insufficient credits. You need ${creditCost} credits but only have ${credits}.`);
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
        const error = await response.json();
        throw new Error(error.message || "Failed to start generation");
      }

      const data = await response.json();
      setCurrentGenerationId(data.id);
    } catch (error) {
      console.error("Error starting generation:", error);
      alert(error instanceof Error ? error.message : "Failed to start generation");
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-card flex-col hidden md:flex">
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo3.jpg" alt="Garmax" className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="font-serif text-xl font-bold">Garmax</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Button 
            variant={activeTab === "generate" ? "secondary" : "ghost"} 
            className="w-full justify-start" 
            onClick={() => setActiveTab("generate")}
          >
            <Plus size={18} className="mr-2" /> New Model
          </Button>
          <Link href="/virtual-tryon" className="w-full">
            <Button variant="ghost" className="w-full justify-start">
              <Camera size={18} className="mr-2" /> 3D Try-On Studio
            </Button>
          </Link>
          <Button 
            variant={activeTab === "history" ? "secondary" : "ghost"} 
            className="w-full justify-start"
            onClick={() => setActiveTab("history")}
          >
            <History size={18} className="mr-2" /> History
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Grid size={18} className="mr-2" /> Collections
          </Button>
        </nav>
        <div className="p-4 border-t border-white/10 space-y-2">
          <Link href="/account" className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start")}>
            <Settings size={18} className="mr-2" /> Settings
          </Link>
           <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10")}>
              <LogOut size={18} className="mr-2" /> Log Out
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 bg-card/50 backdrop-blur-sm">
          <h1 className="text-lg font-medium capitalize">{activeTab === 'generate' ? 'Create New Model' : 'Generation History'}</h1>
          <div className="flex items-center gap-4">
            {/* Unified Balance Widget */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
              <div className="flex items-center gap-2">
                <Coins size={16} className="text-accent" />
                <span className="text-sm">
                  <span className="font-bold text-foreground">{credits}</span>
                  <span className="text-muted-foreground ml-1">credits</span>
                </span>
              </div>
              <div className="h-4 w-px bg-white/20" />
              <div className="flex items-center gap-2">
                <Camera size={16} className="text-blue-400" />
                <span className="text-sm">
                  <span className="font-bold text-foreground">{tryonQuota.used}/{tryonQuota.limit || 0}</span>
                  <span className="text-muted-foreground ml-1">try-ons</span>
                </span>
              </div>
              <Link href="/pricing">
                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-accent/10">
                  <Plus size={12} />
                </Button>
              </Link>
            </div>
            
            <UserMenu />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {/* Trial Countdown Banner */}
          {isOnTrial && daysRemaining !== null && (
            <Alert className="mb-6 border-amber-500/50 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">
                  <span className="font-semibold text-amber-500">
                    {daysRemaining === 0 
                      ? "Trial expires today!" 
                      : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} left in your trial`}
                  </span>
                  <span className="text-muted-foreground ml-2">
                    Upgrade to keep unlimited access and avoid automatic conversion.
                  </span>
                </span>
                <Link href="/pricing">
                  <Button size="sm" variant="default" className="ml-4 bg-amber-500 hover:bg-amber-600">
                    Upgrade Now
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}
          
          {/* 3D Try-On Studio CTA */}
          <Card className="mb-6 border-accent/50 bg-gradient-to-br from-accent/20 to-accent/5 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-accent text-accent-foreground">New</Badge>
                    {userPlan === "free" && (
                      <Badge variant="outline" className="border-yellow-500/50 text-yellow-400">
                        <Lock size={12} className="mr-1" />
                        Premium
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl font-serif font-bold mb-2">
                    3D Virtual Try-On Studio
                  </h2>
                  <p className="text-muted-foreground mb-4 max-w-xl">
                    Create custom 3D avatars and try on garments in real-time. Upload your own clothes or paste product URLs for instant virtual fitting.
                  </p>
                  <div className="flex items-center gap-3">
                    <Link href={userPlan === "free" ? "/pricing" : "/virtual-tryon"}>
                      <Button
                        size="lg"
                        className="bg-accent text-accent-foreground hover:bg-white hover:text-black"
                      >
                        {userPlan === "free" ? (
                          <>
                            <Lock size={18} className="mr-2" />
                            Upgrade to Access
                          </>
                        ) : (
                          <>
                            <Camera size={18} className="mr-2" />
                            Launch 3D Studio
                          </>
                        )}
                      </Button>
                    </Link>
                    {userPlan === "free" && (
                      <p className="text-sm text-muted-foreground">
                        Starting at <span className="text-accent font-bold">$29/mo</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="hidden lg:block">
                  <div className="relative w-48 h-48 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <Camera size={64} className="text-accent/40" />
                    <div className="absolute -top-2 -right-2">
                      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center">
                        <Sparkles size={20} className="text-accent-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {activeTab === "generate" ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              
              {/* Controls */}
              <div className="lg:col-span-1 space-y-6 p-6 rounded-xl border border-white/10 bg-card/30 h-fit">
                <div className="space-y-3">
                  <Label>Prompt</Label>
                  <Textarea 
                    placeholder="Describe your model (e.g. 'Scandinavian female model, minimal makeup, wearing beige trench coat, studio lighting')..." 
                    className="min-h-[120px] bg-black/20 border-white/10 focus:border-accent/50"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aspect Ratio</Label>
                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
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
                    <Select value={style} onValueChange={setStyle}>
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
                  <Select value={quality} onValueChange={setQuality}>
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
                  <Switch id="hd-mode" checked={hdMode} onCheckedChange={setHdMode} />
                </div>

                <Button 
                  size="lg" 
                  className="w-full bg-accent text-accent-foreground hover:bg-white hover:text-black transition-all"
                  onClick={handleGenerate}
                  disabled={isGenerating || (!isOnTrial && credits < calculateCreditCost())}
                >
                  {isGenerating ? (
                    <>Generating <span className="animate-pulse ml-1">...</span></>
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
              </div>

              {/* Preview Area */}
              <div className="lg:col-span-2 rounded-xl border border-white/10 bg-black/40 flex items-center justify-center relative overflow-hidden min-h-[500px]">
                {isGenerating ? (
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 border-4 border-white/10 border-t-accent rounded-full animate-spin mx-auto"/>
                    <p className="text-muted-foreground animate-pulse">Crafting your model...</p>
                  </div>
                ) : generatedImageUrl ? (
                  <div className="relative w-full h-full p-8 flex items-center justify-center group">
                     <img src={generatedImageUrl} className="max-h-full max-w-full object-contain shadow-2xl rounded-lg" alt="Generated Result" />
                     
                     <div className="absolute bottom-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Button variant="secondary" size="sm"><Download size={16} className="mr-2"/> Download</Button>
                        <Button variant="secondary" size="sm">Upscale</Button>
                     </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 p-8">
                    <Sparkles size={48} className="mx-auto text-muted-foreground/50" />
                    <p className="text-muted-foreground">Enter a prompt and click Generate to create your model</p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[port1, port2, port3, port1, port2, port3].map((img, i) => (
                <div key={i} className="aspect-[3/4] rounded-lg overflow-hidden relative group border border-white/10 bg-card">
                  <img src={img} className="w-full h-full object-cover" alt={`History ${i}`} />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="icon" variant="outline" className="rounded-full border-white/20 hover:bg-white hover:text-black"><Download size={16} /></Button>
                    <Button size="icon" variant="outline" className="rounded-full border-white/20 hover:bg-white hover:text-black"><Sparkles size={16} /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
