// تأكدي إن الرابط ينتهي بـ /api فقط بدون تكرار
const API_BASE = "http://13.62.189.199:8080/api";

export async function getIncidents(limit = 20) {
  try {
    // حذفنا الـ /api/ المكررة هنا
    const res = await fetch(`${API_BASE}/incidents?limit=${limit}`);
    if (!res.ok) throw new Error("Failed to fetch incidents");
    return await res.json();
  } catch (error) {
    console.error("Error fetching incidents:", error);
    return [];
  }
}

export async function getIncidentById(id: string) {
  // حذفنا الـ /api/ المكررة هنا
  const res = await fetch(`${API_BASE}/incidents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch incident");
  return res.json();
}

export async function reportIncidentFromFile(
  file: File,
  options: { lat?: number; lng?: number; uavId?: string } = {}
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("lat", String(options.lat ?? 21.5));
  formData.append("lng", String(options.lng ?? 39.2));
  formData.append("uavId", options.uavId ?? "UAV-01");

  // حذفنا الـ /api/ المكررة هنا، وصار يكلم /drone/frame مباشرة
  const res = await fetch(`${API_BASE}/drone/frame`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }

  return res.json();
}