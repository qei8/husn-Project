import 'dotenv/config';
import express from "express";
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

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://husn-project.vercel.app');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());
app.use('/live', express.static('/home/ubuntu/husn-backend/media/live'));

const httpServer = createServer(app);

const io = new Server(httpServer, {
  path: "/socket.io",
  cors: {
    origin: "https://husn-project.vercel.app",
    methods: ["GET", "POST"],
    credentials: true
  }
});

const upload = multer({ storage: multer.memoryStorage() });

const s3 = new S3Client({ region: process.env.AWS_REGION });

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION })
);

const BUCKET = process.env.S3_BUCKET_NAME;
const INCIDENTS_TABLE = process.env.DDB_INCIDENTS_TABLE;
const USERS_TABLE = process.env.DDB_USERS_TABLE;

console.log("🚀 BOOTING HUSN SYSTEM...", {
  REGION: process.env.AWS_REGION,
  BUCKET,
  TABLE_INCIDENTS: INCIDENTS_TABLE,
  TABLE_USERS: USERS_TABLE
});

app.get("/", (req, res) => {
  res.send("🚀 HUSN System API is Running and Secure!");
});

app.get("/health", (req, res) => {
  res.json({ status: "UP", message: "Server is reachable" });
});

// =========================
// AUTH
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

    let currentSecret = user.twoFactorSecret;
    let currentQrCode = null;

    if (!currentSecret) {
      const secretObj = speakeasy.generateSecret({ name: `HUSN:${user.userId}` });
      currentSecret = secretObj.base32;

      await ddb.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId: user.userId },
        UpdateExpression: "set twoFactorSecret = :s, is2FAEnabled = :e",
        ExpressionAttributeValues: {
          ":s": currentSecret,
          ":e": true
        }
      }));

      currentQrCode = await QRCode.toDataURL(secretObj.otpauth_url);
    }

    res.json({
      userId: user.userId,
      name: user.name,
      role: user.role,
      isFirstLogin: user.isFirstLogin,
      twoFactorEnabled: true,
      twoFactorSecret: currentSecret,
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
      ExpressionAttributeValues: {
        ":p": hashedPassword,
        ":f": false
      }
    }));

    res.json({ message: "تم تحديث كلمة المرور بنجاح" });

  } catch (e) {
    res.status(500).json({ error: "فشل تحديث كلمة المرور" });
  }
});

// =========================
// USERS
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
      userId,
      name,
      role,
      password: hashedPassword,
      status: "Active",
      isFirstLogin: true,
      createdAt: new Date().toISOString()
    };

    await ddb.send(new PutCommand({
      TableName: USERS_TABLE,
      Item: newUser
    }));

    res.status(201).json({
      message: "تمت إضافة الموظف",
      tempPass
    });

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

  try {
    await ddb.send(new DeleteCommand({
      TableName: USERS_TABLE,
      Key: { userId }
    }));

    res.status(200).json({ message: "تم الحذف بنجاح" });

  } catch (error) {
    console.error("خطأ في DynamoDB:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================
// INCIDENTS
// =========================
app.get("/api/incidents", async (req, res) => {
  try {
    const result = await ddb.send(new ScanCommand({ TableName: INCIDENTS_TABLE }));
    res.json(result.Items || []);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

app.patch("/api/incidents/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const getResult = await ddb.send(new GetCommand({
      TableName: INCIDENTS_TABLE,
      Key: { incidentId: id }
    }));

    const incident = getResult.Item;

    if (!incident) {
      return res.status(404).json({ error: "البلاغ غير موجود" });
    }

    if (incident.status?.toLowerCase() === 'resolved' && status.toLowerCase() === 'active') {
      return res.status(403).json({ error: "لا يمكن إعادة تفعيل بلاغ تم حله مسبقاً" });
    }

    await ddb.send(new UpdateCommand({
      TableName: INCIDENTS_TABLE,
      Key: { incidentId: id },
      UpdateExpression: "set #s = :s",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status }
    }));

    io.emit("incident-status-updated", { id, status });

    res.json({
      success: true,
      message: "تم تحديث الحالة بنجاح"
    });

  } catch (error) {
    console.error("❌ خطأ في تحديث حالة البلاغ:", error);
    res.status(500).json({ error: error.message });
  }
});

// =========================
// DRONE FRAME: يرفع الصورة فقط
// =========================
app.post("/api/drone/frame", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "file is required" });
    }

    const lat = req.body.lat ? Number(req.body.lat) : 21.5;
    const lng = req.body.lng ? Number(req.body.lng) : 39.2;
    const uavId = req.body.uavId || "UAV-01";

    const key = `uploads/${Date.now()}-${req.file.originalname}`;

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: req.file.mimetype,
      Body: req.file.buffer,
    }));

    res.status(201).json({
      success: true,
      message: "Drone frame uploaded successfully",
      s3Key: key,
      lat,
      lng,
      uavId
    });

  } catch (error) {
    console.error("❌ Error in /api/drone/frame:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// =========================
// AI ALERT: هذا هو اللي يطلع الأليرت الحقيقي
// =========================
app.post("/api/ai/alert", async (req, res) => {
  try {
    const { alert, confidence, lat, lng, uavId } = req.body;

    if (!alert) {
      return res.status(200).json({
        detected: false,
        message: "No fire or smoke detected"
      });
    }

    const incidentId = `INC-${uuidv4()}`;

    const item = {
      incidentId,
      pk: "INCIDENT",
      detectionTime: new Date().toISOString(),
      status: "pending",
      confidence: confidence || 0.9,
      lat: lat || 21.5,
      lng: lng || 39.2,
      uavId: uavId || "UAV-01",
      label: alert
    };

    await ddb.send(new PutCommand({
      TableName: INCIDENTS_TABLE,
      Item: item
    }));

    io.emit("new-incident", item);

    console.log("🔥 AI Alert sent:", item);

    res.status(201).json({
      detected: true,
      incident: item
    });

  } catch (error) {
    console.error("❌ Error in /api/ai/alert:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

// =========================
// 2FA
// =========================
app.post("/api/2fa/setup", async (req, res) => {
  const { userId } = req.body;

  const secret = speakeasy.generateSecret({
    name: `HUSN-System:${userId}`
  });

  try {
    await ddb.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { userId },
      UpdateExpression: "set twoFactorSecret = :s, is2FAEnabled = :e",
      ExpressionAttributeValues: {
        ":s": secret.base32,
        ":e": true
      }
    }));

    QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
      if (err) {
        return res.status(500).json({ error: "فشل إنشاء QR Code" });
      }

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
    secret: userSecret,
    encoding: 'base32',
    token: userToken
  });

  if (verified) {
    res.json({ success: true, message: "تم التحقق! ✅" });
  } else {
    res.status(400).json({ success: false, message: "الرمز خاطئ ❌" });
  }
});

// =========================
// TELEMETRY
// =========================
app.post("/api/drone/telemetry", (req, res) => {
  const telemetryData = req.body;

  io.emit("telemetry-update", telemetryData);

  res.status(200).json({
    success: true,
    message: "Telemetry updated"
  });
});

// =========================
// START SERVER
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