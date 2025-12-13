import { Link, useLocation } from "wouter";
import { LogOut, User, Settings, LayoutDashboard, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function UserMenu() {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    setLocation('/login');
  };

  // Get initials from username or email
  const getInitials = () => {
    if (user.username) {
      return user.username.slice(0, 2).toUpperCase();
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  // Get display name (username or email prefix)
  const getDisplayName = () => {
    if (user.username) {
      return user.username;
    }
    return user.email.split('@')[0];
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 outline-none focus:outline-none">
        <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30 font-medium">
          <Coins size={14} className="mr-1" />
          {user.creditsRemaining}
        </Badge>
        <Avatar className="h-9 w-9 border-2 border-white/10 hover:border-accent/50 transition-colors cursor-pointer">
          <AvatarFallback className="bg-accent/20 text-accent font-medium">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-black/95 backdrop-blur-xl border-white/10">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{getDisplayName()}</p>
            <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/dashboard" className="flex items-center">
            <LayoutDashboard size={16} className="mr-2" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/account" className="flex items-center">
            <Settings size={16} className="mr-2" />
            Account & Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild className="cursor-pointer">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm">Credits</span>
            <Badge variant="secondary" className="bg-accent/20 text-accent border-accent/30">
              {user.creditsRemaining}
            </Badge>
          </div>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem 
          onClick={handleLogout}
          className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-400/10"
        >
          <LogOut size={16} className="mr-2" />
          Log Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
