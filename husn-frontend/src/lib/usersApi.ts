const API_BASE = "https://husn-project.online/api";
// 1. دالة إضافة موظف جديد (Admin Only)
export async function addUser(userData: { userId: string; name: string; role: string }) {
  const res = await fetch(`${API_BASE}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "فشل إضافة الموظف");
  }
  return res.json();
}

// 2. دالة تغيير حالة الموظف (Active/Inactive)
export async function updateUserStatus(userId: string, status: "Active" | "Inactive") {
  const res = await fetch(`${API_BASE}/api/users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) throw new Error("فشل تحديث الحالة");
  return res.json();
}

// 3. دالة تسجيل الدخول (شغالة تمام)
export async function loginUser(userId: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "فشل تسجيل الدخول");
  }
  return res.json();
}

// 4. الدالة المعدلة - تغيير الباسوورد (المسار الجديد المتوقع)
export const changePassword = async (userId: string, currentPass: string, newPass: string) => {
  // استخدمي رابط الـ CloudFront الجديد والآمن
const response = await fetch(`https://husn-project.online/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      userId, 
      currentPassword: currentPass, 
      newPassword: newPass 
    }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Unauthorized');
  }
  return response.json();
};

export const verify2FA = async (userId: string, token: string, secret: string) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/2fa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userToken: token, userSecret: secret }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "الرمز غير صحيح");
  }

  return response.json();
};