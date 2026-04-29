import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// استيراد المكونات
import DashboardHeader from '@/components/layout/DashboardHeader';
import VideoPanel from '@/components/dashboard/VideoPanel';
import MapPanel from '@/components/dashboard/MapPanel';
import AlertsPanel from '@/components/dashboard/AlertsPanel';
import CenteredAlert from '@/components/dashboard/CenteredAlert';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  Users,
  Settings,
  CloudSun,
  Wind,
  Droplets
} from 'lucide-react'; 
import { Alert, UAVTelemetry } from '@/types';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { getIncidents } from '@/lib/incidentsApi';
import { getCurrentWeather } from '@/lib/weatherApi';
import { io } from 'socket.io-client';

const initialTelemetry: UAVTelemetry = {
  id: 'HUSN-UAV-01',
  battery: 0,
  signal: 0,
  speed: 0,
  altitude: 0,
  lat: 18.2465, 
  lon: 42.5117,
  temperature: 0,
  humidity: 0,
  windSpeed: 0,
  timestamp: new Date().toISOString(),
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  
  const [telemetry, setTelemetry] = useState<UAVTelemetry>(initialTelemetry);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [centeredAlert, setCenteredAlert] = useState<Alert | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<{name: string, role: string} | null>(null);

  // جلب بيانات المستخدم
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setCurrentUser({
        name: parsed.name,
        role: parsed.role.toLowerCase() 
      });
    }
  }, []);

  useEffect(() => {
    const socket = io("https://husn-project.online", {
      path: "/socket.io"
    });

    socket.on("connect", () => {
      console.log("✅ Socket Connected directly to HUSN Server");
      toast.success(language === 'ar' ? "متصل بالدرون آمن" : "UAV Securely Connected");
    });

    // 🚁 استقبال بيانات الدرون الحية وتحديث الشاشة
    socket.on("telemetry-update", (data: any) => {
      setTelemetry(prev => ({
        ...prev,
        ...data, 
        timestamp: new Date().toISOString()
      }));
    });

    // تحديث الحالة لايف عبر السوكت
    socket.on("incident-status-updated", ({ id, status }) => {
      setAlerts(prev => prev.map(alert => 
        alert.id === id ? { ...alert, status } : alert
      ));
      setCenteredAlert(prev => prev?.id === id ? { ...prev, status } : prev);
    });

    // 🚀 استقبال بلاغ الحريق فوراً
    socket.on("new-incident", (incident: any) => {
      console.log("🔥 HUSN Alert Received:", incident);
      
      const newAlert: Alert = {
        id: incident.incidentId,
        timestamp: incident.detectionTime,
        confidence: Number(incident.confidence ?? 0),
        severity: Number(incident.confidence ?? 0) >= 95 ? 'critical' : 'high',
        status: 'active',
        location: {
          lat: Number(incident.lat ?? 0),
          lon: Number(incident.lng ?? 0),
          name: `Lat ${incident.lat}, Lon ${incident.lng}`
        },
        thumbnail: incident.s3Key ? `https://husn-fire-images.s3.eu-north-1.amazonaws.com/${incident.s3Key}` : undefined,
      };

      setAlerts(prev => [newAlert, ...prev]);
      setCenteredAlert(newAlert);
      toast.error(language === 'ar' ? "⚠️ تم رصد حريق جديد!" : "⚠️ New Fire Detected!");
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket Error:", err.message);
    });

    return () => { socket.disconnect(); };
  }, [language]);

  // جلب البلاغات القديمة
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const incidents = await getIncidents(20);
        const transformedAlerts: Alert[] = incidents.map((incident: any) => ({
          id: incident.incidentId,
          timestamp: incident.detectionTime,
          confidence: Number(incident.confidence ?? 0),
          severity: Number(incident.confidence ?? 0) >= 95 ? 'critical' : 'high',
          status: incident.status?.toLowerCase() || 'pending',
          location: {
            lat: Number(incident.lat ?? 0),
            lon: Number(incident.lng ?? 0),
            name: `Lat ${incident.lat}, Lon ${incident.lng}`
          },
          thumbnail: incident.s3Key ? `https://husn-fire-images.s3.eu-north-1.amazonaws.com/${incident.s3Key}` : undefined,
        }));
        setAlerts(transformedAlerts);
      } catch (e) { console.error(e); }
    };
    loadIncidents();
  }, []);

  // جلب الطقس
  useEffect(() => {
    if (telemetry.lat && telemetry.lon) {
      getCurrentWeather(telemetry.lat, telemetry.lon).then(setWeather).catch(console.error);
    }
  }, [telemetry.lat, telemetry.lon]);

  const handleViewDetails = (alert: Alert) => navigate(`/incidents/${alert.id}`);

  // 🚀 الدالة الجديدة: تحديث الحالة في قاعدة البيانات (DynamoDB)
  const updateIncidentStatus = async (incidentId: string, newStatus: string) => {
    try {
      const response = await fetch(`https://husn-project.online/api/incidents/${incidentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(language === 'ar' ? "تم تحديث الحالة" : "Status Updated");
      } else {
        toast.error(data.error || (language === 'ar' ? "خطأ في التحديث" : "Update failed"));
      }
    } catch (error) {
      console.error("خطأ في الاتصال:", error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      <DashboardHeader />
      
      <main className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2 h-[400px]">
            <VideoPanel telemetry={telemetry} />
          </div>
          <div className="h-[400px]">
            <MapPanel telemetry={telemetry} alerts={alerts} onAlertClick={setCenteredAlert} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-[350px]">
            <AlertsPanel 
              alerts={alerts} 
              onViewDetails={handleViewDetails} 
              onConfirm={() => setCenteredAlert(null)} 
              onDismiss={() => setCenteredAlert(null)} 
            />
          </div>

         <div className="panel p-4 flex flex-col justify-between h-[350px]">
          <div>
            <h3 className="panel-title mb-4 font-bold">{t('quickActions')}</h3>
            <div className="space-y-2">
              <Button variant="tactical" className="w-full justify-start" onClick={() => navigate('/incidents')}>
                <AlertCircle className={`w-4 h-4 ${language === 'ar' ? 'ml-3' : 'mr-3'}`} /> {t('viewAllIncidents')}
              </Button>

              {currentUser && currentUser.role === 'admin' && (
                <Button variant="tactical" className="w-full justify-start" onClick={() => navigate('/admin-users')}>
                  <Users className={`w-4 h-4 ${language === 'ar' ? 'ml-3' : 'mr-3'}`} /> {t('manageUsers')}
                </Button>
              )}

              <Button variant="tactical" className="w-full justify-start" onClick={() => navigate('/settings')}>
                <Settings className={`w-4 h-4 ${language === 'ar' ? 'ml-3' : 'mr-3'}`} /> {t('systemSettings')}
              </Button>
            </div>
          </div>

            {weather && (
              <div className="mt-4 pt-4 border-t border-border">
                <h4 className="data-label mb-4 flex items-center gap-2 text-primary font-bold">
                  <CloudSun className="w-4 h-4" /> {t('weatherConditions')}
                </h4>
                <div className="flex flex-wrap gap-y-4">
                  <div className="w-1/2 flex flex-col items-start px-1">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold mb-1">{t('condition')}</span>
                    <span className="text-foreground text-xs font-semibold truncate w-full">{weather.weather?.[0]?.description ?? '--'}</span>
                  </div>
                  <div className="w-1/2 flex flex-col items-start px-1">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold mb-1">{t('temp')}</span>
                    <span className="font-mono text-foreground text-sm font-bold">{weather.main?.temp ?? '--'}°C</span>
                  </div>
                  <div className="w-1/2 flex flex-col items-start px-1">
                    <span className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase font-bold mb-1"><Wind className="w-3 h-3" /> {t('wind')}</span>
                    <span className="font-mono text-foreground text-sm font-bold">{weather.wind?.speed ?? '--'} m/s</span>
                  </div>
                  <div className="w-1/2 flex flex-col items-start px-1">
                    <span className="text-muted-foreground flex items-center gap-1 text-[10px] uppercase font-bold mb-1"><Droplets className="w-3 h-3" /> {t('humidity')}</span>
                    <span className="font-mono text-foreground text-sm font-bold">{weather.main?.humidity ?? '--'}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

     {/* التنبيه المنبثق عند رصد حريق جديد */}
      {centeredAlert && (
        <CenteredAlert 
          alert={centeredAlert} 
          onViewDetails={() => handleViewDetails(centeredAlert)} 
          onConfirm={() => {
            // 🛑 شرط الحماية: إذا كان البلاغ خلاص انحل، نمنع المستخدم يرجعه أكتف
            if (centeredAlert.status === 'resolved') {
              toast.error(language === 'ar' ? "هذا البلاغ تم حله مسبقاً ولا يمكن إعادة تفعيله" : "Incident already resolved");
              return; // نوقف هنا وما نكمل للسيرفر
            }

            // ✅ إذا كان لسه جديد أو معلق، نحوله لـ Active في الداتا بيز
            updateIncidentStatus(centeredAlert.id, 'active');
            setCenteredAlert(null); // نقفل الشاشة بعد التأكيد
          }} 
          onDismiss={() => setCenteredAlert(null)} 
        />
      )}
    </div>
  );
};

export default Dashboard;