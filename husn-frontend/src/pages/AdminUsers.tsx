import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  UserPlus, 
  Power, 
  Search,
  Loader2,
  Shield,
  Trash2 
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import DashboardHeader from '@/components/layout/DashboardHeader';
import { addUser, updateUserStatus } from '@/lib/usersApi'; 

interface User {
  id: string; // يستخدم كـ Key في React
  userId: string; // المعرف الحقيقي في DynamoDB
  fullName: string;
  role: 'admin' | 'employee';
  isActive: boolean;
  lastLogin: string;
}

const AdminUsers = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    employeeId: '', // هذا الحقل في الفورم يمثل الـ userId المطلوب
    fullName: '',
    role: 'employee' as 'admin' | 'employee',
  });

  // حماية الصفحة
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const userData = savedUser ? JSON.parse(savedUser) : null;
    if (!userData || userData.role !== 'admin') {
      toast.error(language === 'ar' ? "عذراً، لا تملك صلاحية الوصول" : "Access Denied");
      navigate('/dashboard');
    }
  }, [navigate, language]);

  // جلب البيانات من السيرفر
  const fetchUsers = async () => {
    try {
      const res = await fetch("https://duwcseegvhq1t.cloudfront.net/api/users");
      const data = await res.json();
      const formattedUsers = data.map((u: any) => ({
        id: u.userId, // نستخدم الـ userId كـ id للـ State
        userId: u.userId, 
        fullName: u.name,
        role: u.role,
        isActive: u.status === "Active",
        lastLogin: u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Never'
      }));
      setUsers(formattedUsers);
    } catch (error) {
      toast.error(language === 'ar' ? "فشل جلب البيانات" : "Fetch failed");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [language]);

  // دالة الحذف المعدلة لتستخدم userId الصافي
 const handleDeleteUser = async (targetUserId: string, name: string) => {
  const confirmMsg = language === 'ar' 
    ? `هل أنتِ متأكدة من حذف الموظف (${name}) نهائياً؟` 
    : `Are you sure you want to delete ${name} permanently?`;
  
  if (window.confirm(confirmMsg)) {
    try {
      // لاحظي الرابط صار ينتهي بـ / والـ ID مباشرة بدون علامة استفهام
      const response = await fetch(`https://duwcseegvhq1t.cloudfront.net/api/users/${targetUserId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setUsers(prevUsers => prevUsers.filter(u => u.userId !== targetUserId));
        toast.success(language === 'ar' ? 'تم حذف الموظف بنجاح' : 'User deleted successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("Server Error:", response.status, errorData);
        toast.error(language === 'ar' ? 'الموظف غير موجود أو فشل الحذف' : 'Delete failed');
      }
    } catch (error) {
      console.error("Connection Error:", error);
      toast.error(language === 'ar' ? 'خطأ في الاتصال بالسيرفر' : 'Connection error');
    }
  }
};

  const handleAddUser = async () => {
    if (!newUser.employeeId || !newUser.fullName) {
      toast.error(language === 'ar' ? "يرجى تعبئة الحقول" : "Please fill all fields");
      return;
    }

    const isDuplicate = users.some(u => u.userId === newUser.employeeId);
    if (isDuplicate) {
      toast.error(language === 'ar' ? "رقم الموظف هذا موجود مسبقاً!" : "User ID already exists!");
      return;
    }

    setIsLoading(true);
    try {
      const result = await addUser({
        userId: newUser.employeeId,
        name: newUser.fullName,
        role: newUser.role
      });
      
      setUsers([...users, { 
        id: newUser.employeeId, 
        userId: newUser.employeeId, 
        fullName: newUser.fullName, 
        role: newUser.role, 
        isActive: true, 
        lastLogin: 'Never' 
      }]);
      
      setIsAddDialogOpen(false);
      setNewUser({ employeeId: '', fullName: '', role: 'employee' });
      toast.success(`${t('userAdded')}. Pass: ${result.tempPass}`, { duration: 10000 });
    } catch (error: any) {
      toast.error(language === 'ar' ? "فشل إضافة المستخدم" : "Failed to add user");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (targetUserId: string) => {
    const user = users.find(u => u.userId === targetUserId);
    if (!user) return;
    try {
      await updateUserStatus(user.userId, user.isActive ? 'Inactive' : 'Active');
      setUsers(users.map(u => u.userId === targetUserId ? { ...u, isActive: !u.isActive } : u));
      toast.success((language === 'ar' ? "تم تحديث حالة " : "Status updated for ") + user.fullName);
    } catch (error) {
      toast.error("Failed");
    }
  };

  const filteredUsers = users.filter(user => 
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.userId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <DashboardHeader />

      <main className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button size="icon" variant="ghost" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className={`w-5 h-5 ${language === 'ar' ? 'rotate-180' : ''}`} />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">{t('userManagement')}</h1>
            </div>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <UserPlus className={`w-5 h-5 ${language === 'ar' ? 'ml-2' : 'mr-2'}`} />
                {t('addUser')}
              </Button>
            </DialogTrigger>
            <DialogContent className={language === 'ar' ? 'text-right' : 'text-left'}>
              <DialogHeader>
                <DialogTitle>{t('addNewUser')}</DialogTitle>
                <DialogDescription>{t('addNewUserDesc')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>{t('employeeId')}</Label>
                  <Input value={newUser.employeeId} onChange={(e) => setNewUser({ ...newUser, employeeId: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('fullName')}</Label>
                  <Input value={newUser.fullName} onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>{t('role')}</Label>
                  <Select value={newUser.role} onValueChange={(value: any) => setNewUser({ ...newUser, role: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">{t('employee')}</SelectItem>
                      <SelectItem value="admin">{t('admin')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>{t('cancel')}</Button>
                <Button onClick={handleAddUser} disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  {t('addUser')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6">
          <div className="relative w-full max-md">
            <Search className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
            <Input
              placeholder={t('searchUsers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${language === 'ar' ? 'pr-10' : 'pl-10'}`}
            />
          </div>
        </div>

        <div className="panel overflow-hidden border rounded-xl bg-card shadow-md">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={language === 'ar' ? 'text-right' : 'text-left'}>{t('employeeId')}</TableHead>
                <TableHead className={language === 'ar' ? 'text-right' : 'text-left'}>{t('fullName')}</TableHead>
                <TableHead className={language === 'ar' ? 'text-right' : 'text-left'}>{t('role')}</TableHead>
                <TableHead className={language === 'ar' ? 'text-right' : 'text-left'}>{t('status')}</TableHead>
                <TableHead className={language === 'ar' ? 'text-right' : 'text-left'}>{t('lastLogin')}</TableHead>
                <TableHead className={language === 'ar' ? 'text-left' : 'text-right'}>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell className="font-mono">{user.userId}</TableCell>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>
                    <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                      {user.role === 'admin' ? t('admin') : t('employee')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={user.isActive ? 'border-green-500 text-green-500' : 'border-gray-400 text-gray-400'}>
                      {user.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{user.lastLogin}</TableCell>
                  <TableCell className={language === 'ar' ? 'text-left' : 'text-right'}>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => handleToggleActive(user.userId)}>
                        <Power className={`w-4 h-4 ${user.isActive ? 'text-green-500' : 'text-gray-400'}`} />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20"
                        onClick={() => handleDeleteUser(user.userId, user.fullName)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default AdminUsers;