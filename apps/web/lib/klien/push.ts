import { panggil } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function cekPushDidukung(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export function cekIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isStandalone = "standalone" in window.navigator && Boolean(window.navigator.standalone);
  return isIos && !isStandalone;
}

export async function daftarkanPush(): Promise<boolean> {
  if (!cekPushDidukung()) return false;

  const resKunci = await panggil("GET", "/api/push/kunci-publik", {});
  if (!resKunci.ok || !resKunci.data.kunciPublik) return false;

  const izin = await Notification.requestPermission();
  if (izin !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  const appServerKey = urlBase64ToUint8Array(resKunci.data.kunciPublik);

  const langganan = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: appServerKey.buffer as ArrayBuffer,
  });

  const p256dh = langganan.getKey("p256dh");
  const auth = langganan.getKey("auth");
  if (!p256dh || !auth) return false;

  const p256dhB64 = btoa(String.fromCharCode(...new Uint8Array(p256dh)));
  const authB64 = btoa(String.fromCharCode(...new Uint8Array(auth)));

  const resSimpan = await panggil("POST", "/api/push/langganan", {
    body: {
      endpoint: langganan.endpoint,
      keys: {
        p256dh: p256dhB64,
        auth: authB64,
      },
    },
  });

  return resSimpan.ok;
}
