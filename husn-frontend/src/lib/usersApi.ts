const API_BASE = "https://duwcseegvhq1t.cloudfront.net";

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
  const response = await fetch(`http://13.63.154.193:8080/api/auth/change-password`, {
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