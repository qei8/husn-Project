const API_BASE = "https://husn-project.online/api";

// 1. إضافة موظف جديد
export async function addUser(userData: { userId: string; name: string; role: string }) {
  const res = await fetch(`${API_BASE}/users`, {
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

// 2. تحديث حالة الموظف (هذي اللي كانت ناقصة أو فيها خطأ مسبب خربطة الأدمن)
export async function updateUserStatus(userId: string, status: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("فشل تحديث الحالة");
  return res.json();
}

// 3. تسجيل الدخول
export async function loginUser(userId: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
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

// 4. تغيير الباسوورد
export const changePassword = async (userId: string, currentPass: string, newPass: string) => {
  const response = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, currentPassword: currentPass, newPassword: newPass }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'فشل التغيير');
  }
  return response.json();
};

// 5. التحقق من الـ 2FA
export const verify2FA = async (userId: string, token: string, secret: string) => {
  const response = await fetch(`${API_BASE}/2fa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userToken: token, userSecret: secret }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "الرمز خطأ");
  }
  return response.json();
};