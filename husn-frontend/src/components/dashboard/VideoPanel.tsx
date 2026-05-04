import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Button } from '@/components/ui/button';
import {

  Signal,
  Battery,
  Thermometer,
  Wind,
  Droplets,
  Gauge,
  Navigation
} from 'lucide-react';
import { UAVTelemetry } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';

interface VideoPanelProps {
  telemetry: UAVTelemetry;
}

const STREAM_URL =
  import.meta.env.VITE_STREAM_URL || `https://husn-project.online/live/drone.m3u8?t=${Date.now()}`;

const VideoPanel = ({ telemetry }: VideoPanelProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const { t } = useLanguage();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setStreamError(null);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = STREAM_URL;
      video.play().catch(() => {});
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true, 
        backBufferLength: 0,  
        liveSyncDurationCount: 3,
      });

      hls.loadSource(STREAM_URL);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('HLS error:', data);
        setStreamError('Stream unavailable');
      });

      return () => {
        hls.destroy();
      };
    } else {
      setStreamError('HLS not supported in this browser');
    }
  }, []);

  return (
    <div className="panel h-full flex flex-col">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <div className="status-indicator status-indicator-active" />
          <span className="panel-title">{t('liveFeed')} — {telemetry.id}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono">
            {new Date(telemetry.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>

      <div className="relative flex-1 bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          controls
          className="w-full h-full object-cover"
        />

        {streamError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center space-y-2">
              <div className="w-24 h-24 mx-auto rounded-full border-2 border-primary/30 flex items-center justify-center">
              
              </div>
              <p className="text-sm text-muted-foreground">{streamError}</p>
              <p className="text-xs text-muted-foreground/80">{STREAM_URL}</p>
            </div>
          </div>
        )}

       

        {isRecording && (
          <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive/20 border border-destructive rounded px-3 py-1">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="text-xs text-destructive font-medium">REC</span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-4">
          <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
            <TelemetryItem icon={Battery} label={t('battery')} value={`${Math.round(telemetry.battery)}%`} warning={telemetry.battery < 30} />
            <TelemetryItem icon={Signal} label={t('signal')} value={`${Math.round(telemetry.signal)}%`} warning={telemetry.signal < 50} />
            <TelemetryItem icon={Thermometer} label={t('temp')} value={`${Math.round(telemetry.temperature)}°C`} />
            <TelemetryItem icon={Wind} label={t('wind')} value={`${Math.round(telemetry.windSpeed)} km/h`} />
            <TelemetryItem icon={Droplets} label={t('humidity')} value={`${Math.round(telemetry.humidity)}%`} />
            <TelemetryItem icon={Gauge} label={t('alt')} value={`${Math.round(telemetry.altitude)}m`} />
            <TelemetryItem icon={Navigation} label={t('speed')} value={`${Math.round(telemetry.speed)} km/h`} />
          </div>
        </div>
      </div>
    </div>
  );
};

interface TelemetryItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  warning?: boolean;
}

const TelemetryItem = ({ icon: Icon, label, value, warning }: TelemetryItemProps) => (
  <div className="flex flex-col items-center gap-1">
    <Icon className={`w-4 h-4 ${warning ? 'text-destructive' : 'text-muted-foreground'}`} />
    <span className={`text-xs font-mono ${warning ? 'text-destructive' : 'text-foreground'}`}>{value}</span>
    <span className="data-label text-[10px]">{label}</span>
  </div>
);

export default VideoPanel;