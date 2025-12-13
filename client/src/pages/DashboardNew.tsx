import { Link } from "wouter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, Grid, LayoutDashboard, Settings, LogOut, Plus, History, Sparkles, Coins, Lock, Clock, ArrowRight, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/UserMenu";

export default function Dashboard() {
  const [userPlan] = useState<"free" | "studio" | "pro">("free");
  const [credits, setCredits] = useState(0);
  const [tryonQuota] = useState({ used: 0, limit: 0 });
  const [trialStatus, setTrialStatus] = useState<string | null>(null);
  const [isOnTrial, setIsOnTrial] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [recentGenerations, setRecentGenerations] = useState<any[]>([]);

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
          
          if (userData.trialStatus === 'active' && userData.trialExpiresAt) {
            const now = new Date();
            const expiresAt = new Date(userData.trialExpiresAt);
            const diffTime = expiresAt.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            setDaysRemaining(diffDays > 0 ? diffDays : 0);
          }
        }
        
        const genResponse = await fetch("/api/generation", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (genResponse.ok) {
          const genData = await genResponse.json();
          const completed = (genData.generations || []).filter(
            (g: any) => g.status === 'completed' && g.imageUrl
          );
          setRecentGenerations(completed.slice(0, 4));
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };
    fetchUserData();
  }, []);

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
          <Link href="/dashboard">
            <Button variant="secondary" className="w-full justify-start">
              <LayoutDashboard size={18} className="mr-2" /> Dashboard
            </Button>
          </Link>
          <Link href="/generate" className="w-full">
            <Button variant="ghost" className="w-full justify-start">
              <Plus size={18} className="mr-2" /> Create Model
            </Button>
          </Link>
          <Link href="/virtual-tryon" className="w-full">
            <Button variant="ghost" className="w-full justify-start">
              <Camera size={18} className="mr-2" /> 3D Try-On Studio
            </Button>
          </Link>
          <Link href="/history" className="w-full">
            <Button variant="ghost" className="w-full justify-start">
              <History size={18} className="mr-2" /> History
            </Button>
          </Link>
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
          <h1 className="text-lg font-medium">Dashboard</h1>
          <div className="flex items-center gap-4">
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

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="border-accent/50 bg-gradient-to-br from-accent/20 to-accent/5 hover:border-accent transition-colors cursor-pointer">
              <Link href="/generate">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="text-accent" size={20} />
                    Create New Model
                  </CardTitle>
                  <CardDescription>Generate AI fashion models instantly</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full bg-accent hover:bg-white hover:text-black">
                    Start Creating <ArrowRight size={16} className="ml-2" />
                  </Button>
                </CardContent>
              </Link>
            </Card>

            <Card className="border-blue-500/50 bg-gradient-to-br from-blue-500/20 to-blue-500/5 hover:border-blue-500 transition-colors cursor-pointer">
              <Link href={userPlan === "free" ? "/pricing" : "/virtual-tryon"}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="text-blue-400" size={20} />
                      3D Try-On Studio
                    </CardTitle>
                    {userPlan === "free" && <Lock size={16} className="text-yellow-400" />}
                  </div>
                  <CardDescription>Virtual garment fitting experience</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full">
                    {userPlan === "free" ? "Unlock Feature" : "Launch Studio"} <ArrowRight size={16} className="ml-2" />
                  </Button>
                </CardContent>
              </Link>
            </Card>

            <Card className="border-purple-500/50 bg-gradient-to-br from-purple-500/20 to-purple-500/5 hover:border-purple-500 transition-colors cursor-pointer">
              <Link href="/history">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="text-purple-400" size={20} />
                    View History
                  </CardTitle>
                  <CardDescription>Browse your past generations</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full">
                    Open Gallery <ArrowRight size={16} className="ml-2" />
                  </Button>
                </CardContent>
              </Link>
            </Card>
          </div>

          {/* Recent Generations */}
          {recentGenerations.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Recent Generations</h2>
                <Link href="/history">
                  <Button variant="ghost" size="sm">
                    View All <ArrowRight size={14} className="ml-1" />
                  </Button>
                </Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {recentGenerations.map((gen) => (
                  <div key={gen.id} className="aspect-[3/4] rounded-lg overflow-hidden border border-white/10 bg-card hover:border-accent/50 transition-colors group cursor-pointer">
                    <img src={gen.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform" alt={gen.prompt || "Generated"} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <p className="text-xs text-white line-clamp-2">{gen.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Getting Started for New Users */}
          {recentGenerations.length === 0 && (
            <Card className="border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="text-accent" size={24} />
                  Welcome to GarmaXAi
                </CardTitle>
                <CardDescription>Get started with AI-powered fashion model generation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center mb-3">
                      <span className="font-bold text-accent">1</span>
                    </div>
                    <h3 className="font-medium mb-2">Write a Prompt</h3>
                    <p className="text-sm text-muted-foreground">Describe the model and style you want to create</p>
                  </div>
                  <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center mb-3">
                      <span className="font-bold text-accent">2</span>
                    </div>
                    <h3 className="font-medium mb-2">Customize Settings</h3>
                    <p className="text-sm text-muted-foreground">Choose quality, style, and aspect ratio</p>
                  </div>
                  <div className="p-4 rounded-lg border border-white/10 bg-white/5">
                    <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center mb-3">
                      <span className="font-bold text-accent">3</span>
                    </div>
                    <h3 className="font-medium mb-2">Generate & Download</h3>
                    <p className="text-sm text-muted-foreground">Get your AI model in seconds</p>
                  </div>
                </div>
                <div className="flex justify-center pt-4">
                  <Link href="/generate">
                    <Button size="lg" className="bg-accent hover:bg-white hover:text-black">
                      <Plus size={18} className="mr-2" />
                      Create Your First Model
                      <Sparkles size={18} className="ml-2" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
