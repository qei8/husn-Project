import 'dotenv/config';
import NodeMediaServer from 'node-media-server';
import { Server } from 'socket.io';
import path from 'path';


const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000, // اكتبيه رقم كذا مباشرة
    allow_origin: '*',
    mediaroot: '/home/ubuntu/husn-backend/media'
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsPath: './media/live',
        hlsFlags: '[hls_time=2:hls_list_size=3:flags=delete_segments]'
      }
    ]
  }
};

const nms = new NodeMediaServer(config);
nms.run();
console.log("HUSN Stream Server FIXED! 🚀");