import { Button } from '@/components/ui/button';
import { Download, Link2, Facebook, Twitter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonsProps {
  imageUrl: string;
  imageName?: string;
  sessionId?: string;
  className?: string;
}

export function ShareButtons({ imageUrl, imageName, sessionId, className }: ShareButtonsProps) {
  const { toast } = useToast();

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = imageName || `garmaxa-${sessionId || Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    toast({
      title: "Download Started",
      description: "Your image is downloading"
    });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(imageUrl);
      toast({
        title: "Link Copied",
        description: "Image URL copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Could not copy link to clipboard",
        variant: "destructive"
      });
    }
  };

  const handleFacebookShare = () => {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(imageUrl)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const handleTwitterShare = () => {
    const text = 'Check out my virtual try-on from GarmaXAi!';
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(imageUrl)}`;
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button
        size="sm"
        variant="secondary"
        onClick={handleDownload}
        className="flex items-center gap-2"
      >
        <Download className="w-4 h-4" />
        Download
      </Button>
      
      <Button
        size="sm"
        variant="outline"
        onClick={handleCopyLink}
        className="flex items-center gap-2"
      >
        <Link2 className="w-4 h-4" />
        Copy Link
      </Button>
      
      <Button
        size="sm"
        variant="outline"
        onClick={handleFacebookShare}
        className="flex items-center gap-2"
      >
        <Facebook className="w-4 h-4" />
      </Button>
      
      <Button
        size="sm"
        variant="outline"
        onClick={handleTwitterShare}
        className="flex items-center gap-2"
      >
        <Twitter className="w-4 h-4" />
      </Button>
    </div>
  );
}
