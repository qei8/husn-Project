import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  FileText,
  Flag,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { io } from 'socket.io-client';

const IncidentDetail = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { id } = useParams();
  
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // جلب بيانات الحادث
  useEffect(() => {
    const fetchIncident = async () => {
      try {
        const response = await fetch('https://husn-project.online/api/incidents');
        const incidents = await response.json();
        const foundIncident = incidents.find((i: any) => i.incidentId === id);

        if (foundIncident) {
          setData({
            id: foundIncident.incidentId,
            status: foundIncident.status?.toLowerCase() || 'active',
            startTime: foundIncident.detectionTime,
            location: {
              lat: Number(foundIncident.lat ?? 0),
              lon: Number(foundIncident.lng ?? 0),
              name: `إحداثيات: ${Number(foundIncident.lat ?? 0).toFixed(4)}, ${Number(foundIncident.lng ?? 0).toFixed(4)}`
            },
            confidence: Number(foundIncident.confidence ?? 0.9),
            severity: Number(foundIncident.confidence ?? 0) >= 0.95 ? 5 : 4,
            description: 'تم رصد حريق بواسطة نظام حُصن للذكاء الاصطناعي',
            media: foundIncident.s3Key ? [`https://husn-fire-images.s3.eu-north-1.amazonaws.com/${foundIncident.s3Key}`] : [],
            createdBy: foundIncident.uavId || 'نظام حُصن (AI)',
          });
        }
      } catch (error) {
        console.error("❌ فشل جلب تفاصيل الحادث:", error);
        toast.error(language === 'ar' ? 'حدث خطأ أثناء جلب البيانات' : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchIncident();
  }, [id, language]);

  // 🚀 الاستماع لتحديثات الحالة لايف (لو أحد قفله من برا تتحدث الصفحة هذي)
  useEffect(() => {
    const socket = io("https://husn-project.online", { path: "/socket.io" });

    socket.on("incident-status-updated", ({ id: updatedId, status }) => {
      if (updatedId === id) {
        setData((prev: any) => prev ? { ...prev, status } : prev);
      }
    });

    return () => { socket.disconnect(); };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p>{language === 'ar' ? 'جاري تحميل التفاصيل...' : 'Loading details...'}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">{language === 'ar' ? 'الحادث غير موجود' : 'Incident not found'}</h1>
          <Button onClick={() => navigate('/incidents')}>{t('cancel')}</Button>
        </div>
      </div>
    );
  }

  // 🚀 الدالة الفتاكة: إرسال أمر إغلاق البلاغ للسيرفر
  const handleResolve = async () => {
    try {
      const response = await fetch(`https://husn-project.online/api/incidents/${data.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(language === 'ar' ? 'تم إغلاق البلاغ بنجاح' : 'Incident marked as resolved');
        // تحديث الشاشة محلياً
        setData({ ...data, status: 'resolved' });
      } else {
        toast.error(result.error || (language === 'ar' ? 'خطأ في التحديث' : 'Update failed'));
      }
    } catch (error) {
      console.error("خطأ في الاتصال:", error);
      toast.error(language === 'ar' ? 'حدث خطأ في الاتصال' : 'Connection error');
    }
  };

  const isRTL = language === 'ar';

  return (
    <div className="min-h-screen bg-background text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="h-14 border-b border-border bg-card/50 backdrop-blur-sm px-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Button size="icon" variant="ghost" onClick={() => navigate('/incidents')}>
            <ArrowLeft className={`w-5 h-5 ${isRTL ? 'rotate-180' : ''}`} />
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="font-mono font-bold">{data.id.split('-')[1] || data.id}</span>
          </div>
          <Badge 
            variant="outline" 
            className={
              data.status === 'active' ? 'border-destructive text-destructive' :
              data.status === 'resolved' ? 'border-success text-success' :
              'border-warning text-warning'
            }
          >
            {data.status === 'active' ? t('active') : data.status === 'resolved' ? (isRTL ? 'محلول' : 'Resolved') : t('pending')}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {/* إذا الحالة مو محلول، يطلع له الزر */}
          {data.status !== 'resolved' && (
            <Button variant="success" onClick={handleResolve}>
              <CheckCircle2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {isRTL ? 'تحديد كمحلول' : 'Mark Resolved'}
            </Button>
          )}
        </div>
      </header>

      <main className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          {/* العمود الأيسر - الخريطة والوسائط */}
          <div className="lg:col-span-2 space-y-4">
            {/* الخريطة */}
            <div className="panel h-[300px]">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="panel-title">{isRTL ? 'موقع الحادث' : 'Incident Location'}</span>
                </div>
              </div>
              <div className="flex-1 h-[calc(100%-48px)] bg-muted/30 relative tactical-grid overflow-hidden rounded-b-lg">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/20 border-2 border-destructive flex items-center justify-center animate-pulse">
                      <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    <p className="font-medium text-foreground">{data.location.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {data.location.lat.toFixed(4)}, {data.location.lon.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* معرض الصور/الفيديو */}
            {data.media.length > 0 && (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">{t('capturedFrame')}</span>
                  <span className="text-xs text-muted-foreground">
                    {currentMediaIndex + 1} / {data.media.length}
                  </span>
                </div>
                <div className="relative aspect-video bg-black overflow-hidden rounded-b-lg">
                  <img 
                    src={data.media[currentMediaIndex]} 
                    alt="Fire Evidence"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* العمود الأيمن - التفاصيل */}
          <div className="space-y-4">
            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">{isRTL ? 'ملخص الحادث' : 'Incident Summary'}</span>
              </div>
              <div className="p-4 space-y-6">
                {/* الموقع */}
                <div>
                  <span className="data-label">{t('map')}</span>
                  <p className="text-sm font-medium mt-1">{data.location.name}</p>
                </div>

                {/* الوقت */}
                <div>
                  <span className="data-label">{isRTL ? 'وقت الرصد' : 'Detection Time'}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{format(new Date(data.startTime), 'PPpp')}</span>
                  </div>
                </div>

                {/* نسبة الثقة */}
                <div>
                  <span className="data-label">{t('detectionConfidence')}</span>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{isRTL ? 'ثقة الذكاء الاصطناعي' : 'AI Confidence'}</span>
                      <span className="font-bold text-primary">
                        {typeof data.confidence === 'number' && data.confidence <= 1 
                          ? Math.round(data.confidence * 100) 
                          : data.confidence}%
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-alert-high transition-all"
                        style={{ width: `${typeof data.confidence === 'number' && data.confidence <= 1 ? data.confidence * 100 : data.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 🚀 إضافة زر الإبلاغ عن خطأ (Flag) هنا في الأسفل */}
            <div className="panel p-4 space-y-2">
              <Button 
                variant="ghost" 
                className="w-full text-muted-foreground hover:text-destructive justify-start" 
                onClick={() => toast.info(isRTL ? 'تم الإبلاغ عن الإنذار الكاذب' : 'False positive reported')}
              >
                <Flag className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {t('reportFalsePositive')}
              </Button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default IncidentDetail;