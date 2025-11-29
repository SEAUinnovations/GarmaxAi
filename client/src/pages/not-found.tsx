import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-md mx-4 p-8 rounded-2xl border border-white/10 bg-card/50 backdrop-blur-md text-center">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertCircle size={32} />
          </div>
        </div>
        <h1 className="text-4xl font-serif font-bold mb-2">404</h1>
        <h2 className="text-xl font-medium text-muted-foreground mb-6">Page Not Found</h2>
        
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          The model you are looking for hasn't been generated yet. Please check the URL or return home.
        </p>

        <Link href="/">
          <Button className="w-full bg-white text-black hover:bg-accent hover:text-black">
            <ArrowLeft size={16} className="mr-2" /> Return Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
