import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Flame, 
  User, 
  LogOut, 
  Settings, 
  Menu,
  Languages,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Users,
  Phone // تم إضافة أيقونة الهاتف
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { signOut } from 'aws-amplify/auth';
import { toast } from "sonner";

interface DashboardHeaderProps {
  onMenuClick?: () => void;
}

const DashboardHeader = ({ onMenuClick }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { theme, toggleTheme, isMuted, toggleMute } = useTheme();
  
  const [currentUser, setCurrentUser] = useState<{name: string, role: string} | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser({
          name: parsed.name,
          role: parsed.role
        });
      } catch (e) {
        console.error("Error parsing user data", e);
      }
    }
  }, []);

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  const handleLogout = async () => {
    try {
      await signOut(); 
      localStorage.removeItem("user");
      navigate('/login');
      toast.success(language === 'ar' ? "تم تسجيل الخروج بأمان" : "Logged out safely");
    } catch (error) {
      console.error('Error signing out: ', error);
      localStorage.removeItem("user");
      navigate('/login');
    }
  };

  return (
    <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <Button size="icon" variant="ghost" className="md:hidden" onClick={onMenuClick}>
          <Menu className="w-5 h-5" />
        </Button>
        
        <div 
          className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity" 
          onClick={() => navigate('/dashboard')}
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Flame className="w-5 h-5 text-primary" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-foreground">{t('appName')}</h1>
            <p className="text-xs text-muted-foreground">{t('appSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* Center - Status */}
      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/30 rounded-full">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs font-medium text-success">{t('systemOnline')}</span>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* زر اتصال الطوارئ بالدفاع المدني - مضاف حديثاً */}
        <Button 
          variant="destructive" 
          size="sm" 
          className="bg-red-600 hover:bg-red-700 animate-pulse font-bold hidden sm:flex items-center gap-2 h-9"
          asChild
        >
          <a href="tel:998">
            <Phone className="w-4 h-4" />
            {language === 'ar' ? 'بلاغ (998)' : 'Call 998'}
          </a>
        </Button>

        <Button size="icon" variant="ghost" onClick={toggleLanguage}>
          <Languages className="w-5 h-5" />
        </Button>

        <Button size="icon" variant="ghost" onClick={toggleMute}>
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </Button>

        <Button size="icon" variant="ghost" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 pl-2 pr-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className={`hidden sm:block ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                <p className="text-sm font-medium text-foreground">{currentUser?.name || t('operator')}</p>
                <p className="text-xs text-muted-foreground capitalize">{currentUser?.role || t('employee')}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-48 [direction:rtl]">
            {currentUser?.role === 'admin' && (
              <DropdownMenuItem onClick={() => navigate('/admin-users')} className="flex items-center justify-between gap-2">
                <span>{t('userManagement')}</span>
                <Users className="w-4 h-4" />
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => navigate('/settings')} className="flex items-center justify-between gap-2">
              <span>{t('settings')}</span>
              <Settings className="w-4 h-4" />
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem onClick={handleLogout} className="text-destructive flex items-center justify-between gap-2 cursor-pointer">
              <span>{t('logout')}</span>
              <LogOut className="w-4 h-4" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default DashboardHeader;