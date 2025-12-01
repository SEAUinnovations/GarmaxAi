import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, Crown, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Pricing() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const subscriptionPlans = [
    {
      id: "free",
      name: "Free",
      description: "Get started with photo-based virtual try-ons",
      price: { monthly: 0, annual: 0 },
      icon: Sparkles,
      iconColor: "text-white/40",
      features: [
        { text: "3 photo uploads", included: true },
        { text: "5 try-ons per month", included: true },
        { text: "Demo photos available", included: true },
        { text: "Buy credits as needed", included: true },
        { text: "SD quality (512×512)", included: true },
        { text: "Multiple photos", included: false },
        { text: "Monthly try-on quota", included: false },
        { text: "HD/4K rendering", included: false },
      ],
      cta: "Current Plan",
      highlight: false,
    },
    {
      id: "studio",
      name: "Studio",
      description: "For fashion enthusiasts and casual shoppers",
      price: { monthly: 29, annual: 24 },
      icon: Zap,
      iconColor: "text-accent",
      features: [
        { text: "25 photo uploads", included: true },
        { text: "50 try-ons per month", included: true },
        { text: "All quality levels (SD/HD/4K)", included: true },
        { text: "Priority processing", included: true },
        { text: "Save to wardrobe", included: true },
        { text: "Export in all formats", included: true },
        { text: "Email support", included: true },
        { text: "50% discount on extra credits", included: true },
      ],
      cta: "Upgrade to Studio",
      highlight: true,
      badge: "Most Popular",
    },
    {
      id: "pro",
      name: "Pro",
      description: "For designers, influencers, and businesses",
      price: { monthly: 79, annual: 66 },
      icon: Crown,
      iconColor: "text-yellow-400",
      features: [
        { text: "Unlimited photo uploads", included: true },
        { text: "200 try-ons per month", included: true },
        { text: "All quality levels (SD/HD/4K)", included: true },
        { text: "Instant processing (no queue)", included: true },
        { text: "Advanced wardrobe management", included: true },
        { text: "API access", included: true },
        { text: "Custom branding", included: true },
        { text: "Priority support & training", included: true },
      ],
      cta: "Upgrade to Pro",
      highlight: false,
      badge: "Best Value",
    },
  ];

  const creditPacks = [
    {
      credits: 30,
      price: 3,
      bonus: 0,
      popular: false,
    },
    {
      credits: 100,
      price: 10,
      bonus: 10,
      popular: true,
    },
    {
      credits: 500,
      price: 40,
      bonus: 100,
      popular: false,
    },
  ];

  const handleSubscribe = async (planId: string) => {
    // TODO: Integrate Stripe checkout
    console.log("Subscribe to:", planId, billingCycle);
  };

  const handleBuyCredits = async (credits: number) => {
    // TODO: Integrate Stripe checkout for credits
    console.log("Buy credits:", credits);
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

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 text-center">
        <h1 className="text-5xl md:text-6xl font-serif font-bold mb-6">
          Choose Your Plan
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Transform your photos into virtual try-on experiences with AI
        </p>

        {/* Billing Toggle */}
        <div className="inline-flex items-center gap-2 p-1 bg-white/5 rounded-lg border border-white/10">
          <button
            className={cn(
              "px-4 py-2 rounded-md transition-all text-sm font-medium",
              billingCycle === "monthly"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setBillingCycle("monthly")}
          >
            Monthly
          </button>
          <button
            className={cn(
              "px-4 py-2 rounded-md transition-all text-sm font-medium flex items-center gap-2",
              billingCycle === "annual"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setBillingCycle("annual")}
          >
            Annual
            <Badge variant="secondary" className="text-xs">Save 17%</Badge>
          </button>
        </div>
      </section>

      {/* Subscription Plans */}
      <section className="container mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptionPlans.map((plan) => {
            const Icon = plan.icon;
            const price = billingCycle === "monthly" ? plan.price.monthly : plan.price.annual;

            return (
              <Card
                key={plan.id}
                className={cn(
                  "relative overflow-hidden transition-all",
                  plan.highlight
                    ? "border-accent bg-accent/5 shadow-lg shadow-accent/20 scale-105"
                    : "border-white/10 bg-card hover:border-white/20"
                )}
              >
                {plan.badge && (
                  <div className="absolute top-4 right-4">
                    <Badge className="bg-accent text-accent-foreground">
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <CardHeader>
                  <div className="mb-4">
                    <Icon className={cn("w-12 h-12", plan.iconColor)} />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Price */}
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-bold">${price}</span>
                      {price > 0 && (
                        <span className="text-muted-foreground">
                          /{billingCycle === "monthly" ? "month" : "year"}
                        </span>
                      )}
                    </div>
                    {billingCycle === "annual" && price > 0 && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Billed ${price * 12} annually
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check
                          className={cn(
                            "w-5 h-5 mt-0.5 flex-shrink-0",
                            feature.included ? "text-green-400" : "text-white/20"
                          )}
                        />
                        <span
                          className={cn(
                            "text-sm",
                            feature.included ? "text-foreground" : "text-muted-foreground line-through"
                          )}
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    className={cn(
                      "w-full",
                      plan.highlight
                        ? "bg-accent text-accent-foreground hover:bg-white hover:text-black"
                        : ""
                    )}
                    variant={plan.id === "free" ? "outline" : "default"}
                    size="lg"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={plan.id === "free"}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Credit Packs */}
      <section className="container mx-auto px-6 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-serif font-bold mb-4">Pay As You Go</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Not ready for a subscription? Purchase credits on demand
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {creditPacks.map((pack) => (
            <Card
              key={pack.credits}
              className={cn(
                "border-white/10 bg-card transition-all",
                pack.popular && "border-accent bg-accent/5 scale-105"
              )}
            >
              {pack.popular && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-accent text-accent-foreground">Best Deal</Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-3xl">
                  {pack.credits + pack.bonus} Credits
                </CardTitle>
                {pack.bonus > 0 && (
                  <p className="text-sm text-green-400">
                    +{pack.bonus} bonus credits
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">${pack.price}</span>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>≈ {Math.floor(pack.credits / 10)} SD renders</p>
                  <p>or {Math.floor(pack.credits / 15)} HD renders</p>
                  <p>or {Math.floor(pack.credits / 25)} 4K renders</p>
                </div>

                <Button
                  className="w-full"
                  variant={pack.popular ? "default" : "outline"}
                  onClick={() => handleBuyCredits(pack.credits)}
                >
                  Buy Credits
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Credits never expire • Refund guarantee on failed renders
          </p>
        </div>
      </section>

      {/* Pricing Breakdown */}
      <section className="container mx-auto px-6 pb-24">
        <Card className="border-white/10 bg-card/50 backdrop-blur-sm max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl">Credit Pricing Guide</CardTitle>
            <CardDescription>
              Understand how credits work for different features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <p className="font-medium">Photo Upload & Processing</p>
                  <p className="text-sm text-muted-foreground">
                    SMPL pose estimation and photo preparation
                  </p>
                </div>
                <Badge variant="outline">2 credits</Badge>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <p className="font-medium">SD Render (512×512)</p>
                  <p className="text-sm text-muted-foreground">
                    Fast preview quality
                  </p>
                </div>
                <Badge variant="outline">10 credits</Badge>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <p className="font-medium">HD Render (1024×1024)</p>
                  <p className="text-sm text-muted-foreground">
                    High quality for social media
                  </p>
                </div>
                <Badge variant="outline">15 credits</Badge>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">4K Render (2048×2048)</p>
                  <p className="text-sm text-muted-foreground">
                    Ultra HD for professional use
                  </p>
                </div>
                <Badge variant="outline">25 credits</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
