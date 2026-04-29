import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  FileText, 
  Eye,
  Loader2 // أيقونة التحميل
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

const Incidents = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isRTL = language === 'ar';

  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🚀 جلب كل البلاغات من السيرفر (أمازون DynamoDB)
  useEffect(() => {
    const fetchAllIncidents = async () => {
      try {
        const response = await fetch('https://husn-project.online/api/incidents');
        const data = await response.json();
        
        // تنسيق البيانات وترتيبها من الأحدث للأقدم
        const formattedData = data.map((item: any) => ({
          id: item.incidentId,
          status: item.status?.toLowerCase() || 'active',
          location: { 
            name: `إحداثيات: ${Number(item.lat ?? 0).toFixed(4)}, ${Number(item.lng ?? 0).toFixed(4)}` 
          },
          startTime: item.detectionTime,
          confidence: Number(item.confidence ?? 0.9),
          thumbnail: item.s3Key 
            ? `https://husn-fire-images.s3.eu-north-1.amazonaws.com/${item.s3Key}` 
            : null
        })).sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

        setIncidents(formattedData);
      } catch (error) {
        console.error("❌ فشل جلب البلاغات:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllIncidents();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm px-4 flex items-center gap-4 sticky top-0 z-40">
        <Button size="icon" variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
        </Button>
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold">{t('viewAllIncidents')}</h1>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        
        {/* حالة التحميل */}
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground font-medium">
              {isRTL ? 'جاري جلب البلاغات من الخادم...' : 'Loading incidents...'}
            </p>
          </div>
        ) : incidents.length === 0 ? (
          /* حالة إذا مافيه أي بلاغ بالداتا بيز */
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-muted-foreground font-medium text-lg">
              {isRTL ? 'لا توجد بلاغات مسجلة حالياً' : 'No incidents recorded yet'}
            </p>
          </div>
        ) : (
          /* شبكة الكروت (البيانات الحقيقية) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {incidents.map((item) => (
              <div 
                key={item.id}
                className="panel cursor-pointer hover:border-primary/40 transition-all group overflow-hidden border border-border bg-card shadow-sm"
                onClick={() => navigate(`/incidents/${item.id}`)}
              >
                {/* Thumbnail Area */}
                <div className="aspect-video relative overflow-hidden bg-muted flex items-center justify-center">
                  {item.thumbnail ? (
                    <img 
                      src={item.thumbnail} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      alt="Incident Evidence"
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">{isRTL ? 'لا توجد صورة' : 'No Image'}</span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                </div>

                <div className="p-4 space-y-4">
                  {/* Status & ID */}
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={
                      item.status === 'active' ? 'border-destructive text-destructive bg-destructive/5' :
                      item.status === 'resolved' ? 'border-success text-success bg-success/5' :
                      'border-warning text-warning bg-warning/5'
                    }>
                      {item.status === 'active' ? t('active') : item.status === 'resolved' ? t('resolved') : t('pending')}
                    </Badge>
                    <span className="font-mono text-[11px] font-bold opacity-50 tracking-tighter truncate w-24 text-left">
                      {item.id.split('-')[1] || item.id}
                    </span>
                  </div>

                  {/* Location & Time */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 text-primary/70 shrink-0" />
                      <span className="truncate">{item.location.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4 text-primary/70 shrink-0" />
                      <span>{formatDistanceToNow(new Date(item.startTime), { 
                        addSuffix: true,
                        locale: isRTL ? ar : enUS 
                      })}</span>
                    </div>
                  </div>

                  {/* Progress Bar Area (Confidence) */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
                        {t('detectionConfidence')}
                      </span>
                      <span className="font-mono text-xs font-bold text-primary">
                        {Math.round(item.confidence > 1 ? item.confidence : item.confidence * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden border border-border/20">
                      <div 
                        className="h-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.4)] transition-all duration-1000"
                        style={{ width: `${item.confidence > 1 ? item.confidence : item.confidence * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* View Button */}
                  <Button variant="tactical" className="w-full h-10 mt-2 font-bold group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Eye className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {t('viewFullDetails')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Incidents;