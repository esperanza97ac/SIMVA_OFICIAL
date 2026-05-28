// Firebase Cloud Messaging Service Worker
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyBaZxRzJXTYKcAM_Mt09Ga5l2Dji5hAlcQ",
  authDomain: "simva-6ed0f.firebaseapp.com",
  projectId: "simva-6ed0f",
  storageBucket: "simva-6ed0f.firebasestorage.app",
  messagingSenderId: "743152244291",
  appId: "1:743152244291:web:6ccd89428e2a0121c726f6"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ", payload);

  const notificationTitle = payload.notification?.title || "SIMVA - Alerta de Mantenimiento";
  const notificationOptions = {
    body: payload.notification?.body || "Tu vehículo requiere atención preventiva o correctiva.",
    icon: "/icon_simva_logo.png", // Fallback to icon
    badge: "/icon_simva_badge.png",
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
