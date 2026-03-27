import 'dotenv/config';
import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const app = express();

// ==========================================
// 1. إعدادات الـ CORS (حل مشكلة Failed to Fetch)
// ==========================================
app.use(cors({
  origin: '*', // يسمح لـ Vercel وأي مصدر آخر بالاتصال بالسيرفر
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
  res.json({ status: "UP", message: "Server is reachable from Vercel" });
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

// =========================
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

    if (user.status === "Inactive") {
      return res.status(403).json({ error: "حسابك معطل حالياً، تواصل مع الإدارة" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "كلمة المرور خاطئة" });

    res.json({
      userId: user.userId,
      name: user.name,
      role: user.role,
      isFirstLogin: user.isFirstLogin
    });
  } catch (e) {
    console.error(e);
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
  const { userId, name, role = "staff" } = req.body;
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

// كود حذف المستخدم من الباكيند (Node.js + DynamoDB)
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const params = {
      TableName: "Users", // تأكدي إن هذا نفس اسم جدول اليوزرز عندك في AWS
      Key: {
        userId: id
      }
    };

    await dynamoDb.delete(params).promise();
    res.status(200).send({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).send({ error: "Could not delete user" });
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

    const lat = req.body.lat ? Number(req.body.lat) : 21.5;
    const lng = req.body.lng ? Number(req.body.lng) : 39.2;
    const uavId = req.body.uavId || "UAV-01";

    const modelResult = await analyzeImageWithModel(req.file.buffer, req.file.originalname, req.file.mimetype);

    if (!modelResult.detected) {
      return res.json({ detected: false, modelResult });
    }

    const key = `uploads/${Date.now()}-${req.file.originalname}`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: req.file.mimetype,
      Body: req.file.buffer,
    }));

    const incidentId = `INC-${uuidv4()}`;
    const item = {
      incidentId,
      pk: "INCIDENT",
      detectionTime: new Date().toISOString(),
      s3Key: key,
      status: "Active",
      confidence: modelResult.confidence || 0,
      lat, lng, uavId,
      label: modelResult.label || "fire"
    };

    await ddb.send(new PutCommand({ TableName: INCIDENTS_TABLE, Item: item }));
    res.status(201).json({ detected: true, incident: item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal error" });
  }
});

// =========================
// 7. تشغيل السيرفر
// =========================
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`
  ==========================================
  🚀 HUSN Server is officially Online!
  📍 Port: ${port}
  📍 Health: http://your-ip:${port}/health
  ==========================================
  `);
});