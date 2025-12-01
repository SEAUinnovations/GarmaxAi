import React, { useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Sparkles, Zap, Globe, Camera } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { TryonOnboardingModal } from "@/components/TryonOnboardingModal";

// Import assets
import heroImg from "@assets/generated_images/futuristic_fashion_editorial_hero_shot.png";
import port1 from "@assets/generated_images/commercial_fashion_portrait_1.png";
import port2 from "@assets/generated_images/commercial_fashion_portrait_2.png";
import port3 from "@assets/generated_images/commercial_fashion_portrait_3.png";

export default function Home() {
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();
  const [showTrialModal, setShowTrialModal] = useState(false);

  const handleStartTrial = () => {
    if (isAuthenticated) {
      // If already authenticated, go to dashboard
      navigate('/dashboard');
    } else {
      // Show trial onboarding modal
      setShowTrialModal(true);
    }
  };

  const handleTrialSuccess = () => {
    // Navigate to dashboard after successful trial signup
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center pt-20 overflow-hidden">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/60 to-background z-10" />
          <img 
            src={heroImg} 
            alt="AI Model" 
            className="w-full h-full object-cover opacity-60 scale-105 animate-in fade-in duration-1000"
          />
        </div>

        <div className="container relative z-20 px-6 flex flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="inline-block py-1 px-3 rounded-full bg-white/5 border border-white/10 text-xs font-medium tracking-widest uppercase mb-6 text-accent backdrop-blur-md">
              The Future of Fashion Photography
            </span>
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif font-bold leading-none tracking-tighter mb-6 text-balance">
              Garmax<span className="text-gradient-accent italic"></span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
              AI-powered virtual try-on technology. Upload your photos and see how garments fit instantly with advanced AI garment fitting.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {isAuthenticated ? (
                <Link href="/dashboard">
                  <Button size="lg" className="bg-white text-black hover:bg-accent hover:text-accent-foreground text-base px-8 h-14 rounded-full transition-all duration-300">
                    Go to Dashboard <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              ) : (
                <Button 
                  size="lg" 
                  className="bg-white text-black hover:bg-accent hover:text-accent-foreground text-base px-8 h-14 rounded-full transition-all duration-300"
                  onClick={handleStartTrial}
                >
                  Start Generating <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              )}
              <Button variant="outline" size="lg" className="border-white/20 hover:bg-white/10 text-base px-8 h-14 rounded-full backdrop-blur-sm">
                View Gallery
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats / Social Proof */}
      <section className="py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="container mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { label: "Models Created", value: "10k+" },
            { label: "Styles Available", value: "500+" },
            { label: "Rendering Time", value: "< 5s" },
            { label: "Happy Brands", value: "120+" },
          ].map((stat, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-3xl md:text-4xl font-serif font-bold text-white">{stat.value}</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Showcase Grid */}
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div>
              <h2 className="text-4xl md:text-5xl font-serif font-bold mb-4">Diverse & <span className="text-muted-foreground italic">Global</span></h2>
              <p className="text-muted-foreground max-w-md">Create models of any ethnicity, age, or style to perfectly match your brand identity.</p>
            </div>
            <Button variant="ghost" className="group">
              Explore All Models <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 h-[600px] md:h-[500px]">
            {[port1, port2, port3].map((img, i) => (
              <motion.div 
                key={i}
                className="relative group overflow-hidden rounded-lg h-full"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
              >
                <img src={img} alt={`Model ${i}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
                  <span className="text-accent text-xs uppercase tracking-widest mb-2">Collection 0{i+1}</span>
                  <h3 className="text-xl font-serif font-medium text-white">Urban Editorial</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white/[0.02]">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: Sparkles, title: "Perfect Fit", desc: "Advanced SMPL pose estimation ensures garments fit naturally on your body shape and posture." },
              { icon: Zap, title: "Instant Results", desc: "Upload your photo and see how any garment looks on you in seconds, not hours." },
              { icon: Globe, title: "Any Garment", desc: "Try on clothes, dresses, accessories, and more with AI-powered virtual fitting technology." },
            ].map((feature, i) => (
              <div key={i} className="p-8 rounded-2xl bg-white/5 border border-white/5 hover:border-accent/30 transition-colors group">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-6 text-white group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                  <feature.icon size={24} />
                </div>
                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-serif font-bold mb-16">Simple Pricing</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { name: "Studio", price: "29", features: ["50 Try-Ons / mo", "25 Photo Uploads", "HD Resolution", "Personal License"] },
              { name: "Pro", price: "79", features: ["200 Try-Ons / mo", "Unlimited Photos", "4K Resolution", "Commercial License", "Priority Processing"], active: true },
              { name: "Agency", price: "299", features: ["Unlimited Try-Ons", "8K Resolution", "API Access", "Custom Branding", "Dedicated Support"] },
            ].map((plan, i) => (
              <div key={i} className={`p-8 rounded-2xl border flex flex-col items-center relative ${plan.active ? 'bg-white/5 border-accent' : 'bg-transparent border-white/10'}`}>
                {plan.active && <span className="absolute -top-3 bg-accent text-accent-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">Popular</span>}
                <h3 className="text-lg font-medium text-muted-foreground mb-4">{plan.name}</h3>
                <div className="text-4xl font-serif font-bold mb-8">${plan.price}<span className="text-sm text-muted-foreground font-sans font-normal">/mo</span></div>
                <ul className="space-y-4 mb-8 w-full text-left">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center text-sm text-muted-foreground">
                      <Check size={16} className="mr-2 text-accent" /> {f}
                    </li>
                  ))}
                </ul>
                <Button className={`w-full mt-auto ${plan.active ? 'bg-white text-black hover:bg-accent hover:text-black' : 'bg-white/10 hover:bg-white/20'}`}>
                  Choose Plan
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-accent/20 to-purple-900/20 blur-3xl opacity-30" />
        <div className="container mx-auto px-6 relative z-10 text-center">
          <h2 className="text-5xl md:text-7xl font-serif font-bold mb-8">Ready to <br/>try it on?</h2>
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-white hover:text-black text-lg h-16 px-10 rounded-full transition-all transform hover:scale-105">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Button 
              size="lg" 
              className="bg-accent text-accent-foreground hover:bg-white hover:text-black text-lg h-16 px-10 rounded-full transition-all transform hover:scale-105"
              onClick={handleStartTrial}
            >
              Start Free Trial
            </Button>
          )}
        </div>
      </section>

      <footer className="border-t border-white/10 py-12 bg-black">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
             <img src="/LOGOSVG.svg" alt="Garmax" className="w-6 h-6" />
            <span className="font-serif font-bold">Garmax</span>
          </div>
          <div className="text-sm text-muted-foreground">
            © 2025 SEAU Inc. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Trial Onboarding Modal */}
      <TryonOnboardingModal 
        isOpen={showTrialModal} 
        onClose={() => setShowTrialModal(false)}
        onSuccess={handleTrialSuccess}
      />
    </div>
  );
}
