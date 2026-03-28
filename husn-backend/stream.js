import 'dotenv/config';
import NodeMediaServer from 'node-media-server';
import { Server } from 'socket.io';

const config = {
  rtmp: {
    port: parseInt(process.env.RTMP_PORT) || 1935, 
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: parseInt(process.env.HTTP_PORT) || 8000,
    allow_origin: '*',
    mediaroot: './media'
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg', 
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:flags=delete_segments]',
        hlsPath: '/home/ubuntu/husn-backend/media/live', // 👈 هذا هو التعديل السحري!
        dash: true,
        dashFlags: '[f=dash:window_size=3:extra_window_size=5]'
      }
    ]
  }
};

var nms = new NodeMediaServer(config);
nms.run();


// تشغيل السوكيت على بورت 8001
const io = new Server(8001, {
  cors: { origin: "*" }
});

console.log("HUSN Stream Server is LIVE! 🚀");
console.log("Telemetry Socket: ws://10.215.37.109:8001");

// الاستماع لبيانات الدرون الحقيقية فقط
nms.on('postPublish', (id, StreamPath, args) => {
  console.log('Drone Connected. Path:', StreamPath);
  
  // نرسل البيانات فقط إذا كانت قادمة من الدرون فعلاً
  if (args && Object.keys(args).length > 0) {
    console.log('Real Telemetry detected:', args);
    io.emit('telemetry-update', args);
  } else {
    console.log('No metadata received from drone yet.');
  }
});

io.on('connection', (socket) => {
  console.log('Dashboard connected to Telemetry ✅');
});