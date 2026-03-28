import 'dotenv/config';
import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

import { createServer } from "http";
import { Server } from "socket.io";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { 
  DynamoDBDocumentClient, 
  PutCommand, 
  GetCommand, 
  ScanCommand, 
  UpdateCommand, 
  DeleteCommand 
} from "@aws-sdk/lib-dynamodb";

const app = express();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*", // عشان يسمح لـ Vercel يكلمه
    methods: ["GET", "POST"]
  }
});

// ==========================================
// 1. إعدادات الـ CORS
// ==========================================
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// إعدادات AWS من ملف .env
const s3 = new S3Client({ region: process.env.AWS_REGION });
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
);

const BUCKET = process.env.S3_BUCKET_NAME;
const INCIDENTS_TABLE = process.env.DDB_INCIDENTS_TABLE;
const USERS_TABLE = process.env.DDB_USERS_TABLE;
const MODEL_API_URL = process.env.MODEL_API_URL;


console.log("🚀 BOOTING HUSN SYSTEM...", {
  REGION: process.env.AWS_REGION,
  BUCKET: BUCKET,
  TABLE_INCIDENTS: INCIDENTS_TABLE,
  TABLE_USERS: USERS_TABLE
});

// =========================
// 2. مسارات اختبار السيرفر (Health Checks)
// =========================
app.get("/", (req, res) => {
  res.send("🚀 HUSN System API is Running and Secure!");
});

app.get("/health", (req, res) => {
  res.json({ status: "UP", message: "Server is reachable" });
});

// =========================
// 3. مساعدات (Helpers)
// =========================
async function analyzeImageWithModel(fileBuffer, fileName, contentType) {
  if (!MODEL_API_URL) {
    return { detected: false, message: "Model URL not configured" };
  }
  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: contentType });
    formData.append("file", blob, fileName);

    const response = await fetch(`${MODEL_API_URL}/predict`, {
      method: "POST",
      body: formData,
    });
    return response.json();
  } catch (error) {
    console.error("Model Analysis Error:", error);
    return { detected: false, error: "Failed to connect to AI Model" };
  }
}

// // =========================
// 4. نظام تسجيل الدخول (AUTH)
// =========================
app.post("/api/auth/login", async (req, res) => {
  const { userId, password } = req.body;
  try {
    const result = await ddb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    const user = result.Item;
    if (!user) return res.status(404).json({ error: "الموظف غير موجود" });
    if (user.status === "Inactive") return res.status(403).json({ error: "حسابك معطل" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "كلمة المرور خاطئة" });

    // --- منطق الـ 2FA الإلزامي ---
    let currentSecret = user.twoFactorSecret;
    let currentQrCode = null;

    if (!currentSecret) {
      // موظف قديم أو جديد ما عنده سكرت، نولد له واحد "حالا"
      const secretObj = speakeasy.generateSecret({ name: `HUSN:${user.userId}` });
      currentSecret = secretObj.base32;
      
      // تحديث DynamoDB فوراً
      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: user.userId },
        UpdateExpression: "set twoFactorSecret = :s, is2FAEnabled = :e",
        ExpressionAttributeValues: { 
          ":s": currentSecret, 
          ":e": true 
        }
      }));
      
      // توليد الباركود
      currentQrCode = await QRCode.toDataURL(secretObj.otpauth_url);
      console.log(`✅ 2FA Auto-Enabled for: ${user.userId}`);
    }

    // الرد النهائي بمسميات مطابقة لما يتوقعه الـ React
    res.json({
      userId: user.userId,
      name: user.name,
      role: user.role,
      isFirstLogin: user.isFirstLogin,
      twoFactorEnabled: true,
      twoFactorSecret: currentSecret, // لازم الاسم هنا يطابق المتغير اللي فوقه
      qrCode: currentQrCode
    });

  } catch (e) {
    console.error("Login Error:", e);
    res.status(500).json({ error: "فشل تسجيل الدخول" });
  }
});

app.post("/api/auth/change-password", async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;
  try {
    const result = await ddb.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    const user = result.Item;
    if (!user) return res.status(404).json({ error: "الموظف غير موجود" });

    if (!user.isFirstLogin) {
      if (!currentPassword) return res.status(400).json({ error: "يجب إدخال كلمة المرور الحالية" });
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await ddb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "set password = :p, isFirstLogin = :f",
      ExpressionAttributeValues: { ":p": hashedPassword, ":f": false }
    }));

    res.json({ message: "تم تحديث كلمة المرور بنجاح" });
  } catch (e) {
    res.status(500).json({ error: "فشل تحديث كلمة المرور" });
  }
});

// =========================
// 5. إدارة المستخدمين (USERS)
// =========================
app.get("/api/users", async (req, res) => {
  try {
    const result = await ddb.send(new ScanCommand({ TableName: USERS_TABLE }));
    res.json(result.Items || []);
  } catch (e) {
    res.status(500).json({ error: "فشل جلب قائمة الموظفين" });
  }
});

