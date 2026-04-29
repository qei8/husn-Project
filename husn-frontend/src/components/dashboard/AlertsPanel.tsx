import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Eye,
  Clock,
  MapPin,
} from 'lucide-react';
import { Alert } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale'; // استيراد اللغات
import { useLanguage } from '@/contexts/LanguageContext';

interface AlertsPanelProps {
  alerts: Alert[];
  onViewDetails: (alert: Alert) => void;
  onConfirm: (alertId: string) => void;
  onDismiss: (alertId: string) => void;
}

const AlertsPanel = ({ alerts, onViewDetails, onConfirm, onDismiss }: AlertsPanelProps) => {
  const { t, language } = useLanguage();
  const isRTL = language === 'ar'; // تحديد اتجاه اللغة

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-alert-critical text-white';
      case 'high': return 'bg-alert-high text-white';
      case 'medium': return 'bg-alert-medium text-black';
      case 'low': return 'bg-alert-low text-white';
      default: return 'bg-muted text-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="border-status-active text-status-active bg-status-active/10">{t('active')}</Badge>;
      case 'pending':
        return <Badge variant="outline" className="border-status-pending text-status-pending bg-status-pending/10">{t('pending') || 'Pending'}</Badge>;
      case 'resolved':
        return <Badge variant="outline" className="border-status-resolved text-status-resolved">{t('resolved') || 'Resolved'}</Badge>;
      case 'dismissed':
        return <Badge variant="outline" className="border-muted-foreground text-muted-foreground">{t('inactive')}</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="panel h-full flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <span className="panel-title">{t('alertHistory')}</span>
          <Badge variant="secondary" className={` ${isRTL ? 'mr-2' : 'ml-2'}`}>{alerts.length}</Badge>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {alerts.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs italic">
              {isRTL ? 'لا توجد تنبيهات حديثة' : 'No recent alerts'}
            </div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id}
                className={`
                  p-3 rounded-lg border transition-all cursor-pointer
                  ${alert.status === 'active' ? 'bg-destructive/5 border-destructive/30 hover:border-destructive/50' : 'bg-card border-border hover:border-primary/30'}
                `}
                onClick={() => onViewDetails(alert)}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 shrink-0 rounded-full ${
                      alert.status === 'active' ? 'bg-destructive animate-pulse' : 
                      alert.status === 'pending' ? 'bg-warning' : 'bg-muted-foreground'
                    }`} />
                    <span className="font-medium text-[10px] font-mono opacity-70">
                      {/* ناخذ الجزء الأول من الـ UUID عشان يكون مميز */}
                      {alert.id.split('-')[1]?.substring(0, 6) || alert.id}...
                    </span>
                  </div>
                  {getStatusBadge(alert.status)}
                </div>

                {/* Location */}
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{alert.location.name}</span>
                </div>

                {/* Confidence & Time */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${getSeverityColor(alert.severity)}`}>
                      {Math.round(alert.confidence > 1 ? alert.confidence : alert.confidence * 100)}% {t('detectionConfidence')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3 shrink-0" />
                    <span>{formatDistanceToNow(new Date(alert.timestamp), { 
                      addSuffix: true,
                      locale: isRTL ? ar : enUS // دعم اللغة العربية للوقت
                    })}</span>
                  </div>
                </div>

                {/* Actions (تظهر فقط لو كان نشط أو معلق) */}
                {(alert.status === 'active' || alert.status === 'pending') && (
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button 
                      size="sm" 
                      variant="tactical" 
                      className="flex-1 h-7 text-[10px]"
                      onClick={() => onViewDetails(alert)}
                    >
                      <Eye className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {t('view')}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="success" 
                      className="flex-1 h-7 text-[10px]"
                      onClick={() => onConfirm(alert.id)}
                    >
                      <CheckCircle2 className={`w-3 h-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {t('confirmAlert')}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default AlertsPanel;