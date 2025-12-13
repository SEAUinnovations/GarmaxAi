import { Link, useLocation } from "wouter";
import { Camera, Sparkles, LayoutGrid, Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";

export function Navbar() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

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
        <Link href="/" className="flex items-center gap-3 group">
            <img src="/logo3.jpg" alt="Garmax" className="w-8 h-8 group-hover:scale-110 transition-transform" />
          <span className="font-serif text-2xl font-bold tracking-tight">Garmax</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link href="/" className={`text-sm uppercase tracking-widest transition-colors hover:text-accent ${location === '/' ? "text-accent font-medium" : "text-muted-foreground"}`}>
            Home
          </Link>
          <a href="/#features" className="text-sm uppercase tracking-widest transition-colors hover:text-accent text-muted-foreground">
            Features
          </a>
          <a href="/#pricing" className="text-sm uppercase tracking-widest transition-colors hover:text-accent text-muted-foreground">
            Pricing
          </a>
          <div className="w-px h-4 bg-white/10 mx-2" />
          
          {/* Show user menu if authenticated, otherwise show login/signup buttons */}
          {!isLoading && (
            <>
              {isAuthenticated ? (
                <UserMenu />
              ) : (
                <>
                  <Link href="/login" asChild>
                    <Button variant="outline" className="border-white/20 hover:bg-white hover:text-black hover:border-white transition-all duration-300">
                      Log In
                    </Button>
                  </Link>
                  <Link href="/dashboard" asChild>
                    <Button className="bg-accent text-accent-foreground hover:bg-accent/90 font-medium px-6">
                      Start Creating <Sparkles size={16} className="ml-2" />
                    </Button>
                  </Link>
                </>
              )}
            </>
          )}
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
                
                {/* Mobile menu - show different options based on auth state */}
                {!isLoading && (
                  <>
                    {isAuthenticated ? (
                      <>
                        <Link href="/dashboard" asChild>
                          <Button className="w-full bg-accent text-accent-foreground" onClick={() => setIsMobileMenuOpen(false)}>
                            Dashboard
                          </Button>
                        </Link>
                        <Link href="/account" asChild>
                          <Button variant="outline" className="w-full border-white/20" onClick={() => setIsMobileMenuOpen(false)}>
                            Account & Settings
                          </Button>
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link href="/login" asChild>
                          <Button variant="outline" className="w-full border-white/20" onClick={() => setIsMobileMenuOpen(false)}>
                            Log In
                          </Button>
                        </Link>
                        <Link href="/dashboard" asChild>
                          <Button className="w-full bg-accent text-accent-foreground" onClick={() => setIsMobileMenuOpen(false)}>
                            Start Creating
                          </Button>
                        </Link>
                      </>
                    )}
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
