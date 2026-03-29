import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// استيراد المكونات
import DashboardHeader from '@/components/layout/DashboardHeader'; // تأكدي أن المسار صحيح
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
    // تأكدي إن parsed.role قيمتها بالضبط 'admin'
    setCurrentUser({
      name: parsed.name,
      role: parsed.role.toLowerCase() // تحويل لسمول للضمان
    });
  }
}, []);
useEffect(() => {
  // غيري الرابط للأي بي حق سيرفرك وبورت السوكت (8080 أو 8001 حسب اللي شغال)
  const socket = io("http://13.62.189.199:8080", { 
    transports: ["websocket"],
    reconnection: true
  });

  socket.on("connect", () => {
    console.log("✅ Socket Connected directly to HUSN Server");
    toast.success(language === 'ar' ? "متصل بالدرون آمن" : "UAV Securely Connected");
  });

  // 🚀 الحركة الفتاكة: استقبال بلاغ الحريق فوراً من YOLO
  socket.on("new-incident", (incident: any) => {
    console.log("🔥 HUSN Alert Received:", incident);
    
    // تحويل البيانات لتناسب تنسيق الـ Alert في الفرونت
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

    // إضافة البلاغ في أول القائمة فوراً
    setAlerts(prev => [newAlert, ...prev]);
    
    // إظهار تنبيه منبثق للمستخدم
    setCenteredAlert(newAlert);
    toast.error(language === 'ar' ? "⚠️ تم رصد حريق جديد!" : "⚠️ New Fire Detected!");
  });

  socket.on("connect_error", (err) => {
    console.error("❌ Socket Error:", err.message);
  });

  return () => { socket.disconnect(); };
}, [language]);

  // جلب البلاغات
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
    const interval = setInterval(loadIncidents, 5000);
    return () => clearInterval(interval);
  }, []);

  // جلب الطقس
  useEffect(() => {
    if (telemetry.lat && telemetry.lon) {
      getCurrentWeather(telemetry.lat, telemetry.lon).then(setWeather).catch(console.error);
    }
  }, [telemetry.lat, telemetry.lon]);

  const handleViewDetails = (alert: Alert) => navigate(`/incidents/${alert.id}`);

  return (
    <div className="min-h-screen bg-background text-foreground" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      
      {/* الهيدر الموحد */}
      <DashboardHeader />
      
      <main className="p-4">
        {/* الصف الأول: البث المباشر والخريطة */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2 h-[400px]">
            <VideoPanel telemetry={telemetry} />
          </div>
          <div className="h-[400px]">
            <MapPanel telemetry={telemetry} alerts={alerts} onAlertClick={setCenteredAlert} />
          </div>
        </div>

        {/* الصف الثاني: التنبيهات والطقس/الإجراءات */}
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
      {/* هذا الزر يظهر للجميع */}
      <Button variant="tactical" className="w-full justify-start" onClick={() => navigate('/incidents')}>
        <AlertCircle className={`w-4 h-4 ${language === 'ar' ? 'ml-3' : 'mr-3'}`} /> {t('viewAllIncidents')}
      </Button>

      {/* حماية قوية: الزر لن يظهر في الـ DOM أبداً إلا إذا كان المستخدم admin */}
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

            {/* قسم حالة الطقس المرن */}
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

      {centeredAlert && (
        <CenteredAlert 
          alert={centeredAlert} 
          onViewDetails={() => handleViewDetails(centeredAlert)} 
          onConfirm={() => setCenteredAlert(null)} 
          onDismiss={() => setCenteredAlert(null)} 
        />
      )}
    </div>
  );
};

export default Dashboard;