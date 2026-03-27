// الرابط الجديد لسيرفر الـ EC2 حقك
const API_BASE = import.meta.env.VITE_API_URL || "https://duwcseegvhq1t.cloudfront.net/api";
export async function getIncidents(limit = 20) {
  // أضفنا try/catch لضمان عدم تعليق الموقع لو السيرفر طفى
  try {
    const res = await fetch(`${API_BASE}/api/incidents?limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch incidents");
    return await res.json();
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return []; // نرجع مصفوفة فاضية بدل ما ينهار الموقع
  }
}

export async function getIncidentById(id: string) {
  const res = await fetch(`${API_BASE}/api/incidents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch incident");
  return res.json();
}

// هذه الدالة هي اللي بيستخدمها الدرون (أو المحاكي) لرفع الصور
export async function reportIncidentFromFile(
  file: File,
  options: { lat?: number; lng?: number; uavId?: string } = {}
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("lat", String(options.lat ?? 21.5));
  formData.append("lng", String(options.lng ?? 39.2));
  formData.append("uavId", options.uavId ?? "UAV-01");

  const res = await fetch(`${API_BASE}/api/drone/frame`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }

  return res.json();
}