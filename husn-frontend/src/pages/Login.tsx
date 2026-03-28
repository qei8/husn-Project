import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { loginUser, changePassword, verify2FA } from "@/lib/usersApi"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Flame,
  Eye,
  EyeOff,
  Lock,
  User,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import fireDetectionHero from "@/assets/fire-detection-hero.jpg";
import { useLanguage } from "@/contexts/LanguageContext";

type AuthStep = "LOGIN" | "NEW_PASSWORD"| "TWO_FACTOR";

const Login = () => {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [step, setStep] = useState<AuthStep>("LOGIN");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [loginData, setLoginData] = useState({
    employeeId: "",
    password: "", 
  });

  const [newPassword, setNewPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginData.employeeId || !loginData.password) {
      toast.error(language === 'ar' ? "يرجى إدخال الرقم الوظيفي وكلمة المرور" : "Please enter Employee ID and Password");
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginUser(loginData.employeeId, loginData.password);
      
      // 1. حفظ البيانات الأساسية (عشان نستخدم الـ secret في الخطوة الجاية)
      localStorage.setItem("user", JSON.stringify(result));

      if (result.qrCode) {
      setQrCodeUrl(result.qrCode); // 🚀 حفظ رابط الباركود
      }
      // 2. أول فحص: هل هو دخول أول مرة؟
      if (result.isFirstLogin) {
        setStep("NEW_PASSWORD");
        toast.info(language === 'ar' ? "يرجى تعيين كلمة مرور جديدة" : "Please set a new password");
      } 
      // 3. ثاني فحص (الأهم): هل الـ 2FA مفعل؟ 🚀
      // تأكدي إن الباكيند يرسل حقل اسمه twoFactorEnabled وقيمته true
      else if (result.twoFactorEnabled === true || result.twoFactorSecret) {
        setStep("TWO_FACTOR");
        toast.info(language === 'ar' ? "يرجى إدخال رمز التحقق من جوالك" : "Please enter 2FA code");
      } 
      // 4. إذا ما فيه لا هذا ولا هذا، يدخل الداشبورد
      else {
        const fullUserData = { ...result, password: loginData.password };
        localStorage.setItem("user", JSON.stringify(fullUserData));
        toast.success(language === 'ar' ? `مرحباً بك، ${result.name}` : `Welcome, ${result.name}`);
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "فشل تسجيل الدخول");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error(language === 'ar' ? "يرجى إدخال كلمة مرور جديدة (6 خانات على الأقل)" : "Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    try {
      await changePassword(loginData.employeeId, loginData.password, newPassword);
      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
      const updatedUser = { ...savedUser, password: newPassword, isFirstLogin: false };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      toast.success(language === 'ar' ? "تم تحديث كلمة المرور بنجاح" : "Password updated successfully");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || (language === 'ar' ? "حدث خطأ أثناء التحديث" : "Error updating password"));
    } finally {
      setIsLoading(false);
    }
  };

  const currentDir = language === 'ar' ? 'rtl' : 'ltr';

  if (step === "NEW_PASSWORD") {
    return (
      <div className="min-h-screen bg-background tactical-grid flex items-center justify-center p-4" dir={currentDir}>
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/30 mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">{t('addNewUser')}</h1>
            <p className="text-muted-foreground">{language === 'ar' ? "لحماية حسابك، يرجى اختيار كلمة مرور قوية" : "For security, please set a strong password"}</p>
          </div>

          <div className="panel p-6 border rounded-xl bg-card shadow-lg">
            <div className="space-y-6">
              <div className={`space-y-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                <Label htmlFor="newPassword">{language === 'ar' ? "كلمة المرور الجديدة" : "New Password"}</Label>
                <div className="relative">
                  <Lock className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    className={`${language === 'ar' ? 'pr-10' : 'pl-10'} h-12`}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-muted-foreground`}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button onClick={handleSetNewPassword} className="w-full h-12 text-lg font-bold" disabled={isLoading}>
                {isLoading && <Loader2 className="w-5 h-5 animate-spin ml-2" />}
                {language === 'ar' ? "حفظ ومتابعة" : "Save & Continue"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

 if (step === "TWO_FACTOR") {
  return (
    <div className="min-h-screen bg-background tactical-grid flex items-center justify-center p-4" dir={currentDir}>
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 border border-primary/30 mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {language === 'ar' ? "تأمين الحساب" : "Secure Your Account"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {qrCodeUrl 
              ? (language === 'ar' ? "امسح الباركود بتطبيق Google Authenticator لتفعيل الحماية" : "Scan the QR code with Google Authenticator to enable MFA")
              : (language === 'ar' ? "أدخل الرمز المكون من 6 أرقام من جوالك" : "Enter the 6-digit code from your phone")}
          </p>
        </div>

        <div className="panel p-6 border rounded-xl bg-card shadow-lg text-center">
          {/* 📸 عرض الباركود فقط لو كان الموظف يفعله لأول مرة */}
          {qrCodeUrl && (
            <div className="mb-6 p-4 bg-white rounded-lg inline-block border-4 border-primary/20">
              <img src={qrCodeUrl} alt="2FA QR Code" className="w-48 h-48 mx-auto" />
              <p className="text-[10px] text-black font-bold mt-2 uppercase tracking-widest">Scan Me</p>
            </div>
          )}

          <div className="space-y-6">
            <div className={`space-y-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              <Label htmlFor="otp">{language === 'ar' ? "رمز التحقق" : "Verification Code"}</Label>
              <Input
                id="otp"
                type="text"
                placeholder="000 000"
                maxLength={6}
                className="h-14 text-center text-3xl font-mono tracking-[0.3em] border-2 focus:border-primary"
                autoFocus
                onChange={async (e) => {
                  const otp = e.target.value;
                  if (otp.length === 6) {
                    setIsLoading(true);
                    try {
                      const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
                      await verify2FA(savedUser.userId, otp, savedUser.twoFactorSecret);
                      toast.success(language === 'ar' ? "تم التحقق بنجاح ✅" : "Verified successfully");
                      navigate("/dashboard");
                    } catch (error: any) {
                      toast.error(error.message || "الرمز غير صحيح");
                      e.target.value = "";
                    } finally {
                      setIsLoading(false);
                    }
                  }
                }}
              />
            </div>

            <Button variant="ghost" className="w-full text-xs underline" onClick={() => setStep("LOGIN")}>
              {language === 'ar' ? "إلغاء والرجوع للخلف" : "Cancel and Go Back"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

  return (
    <div className="min-h-screen bg-background flex" dir={currentDir}>
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img src={fireDetectionHero} alt="Fire detection" className="absolute inset-0 w-full h-full object-cover" />
        <div className={`absolute inset-0 bg-gradient-to-${language === 'ar' ? 'l' : 'r'} from-background/90 via-background/20 to-transparent`} />
        <div className={`absolute bottom-12 ${language === 'ar' ? 'right-12 text-right' : 'left-12 text-left'} text-white`}>
          <h2 className="text-4xl font-bold mb-4">{t('appName')}</h2>
          <p className="text-xl text-white/80 max-w-md">{t('appSubtitle')}</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 tactical-grid flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 border border-primary/20 mb-4 shadow-2xl">
              <Flame className="w-12 h-12 text-primary animate-pulse" />
            </div>
            <h1 className="text-4xl font-bold text-foreground mb-2">{language === 'ar' ? "تسجيل الدخول" : "Login"}</h1>
            <p className="text-muted-foreground">{language === 'ar' ? "أدخل بياناتك للوصول لنظام حُصن" : "Enter your credentials"}</p>
          </div>

          <div className="panel p-8 border rounded-2xl bg-card/80 backdrop-blur-md shadow-xl">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className={`space-y-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                <Label htmlFor="employeeId" className="text-sm font-semibold">{t('employeeId')}</Label>
                <div className="relative">
                  <User className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                  <Input
                    id="employeeId"
                    className={`${language === 'ar' ? 'pr-10' : 'pl-10'} h-12`}
                    value={loginData.employeeId}
                    onChange={(e) => setLoginData({ ...loginData, employeeId: e.target.value })}
                  />
                </div>
              </div>
              <div className={`space-y-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                <Label htmlFor="password" className="text-sm font-semibold">{language === 'ar' ? "كلمة المرور" : "Password"}</Label>
                <div className="relative">
                  <Lock className={`absolute ${language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className={`${language === 'ar' ? 'pr-10' : 'pl-10'} h-12`}
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute ${language === 'ar' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-muted-foreground`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={isLoading}>
                {isLoading && <Loader2 className="w-5 h-5 animate-spin ml-2" />}
                {language === 'ar' ? "دخول للنظام" : "Sign In"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;