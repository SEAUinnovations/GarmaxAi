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
import { Camera, Download, Grid, LayoutDashboard, Settings, LogOut, Plus, History, User, Sparkles, CreditCard, Coins, Lock, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Assets
import port1 from "@assets/generated_images/commercial_fashion_portrait_1.png";
import port2 from "@assets/generated_images/commercial_fashion_portrait_2.png";
import port3 from "@assets/generated_images/commercial_fashion_portrait_3.png";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"generate" | "history" | "tryon">("generate");
  const [isGenerating, setIsGenerating] = useState(false);
  const [userPlan] = useState<"free" | "studio" | "pro">("free"); // Mock user plan
  const [credits] = useState(240);
  const [tryonQuota] = useState({ used: 0, limit: 0 }); // Free plan

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 3000); // Mock generation
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-card flex-col hidden md:flex">
        <div className="p-6 border-b border-white/10">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-white text-black p-1 rounded-sm group-hover:bg-accent transition-colors">
              <Camera size={20} strokeWidth={2.5} />
            </div>
            <span className="font-serif text-xl font-bold">Model Me</span>
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
            
            <Link href="/account">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer">
                <User size={16} />
              </div>
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
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
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aspect Ratio</Label>
                    <Select defaultValue="portrait">
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
                    <Select defaultValue="editorial">
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
                    <Label>Creativity Level</Label>
                    <span className="text-xs text-muted-foreground">High</span>
                  </div>
                  <Slider defaultValue={[70]} max={100} step={1} className="[&>.active]:bg-accent" />
                </div>

                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="hd-mode">High Definition Mode (4K)</Label>
                  <Switch id="hd-mode" />
                </div>

                <Button 
                  size="lg" 
                  className="w-full bg-accent text-accent-foreground hover:bg-white hover:text-black transition-all"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>Generating <span className="animate-pulse ml-1">...</span></>
                  ) : (
                    <>Generate Model <Sparkles size={16} className="ml-2" /></>
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
                ) : (
                  <div className="relative w-full h-full p-8 flex items-center justify-center group">
                     {/* Placeholder for result - using one of our assets for demo */}
                     <img src={port1} className="max-h-full max-w-full object-contain shadow-2xl rounded-lg" alt="Generated Result" />
                     
                     <div className="absolute bottom-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Button variant="secondary" size="sm"><Download size={16} className="mr-2"/> Download</Button>
                        <Button variant="secondary" size="sm">Upscale</Button>
                     </div>
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
