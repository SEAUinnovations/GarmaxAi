import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Crown,
  CreditCard,
  Calendar,
  Camera,
  Trash2,
  Plus,
  TrendingUp,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProfileEditSection } from "@/components/ProfileEditSection";

export default function Account() {
  const [subscription] = useState({
    plan: "Studio",
    status: "active",
    billingCycle: "monthly",
    price: 29,
    nextBillingDate: "2024-02-15",
    cancelAtPeriodEnd: false,
  });

  const [credits] = useState({
    balance: 45,
    monthlyQuota: 25,
    used: 7,
  });

  const [avatars] = useState([
    {
      id: "demo",
      name: "Demo Avatar",
      thumbnailUrl: null,
      createdAt: "2024-01-01",
      isDemo: true,
    },
    {
      id: "avatar_1",
      name: "Custom Avatar 1",
      thumbnailUrl: "https://via.placeholder.com/200/8B5CF6/FFFFFF?text=Avatar+1",
      createdAt: "2024-01-10",
      isDemo: false,
    },
  ]);

  const [transactions] = useState([
    {
      id: "tx_1",
      type: "credit_purchase",
      amount: 100,
      cost: 10,
      date: "2024-01-15",
      status: "completed",
    },
    {
      id: "tx_2",
      type: "subscription",
      amount: null,
      cost: 29,
      date: "2024-01-01",
      status: "completed",
    },
    {
      id: "tx_3",
      type: "tryon_sd",
      amount: -10,
      cost: null,
      date: "2024-01-20",
      status: "completed",
    },
    {
      id: "tx_4",
      type: "tryon_hd",
      amount: -15,
      cost: null,
      date: "2024-01-21",
      status: "completed",
    },
    {
      id: "tx_5",
      type: "refund",
      amount: 10,
      cost: null,
      date: "2024-01-22",
      status: "completed",
    },
  ]);

  const avatarLimit = subscription.plan === "Free" ? 1 : subscription.plan === "Studio" ? 3 : 5;
  const quotaPercentage = (credits.used / credits.monthlyQuota) * 100;

  const handleCancelSubscription = () => {
    // TODO: Implement cancellation
    console.log("Cancel subscription");
  };

  const handleDeleteAvatar = (avatarId: string) => {
    // TODO: Implement avatar deletion
    console.log("Delete avatar:", avatarId);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-white/10 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft size={18} className="mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold mb-2">Account Settings</h1>
          <p className="text-muted-foreground">
            Manage your subscription, credits, and avatars
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Profile, Subscription & Credits */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Profile Section */}
            <ProfileEditSection />
            {/* Subscription Card */}
            <Card className="border-white/10 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crown className="w-6 h-6 text-accent" />
                    <div>
                      <CardTitle>Subscription</CardTitle>
                      <CardDescription>
                        {subscription.plan} Plan •{" "}
                        {subscription.billingCycle === "monthly" ? "Monthly" : "Annual"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={subscription.status === "active" ? "default" : "secondary"}
                    className="bg-green-500/20 text-green-400"
                  >
                    Active
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-sm text-muted-foreground mb-1">Monthly Price</p>
                    <p className="text-2xl font-bold">${subscription.price}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-sm text-muted-foreground mb-1">Next Billing</p>
                    <p className="text-2xl font-bold">
                      {new Date(subscription.nextBillingDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Link href="/pricing" className="flex-1">
                    <Button variant="outline" className="w-full">
                      Change Plan
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="flex-1 border-destructive/50 hover:bg-destructive/10"
                    onClick={handleCancelSubscription}
                  >
                    Cancel Subscription
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Credits Card */}
            <Card className="border-white/10 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-accent" />
                    <div>
                      <CardTitle>Credits & Usage</CardTitle>
                      <CardDescription>Your balance and monthly quota</CardDescription>
                    </div>
                  </div>
                  <Link href="/pricing">
                    <Button size="sm" variant="outline">
                      Buy Credits
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Credit Balance */}
                <div className="p-6 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/30">
                  <p className="text-sm text-muted-foreground mb-2">Available Credits</p>
                  <p className="text-5xl font-bold text-accent mb-2">{credits.balance}</p>
                  <p className="text-sm text-muted-foreground">
                    ≈ {Math.floor(credits.balance / 10)} SD renders or{" "}
                    {Math.floor(credits.balance / 15)} HD renders
                  </p>
                </div>

                {/* Monthly Quota */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">Monthly Try-On Quota</p>
                      <p className="text-sm text-muted-foreground">
                        {credits.used} of {credits.monthlyQuota} used
                      </p>
                    </div>
                    <span className="text-sm font-bold">
                      {credits.monthlyQuota - credits.used} remaining
                    </span>
                  </div>
                  <Progress value={quotaPercentage} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Quota resets on {new Date(subscription.nextBillingDate).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Transaction History */}
            <Card className="border-white/10 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-6 h-6 text-accent" />
                    <div>
                      <CardTitle>Transaction History</CardTitle>
                      <CardDescription>Your recent activity</CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download size={14} className="mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.map((tx) => {
                    const getTransactionInfo = () => {
                      switch (tx.type) {
                        case "credit_purchase":
                          return {
                            label: `Purchased ${tx.amount} credits`,
                            color: "text-green-400",
                            sign: "+",
                          };
                        case "subscription":
                          return {
                            label: "Monthly subscription",
                            color: "text-blue-400",
                            sign: "",
                          };
                        case "tryon_sd":
                          return {
                            label: "SD try-on render",
                            color: "text-red-400",
                            sign: "",
                          };
                        case "tryon_hd":
                          return {
                            label: "HD try-on render",
                            color: "text-red-400",
                            sign: "",
                          };
                        case "refund":
                          return {
                            label: "Refund - cancelled session",
                            color: "text-green-400",
                            sign: "+",
                          };
                        default:
                          return { label: tx.type, color: "text-foreground", sign: "" };
                      }
                    };

                    const info = getTransactionInfo();

                    return (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div>
                          <p className="text-sm font-medium">{info.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          {tx.amount !== null && (
                            <p className={cn("font-bold", info.color)}>
                              {info.sign}
                              {tx.amount} credits
                            </p>
                          )}
                          {tx.cost !== null && (
                            <p className="text-sm text-muted-foreground">${tx.cost}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Avatars */}
          <div className="space-y-6">
            <Card className="border-white/10 bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Camera className="w-6 h-6 text-accent" />
                    <div>
                      <CardTitle>Your Avatars</CardTitle>
                      <CardDescription>
                        {avatars.length} of {avatarLimit}
                      </CardDescription>
                    </div>
                  </div>
                  <Link href="/virtual-tryon">
                    <Button size="sm" variant="outline" disabled={avatars.length >= avatarLimit}>
                      <Plus size={14} className="mr-2" />
                      Create
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {avatars.map((avatar) => (
                    <div
                      key={avatar.id}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center gap-3"
                    >
                      <div className="w-16 h-16 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden">
                        {avatar.thumbnailUrl ? (
                          <img
                            src={avatar.thumbnailUrl}
                            alt={avatar.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Camera size={24} className="text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{avatar.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(avatar.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      {!avatar.isDemo && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-destructive/20"
                          onClick={() => handleDeleteAvatar(avatar.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {avatars.length >= avatarLimit && (
                  <div className="mt-4 p-3 rounded-lg bg-accent/10 border border-accent/30">
                    <p className="text-sm text-center">
                      <Link href="/pricing" className="text-accent hover:underline font-medium">
                        Upgrade your plan
                      </Link>{" "}
                      to create more avatars
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Usage Stats */}
            <Card className="border-white/10 bg-card">
              <CardHeader>
                <CardTitle className="text-lg">Usage This Month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Renders</span>
                  <span className="font-bold">{credits.used}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Credits Spent</span>
                  <span className="font-bold">
                    {credits.used * 10} {/* Approximate */}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Refunds Received</span>
                  <span className="font-bold">1</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