app.post("/api/users", async (req, res) => {
  const { userId, name, role = "employee" } = req.body;
  try {
    const tempPass = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(tempPass, 10);

    const newUser = {
      userId, name, role,
      password: hashedPassword,
      status: "Active",
      isFirstLogin: true,
      createdAt: new Date().toISOString()
    };

    await ddb.send(new PutCommand({ TableName: USERS_TABLE, Item: newUser }));
    res.status(201).json({ message: "تمت إضافة الموظف", tempPass });
  } catch (e) {
    res.status(500).json({ error: "فشل إنشاء الحساب" });
  }
});

app.patch("/api/users/:id/status", async (req, res) => {
  const { status } = req.body; 
  try {
    await ddb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId: req.params.id },
      UpdateExpression: "set #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status }
    }));
    res.json({ message: "تم تحديث الحالة" });
  } catch (e) {
    res.status(500).json({ error: "فشل تحديث الحالة" });
  }
});


app.delete('/api/users/:userId', async (req, res) => {
  const { userId } = req.params; 
  
  // سوي console.log هنا عشان تشوفي في الـ Logs حقت Vercel إذا الطلب وصل
  console.log("جاري حذف المستخدم:", userId);

  try {
    await ddb.send(new DeleteCommand({
      TableName: USERS_TABLE,
      Key: { userId: userId } 
    }));
    res.status(200).json({ message: "تم الحذف بنجاح" });
  } catch (error) {
    console.error("خطأ في DynamoDB:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================
// 6. الحوادث (INCIDENTS)
// =========================
app.get("/api/incidents", async (req, res) => {
  try {
    const result = await ddb.send(new ScanCommand({ TableName: INCIDENTS_TABLE }));
    res.json(result.Items || []);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

app.post("/api/drone/frame", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "file is required" });

    // 1. استلام البيانات من الموديل (detector.py)
    const lat = req.body.lat ? Number(req.body.lat) : 21.5;
    const lng = req.body.lng ? Number(req.body.lng) : 39.2;
    const uavId = req.body.uavId || "UAV-01";

    // 2. رفع الصورة لـ S3 (عشان تظهر في الموقع للأبد)
    const key = `uploads/${Date.now()}-${req.file.originalname}`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: req.file.mimetype,
      Body: req.file.buffer,
    }));

    // 3. تجهيز بيانات البلاغ
    const incidentId = `INC-${uuidv4()}`;
    const item = {
      incidentId,
      pk: "INCIDENT",
      detectionTime: new Date().toISOString(),
      s3Key: key,
      status: "Active",
      confidence: 0.9, // الموديل لقطها خلاص
      lat, lng, uavId,
      label: "fire"
    };

    // 4. حفظ في DynamoDB
    await ddb.send(new PutCommand({ TableName: INCIDENTS_TABLE, Item: item }));

    // 🚀 5. الحركة الفتاكة: إرسال البلاغ فوراً للموقع (Socket.io)
    // تأكدي إن اسم المتغير عندك io
    if (typeof io !== 'undefined') {
        io.emit("new-incident", item); 
        console.log("🔥 HUSN: Alert broadcasted via Socket.io");
    }

    res.status(201).json({ detected: true, incident: item });
  } catch (error) {
    console.error("❌ Error in /api/drone/frame:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

//Google Authenticator
app.post("/api/2fa/setup", async (req, res) => {
  const { userId } = req.body; // نستخدم رقم الموظف اللي دخل به
  
  // 1. توليد مفتاح سري جديد
  const secret = speakeasy.generateSecret({
    name: `HUSN-System:${userId}`
  });

  try {
    // 2. حفظ المفتاح في DynamoDB للموظف هذا بالذات
    await ddb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "set twoFactorSecret = :s, is2FAEnabled = :e",
      ExpressionAttributeValues: { 
        ":s": secret.base32, 
        ":e": true 
      }
    }));

    // 3. تحويل الرابط لباركود وإرساله للفرونت إند
    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
      res.json({ qrCode: data_url });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "فشل إعداد التحقق" });
  }
});

app.post("/api/2fa/verify", (req, res) => {
  const { userToken, userSecret } = req.body;

  const verified = speakeasy.totp.verify({
    secret: userSecret, // السر اللي جبناه من الداتا بيز للمستخدم
    encoding: 'base32',
    token: userToken // الـ 6 أرقام اللي دخلها من جواله
  });

  if (verified) {
    res.json({ success: true, message: "تم التحقق! ✅" });
  } else {
    res.status(400).json({ success: false, message: "الرمز خاطئ ❌" });
  }
});

// =========================
// 7. تشغيل السيرفر
// =========================
const port = process.env.PORT || 8080;
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`
  ==========================================
  🚀 HUSN Server is officially Online!
  📍 Port: ${port}
  ==========================================
  `);
});