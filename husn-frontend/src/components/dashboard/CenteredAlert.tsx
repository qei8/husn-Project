import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  MapPin, 
  Clock, 
  Eye, 
  CheckCircle2, 
  XCircle,
  ExternalLink,
  Volume2
} from 'lucide-react';
import { Alert } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface CenteredAlertProps {
  alert: Alert;
  onViewDetails: () => void;
  onConfirm: () => void;
  onDismiss: () => void;
}

const CenteredAlert = ({ alert, onViewDetails, onConfirm, onDismiss }: CenteredAlertProps) => {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      {/* Alert Modal */}
      <div className="relative w-full max-w-lg mx-4 animate-slide-in-alert">
        <div className="gradient-alert rounded-xl border-2 border-destructive overflow-hidden glow-alert">
          {/* Header */}
          <div className="bg-destructive/20 border-b border-destructive/30 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-destructive">{t('fireDetected')}</h2>
                  <p className="text-sm text-destructive/80">{t('highPriorityAlert')}</p>
                </div>
              </div>
              <Volume2 className="w-6 h-6 text-destructive animate-pulse" />
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Alert ID & Time */}
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg text-foreground font-bold">
                {/* نظهر جزء من الـ ID عشان الـ UUID حق أمازون طويل جداً */}
                {alert.id.split('-')[1] || alert.id}
              </span>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{formatDistanceToNow(new Date(alert.timestamp), { 
                  addSuffix: true,
                  locale: isRTL ? ar : enUS 
                })}</span>
              </div>
            </div>

            {/* Location */}
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border">
              <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-foreground">{alert.location.name}</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {alert.location.lat.toFixed(4)}, {alert.location.lon.toFixed(4)}
                </p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 shrink-0">
                <ExternalLink className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                {t('map')}
              </Button>
            </div>

            {/* Confidence */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">{t('detectionConfidence')}</span>
                <span className="font-bold text-destructive">
                  {Math.round(alert.confidence > 1 ? alert.confidence : alert.confidence * 100)}%
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-destructive to-alert-high transition-all duration-1000"
                  style={{ width: `${alert.confidence > 1 ? alert.confidence : alert.confidence * 100}%` }}
                />
              </div>
            </div>

            {/* Thumbnail */}
            {alert.thumbnail && (
              <div className="relative aspect-video rounded-lg overflow-hidden border border-border bg-black">
                <img 
                  src={alert.thumbnail} 
                  alt="Alert thumbnail" 
                  className="w-full h-full object-contain"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent pointer-events-none" />
                <div className="absolute bottom-2 left-2 text-xs text-foreground/80 bg-background/50 px-2 py-1 rounded backdrop-blur-sm">
                  {t('capturedFrame')}
                </div>
              </div>
            )}

            {/* Description */}
            {alert.description && (
              <p className="text-sm text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
                {alert.description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex gap-3">
            <Button 
              variant="default" 
              className="flex-1"
              onClick={onViewDetails}
            >
              <Eye className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('viewFullDetails')}
            </Button>
            <Button 
              variant="success" 
              className="flex-1"
              onClick={onConfirm}
            >
              <CheckCircle2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('confirmAlert')}
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
              onClick={onDismiss}
            >
              <XCircle className="w-5 h-5" />
            </Button>
          </div>

          {/* Footer */}
          <div className="px-6 pb-4">
            <button className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 mx-auto">
              {t('reportFalsePositive')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CenteredAlert;