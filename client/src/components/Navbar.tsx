import { Link, useLocation } from "wouter";
import { Camera, Sparkles, LayoutGrid, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Navbar() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => {
    const isActive = location === href;
    return (
      <Link href={href} className={`text-sm uppercase tracking-widest transition-colors hover:text-accent ${
        isActive ? "text-accent font-medium" : "text-muted-foreground"
      }`}>
        {children}
      </Link>
    );
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="bg-white text-black p-1 rounded-sm group-hover:bg-accent transition-colors">
            <Camera size={20} strokeWidth={2.5} />
          </div>
          <span className="font-serif text-2xl font-bold tracking-tight">Model Me</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/">
            <a className={`text-sm uppercase tracking-widest transition-colors hover:text-accent ${location === '/' ? "text-accent font-medium" : "text-muted-foreground"}`}>
              Home
            </a>
          </Link>
          <a href="/#features" className="text-sm uppercase tracking-widest transition-colors hover:text-accent text-muted-foreground">
            Features
          </a>
          <a href="/#pricing" className="text-sm uppercase tracking-widest transition-colors hover:text-accent text-muted-foreground">
            Pricing
          </a>
          <div className="w-px h-4 bg-white/10 mx-2" />
          <Link href="/login">
            <Button variant="outline" className="border-white/20 hover:bg-white hover:text-black hover:border-white transition-all duration-300">
              Log In
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium px-6">
              Start Creating <Sparkles size={16} className="ml-2" />
            </Button>
          </Link>
        </div>

        {/* Mobile Menu */}
        <div className="md:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] border-l border-white/10 bg-black/95 backdrop-blur-xl">
              <div className="flex flex-col gap-8 mt-10">
                <Link href="/" className="text-2xl font-serif font-bold" onClick={() => setIsMobileMenuOpen(false)}>
                  Home
                </Link>
                <a href="/#features" className="text-xl font-serif text-muted-foreground hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
                  Features
                </a>
                <a href="/#pricing" className="text-xl font-serif text-muted-foreground hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
                  Pricing
                </a>
                <hr className="border-white/10" />
                <Link href="/dashboard">
                  <Button className="w-full bg-accent text-accent-foreground" onClick={() => setIsMobileMenuOpen(false)}>
                    Dashboard
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
