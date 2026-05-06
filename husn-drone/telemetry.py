import requests
import time
from djitellopy import Tello

# الرابط المحلي للسيرفر
SERVER_URL = "http://127.0.0.1:8080/api/drone/telemetry"

tello = Tello()

try:
    tello.connect()
    print("✅ تم الاتصال بالدرون بنجاح")
except Exception as e:
    print(f"❌ فشل الاتصال بالدرون: {e}")

def send_telemetry():
    while True:
        try:
            # سحب الحالة الكاملة للدرون (أضمن طريقة للقراءة الحية)
            state = tello.get_current_state()
            
            # استخراج القيم من مصفوفة الحالة
            # 'bat' هي البطارية، 'h' الارتفاع، 'vgx' السرعة الطولية
            battery = int(state.get('bat', 0))
            height = int(state.get('h', 0))
            speed = int(state.get('vgx', 0))

            # إذا كانت البطارية أكبر من 0، نرسل البيانات
            if battery > 0:
                payload = {
                    "id": "HUSN-UAV-01",
                    "battery": battery,
                    "lat": 18.2465,  
                    "lon": 42.5117,
                    "altitude": height,
                    "speed": speed,
                }
                
                # إرسال البيانات للباك-إند
                response = requests.post(SERVER_URL, json=payload, timeout=5)
                
                if response.status_code == 200:
                    print(f"📡 [حُصن] بيانات حية: البطارية {battery}% | الارتفاع {height}")
                else:
                    print(f"⚠️ السيرفر رد بخطأ: {response.status_code}")
            else:
                print("⚠️ الحساسات تعطي 0، تأكدي من شحن البطارية أو ثبات الاتصال...")

        except Exception as e:
            print(f"❌ خطأ أثناء جلب البيانات: {e}")

        # ننتظر ثانيتين قبل التحديث القادم عشان ما نضغط الشبكة
        time.sleep(2)

if __name__ == "__main__":
    send_telemetry()