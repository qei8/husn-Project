import requests
import time
# هنا تسوين import لمكتبة الدرون حقتك (مثل DJI SDK)

SERVER_URL = "https://husn-project.online/api/drone/telemetry"

def send_telemetry():
    while True:
        # 1. قراءة البيانات الحقيقية من الـ SDK حق الدرون
        # current_lat = drone.get_latitude() 
        # current_battery = drone.get_battery()
        
        # مثال لبيانات بنرسلها (تتحدث كل دورة):
        payload = {
            "id": "HUSN-UAV-01",
            "battery": 85,           # نسبة البطارية
            "lat": 18.2465,          # خط العرض
            "lon": 42.5117,          # خط الطول
            "altitude": 120.5,       # الارتفاع
            "speed": 15.2            # السرعة
        }
        
        try:
            # 2. إرسال البيانات للباك-إند
            requests.post(SERVER_URL, json=payload)
            print("📡 تم إرسال بيانات الدرون بنجاح")
        except Exception as e:
            print("❌ خطأ في إرسال البيانات:", e)
            
        # 3. ننتظر ثانيتين قبل نرسل التحديث الجاي عشان ما نضغط السيرفر
        time.sleep(2)

# تشغيل الدالة
if __name__ == "__main__":
    send_telemetry()