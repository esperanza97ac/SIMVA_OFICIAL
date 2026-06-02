import { useState, useEffect, FormEvent } from "react";
import { motion } from "motion/react";
import { 
  CarProfile, 
  MaintenanceTask, 
  TaskTracking 
} from "./types";
import Header from "./components/Header";
import CarProfileForm from "./components/CarProfileForm";
import TaskTracker from "./components/TaskTracker";
import EmptyState from "./components/EmptyState";
import { SimvaLogo } from "./components/SimvaLogo";
import { AlertTriangle, CheckCircle, Car, LayoutGrid, PlusCircle, User, Gauge, LogOut, Bike, Trash2, Plus, ArrowLeft, Wrench, Settings, FileText, Check, Sliders, Bell, Heart, MapPin, Pencil } from "lucide-react";
import Talleres from "./components/Talleres";
import MisDocumentos from "./components/MisDocumentos";

// Firebase integration
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser, EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { doc, getDoc, getDocs, setDoc, collection, writeBatch } from "firebase/firestore";
import AuthScreen from "./components/AuthScreen";

export function calculateVehicleLifeline(
  car: CarProfile, 
  tasksList: MaintenanceTask[] = [], 
  trackingList: TaskTracking[] = []
): number {
  if (!tasksList || tasksList.length === 0) return 100;

  let dangerDist = 500;
  let warnDist = 1000;
  try {
    const dVal = localStorage.getItem("simva_danger_distance");
    if (dVal) dangerDist = Number(dVal);
    const wVal = localStorage.getItem("simva_warn_distance");
    if (wVal) warnDist = Number(wVal);
  } catch (e) {
    // Ignore
  }

  let greenCount = 0;
  let amberCount = 0;
  let redCount = 0;

  tasksList.forEach((t) => {
    const track = trackingList.find((tr) => tr.id === t.id);
    let kmRemaining = Infinity;
    if (t.cada_km > 0) {
      const baseKm = (track && track.lastCompletedKm !== undefined) ? track.lastCompletedKm : 0;
      const nextDueKm = baseKm + t.cada_km;
      kmRemaining = nextDueKm - car.currentKm;
    }

    let monthsRemaining = Infinity;
    if (t.cada_meses > 0) {
      if (track && track.lastCompletedDate) {
        const lastDate = new Date(track.lastCompletedDate);
        const today = new Date();
        const diffYears = today.getFullYear() - lastDate.getFullYear();
        const diffMonths = today.getMonth() - lastDate.getMonth();
        const elapsedMonths = diffYears * 12 + diffMonths;
        monthsRemaining = Math.max(0, t.cada_meses - elapsedMonths);
      } else {
        if (kmRemaining !== Infinity) {
          const monthlyUsage = car.monthlyKm > 0 ? car.monthlyKm : 1000;
          monthsRemaining = kmRemaining / monthlyUsage;
        } else {
          monthsRemaining = t.cada_meses;
        }
      }
    }

    const roundedMonths = Math.max(0, Math.round(monthsRemaining));

    let statusColor: "danger" | "warning" | "ok" = "ok";
    if (t.cada_km > 0) {
      if (kmRemaining < dangerDist) {
        statusColor = "danger";
      } else if (kmRemaining <= warnDist) {
        statusColor = "warning";
      }
    } else {
      if (roundedMonths <= 1) {
        statusColor = "danger";
      } else if (roundedMonths <= 2) {
        statusColor = "warning";
      }
    }

    if (statusColor === "danger") {
      redCount++;
    } else if (statusColor === "warning") {
      amberCount++;
    } else {
      greenCount++;
    }
  });

  const total = greenCount + amberCount + redCount;
  if (total === 0) return 100;

  // Weighted score calculation: Green = 100, Amber = 50, Red = 10
  const totalScore = (greenCount * 100 + amberCount * 50 + redCount * 10) / total;
  return Math.round(totalScore);
}

export function getVehiclesOverallColor(
  car: CarProfile, 
  tasksList: MaintenanceTask[] = [], 
  trackingList: TaskTracking[] = []
): "danger" | "warning" | "ok" {
  if (!tasksList || tasksList.length === 0) return "ok";
  
  let dangerDist = 500;
  let warnDist = 1000;
  try {
    const dVal = localStorage.getItem("simva_danger_distance");
    if (dVal) dangerDist = Number(dVal);
    const wVal = localStorage.getItem("simva_warn_distance");
    if (wVal) warnDist = Number(wVal);
  } catch (e) {
    // Ignore
  }

  let finalStatus: "danger" | "warning" | "ok" = "ok";

  tasksList.forEach((task) => {
    const track = trackingList.find((t) => t.id === task.id);
    let kmRemaining = Infinity;
    if (task.cada_km > 0) {
      const baseKm = (track && track.lastCompletedKm !== undefined) ? track.lastCompletedKm : 0;
      const nextDueKm = baseKm + task.cada_km;
      kmRemaining = nextDueKm - car.currentKm;
    }

    let monthsRemaining = Infinity;
    if (task.cada_meses > 0) {
      if (track && track.lastCompletedDate) {
        const lastDate = new Date(track.lastCompletedDate);
        const today = new Date();
        const diffYears = today.getFullYear() - lastDate.getFullYear();
        const diffMonths = today.getMonth() - lastDate.getMonth();
        const elapsedMonths = diffYears * 12 + diffMonths;
        monthsRemaining = Math.max(0, task.cada_meses - elapsedMonths);
      } else {
        if (kmRemaining !== Infinity) {
          const monthlyUsage = car.monthlyKm > 0 ? car.monthlyKm : 1000;
          monthsRemaining = kmRemaining / monthlyUsage;
        } else {
          monthsRemaining = task.cada_meses;
        }
      }
    }

    const roundedMonths = Math.max(0, Math.round(monthsRemaining));

    let statusColor: "danger" | "warning" | "ok" = "ok";
    if (task.cada_km > 0) {
      if (kmRemaining < dangerDist) {
        statusColor = "danger";
      } else if (kmRemaining <= warnDist) {
        statusColor = "warning";
      }
    } else {
      if (roundedMonths <= 1) {
        statusColor = "danger";
      } else if (roundedMonths <= 2) {
        statusColor = "warning";
      }
    }

    if (statusColor === "danger") {
      finalStatus = "danger";
    } else if (statusColor === "warning" && finalStatus !== "danger") {
      finalStatus = "warning";
    }
  });

  return finalStatus;
}

function SVGTachometer({ isMoto }: { isMoto: boolean }) {
  const maxVal = isMoto ? 14 : 8;
  const redlineRange = isMoto ? 11 : 6;
  const currentRPM = isMoto ? 11.2 : 5.8; // High scale visualization targets for each mode
  
  // Needle orientation angle (-140deg to 140deg scale)
  const angle = -140 + (currentRPM / maxVal) * 280;

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-28 h-28 opacity-[0.65] pointer-events-none overflow-visible select-none transition-all duration-300 group-hover:opacity-[0.85]">
      <svg viewBox="0 0 100 100" className="w-full h-full text-white overflow-visible">
        {/* RPM Arch background grid */}
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        
        {/* High performance redline zone highlight arc */}
        {isMoto ? (
          <path
            d="M 76.8 76.8 A 38 38 0 0 1 50 88"
            fill="none"
            stroke="rgb(239, 68, 68)"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="opacity-60"
          />
        ) : (
          <path
            d="M 85.2 62.1 A 38 38 0 0 1 50 88"
            fill="none"
            stroke="rgb(239, 68, 68)"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="opacity-60"
          />
        )}

        {/* Dynamic scale tick markers */}
        {Array.from({ length: maxVal + 1 }).map((_, i) => {
          const tickAngle = -140 + (i / maxVal) * 280;
          const rad = (tickAngle * Math.PI) / 180;
          const x1 = 50 + 35 * Math.cos(rad);
          const y1 = 50 + 35 * Math.sin(rad);
          const x2 = 50 + 41 * Math.cos(rad);
          const y2 = 50 + 41 * Math.sin(rad);
          const isRed = i >= redlineRange;

          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isRed ? "#ef4444" : "rgba(255,255,255,0.4)"}
                strokeWidth={isRed ? "2" : "1"}
              />
              {i % 2 === 0 && (
                <text
                  x={50 + 26 * Math.cos(rad)}
                  y={50 + 26 * Math.sin(rad) + 2}
                  fontSize="7.5"
                  textAnchor="middle"
                  fill={isRed ? "#ff8888" : "rgba(255,255,255,0.45)"}
                  className="font-mono font-bold select-none"
                >
                  {i}
                </text>
              )}
            </g>
          );
        })}

        {/* Dynamic Center Needle Pivot */}
        <circle cx="50" cy="50" r="4.5" fill="#1e232d" stroke="#2ac1ff" strokeWidth="1.5" />

        {/* Needle hand with drop glow indicator */}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "50px 50px" }}>
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="16"
            stroke="#2ac1ff"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="drop-shadow-[0_0_4px_#2ac1ff]"
          />
          <polygon
            points="48.5,50 51.5,50 50,14"
            fill="#2ac1ff"
          />
        </g>
      </svg>
    </div>
  );
}

export default function App() {
  const [carProfile, setCarProfile] = useState<CarProfile | null>(null);
  const [vehicles, setVehicles] = useState<CarProfile[]>([]);
  const [vehiclesTasksMap, setVehiclesTasksMap] = useState<Record<string, MaintenanceTask[]>>({});
  const [vehiclesTrackingMap, setVehiclesTrackingMap] = useState<Record<string, TaskTracking[]>>({});
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [tracking, setTracking] = useState<TaskTracking[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  
  // Firebase authentication state
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Selected visual view screen (registrar, garaje or perfil)
  const [activeScreen, setActiveScreen] = useState<"garaje" | "mantenimientos" | "talleres" | "documentos" | "perfil">("garaje");
  const [selectedDetailVehicleId, setSelectedDetailVehicleId] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Embedded Settings Preferences (from deleted Ajustes screen)
  const [warnDistance, setWarnDistance] = useState<number>(() => {
    const saved = localStorage.getItem("simva_warn_distance");
    return saved ? Number(saved) : 1000;
  });
  const [dangerDistance, setDangerDistance] = useState<number>(() => {
    const saved = localStorage.getItem("simva_danger_distance");
    return saved ? Number(saved) : 500;
  });
  const [notiPush, setNotiPush] = useState<boolean>(() => {
    const saved = localStorage.getItem("simva_noti_push");
    return saved !== "false";
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem("simva_sound_enabled");
    return saved === "true";
  });

  const [fcmToken, setFcmToken] = useState<string | null>(() => {
    return localStorage.getItem("simva_fcm_token");
  });
  const [fcmSupport, setFcmSupport] = useState<boolean | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<CarProfile | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReauthError, setDeleteReauthError] = useState<string | null>(null);

  const requestPushPermissionAndRegister = async () => {
    if (!("Notification" in window)) {
      console.warn("Este navegador no soporta notificaciones de escritorio.");
      setFcmSupport(false);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("Permiso de notificación denegado por el usuario.");
        return;
      }

      // Dynamic import
      const { getMessagingInstance, getToken } = await import("./firebase");
      const messaging = await getMessagingInstance();
      if (messaging) {
        setFcmSupport(true);
        let reg;
        try {
          reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
          console.log("Service Worker de FCM registrado con éxito:", reg);
        } catch (swErr) {
          console.warn("Fallo al registrar Service Worker (usando fallback directo):", swErr);
        }

        const token = await getToken(messaging, {
          serviceWorkerRegistration: reg,
          vapidKey: "BFLd-i6Hk7yIn3gL3r7U_3fK87c3Hq99Z99W67n3qR7U_6a_b_c_d_e_f_g"
        }).catch(err => {
          console.warn("No se pudo obtener el token de FCM. Se usará el identificador local:", err);
          return null;
        });

        if (token) {
          setFcmToken(token);
          localStorage.setItem("simva_fcm_token", token);
          console.log("FCM Token registrado con éxito:", token);

          if (db && auth.currentUser) {
            await setDoc(doc(db, "users", auth.currentUser.uid, "settings", "notifications"), {
              fcmToken: token,
              notiPush: true,
              updatedAt: new Date().toISOString()
            }, { merge: true }).catch(err => {
              console.warn("Error al guardar token en Firestore:", err);
            });
          }
        } else {
          let localSubId = localStorage.getItem("simva_local_sub_id");
          if (!localSubId) {
            localSubId = "local-sub-" + Math.random().toString(36).substring(2, 11);
            localStorage.setItem("simva_local_sub_id", localSubId);
          }
          setFcmToken(localSubId);
        }
      } else {
        setFcmSupport(false);
        let localSubId = localStorage.getItem("simva_local_sub_id");
        if (!localSubId) {
          localSubId = "local-sub-" + Math.random().toString(36).substring(2, 11);
          localStorage.setItem("simva_local_sub_id", localSubId);
        }
        setFcmToken(localSubId);
      }

      // Show welcome notification immediately
      new Notification("SIMVA - Notificaciones Activas", {
        body: "¡Habilitado! Mantenimientos y alertas preventivas/críticas en tiempo real.",
        icon: "/icon_simva_logo.png"
      });

    } catch (err) {
      console.error("Error al habilitar notificaciones push:", err);
    }
  };

  useEffect(() => {
    if (notiPush && currentUser) {
      requestPushPermissionAndRegister();
    }
  }, [notiPush, currentUser?.uid]);

  // Helper function to sync Tasks to Cloud
  const saveTasksToFirestore = async (uid: string, vehicleId: string, tasksList: MaintenanceTask[]) => {
    const pathForWrite = `users/${uid}/vehicles/${vehicleId}/tasks`;
    try {
      const batch = writeBatch(db);
      const tasksSnap = await getDocs(collection(db, "users", uid, "vehicles", vehicleId, "tasks"));
      tasksSnap.forEach((d) => {
        batch.delete(d.ref);
      });
      tasksList.forEach((t) => {
        batch.set(doc(db, "users", uid, "vehicles", vehicleId, "tasks", t.id), t);
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathForWrite);
    }
  };

  // Helper function to sync Tracking to Cloud
  const saveTrackingToFirestore = async (uid: string, vehicleId: string, trackingList: TaskTracking[]) => {
    const pathForWrite = `users/${uid}/vehicles/${vehicleId}/tracking`;
    try {
      const batch = writeBatch(db);
      const trackingSnap = await getDocs(collection(db, "users", uid, "vehicles", vehicleId, "tracking"));
      trackingSnap.forEach((d) => {
        batch.delete(d.ref);
      });
      trackingList.forEach((tr) => {
        batch.set(doc(db, "users", uid, "vehicles", vehicleId, "tracking", tr.id), tr);
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, pathForWrite);
    }
  };

  const selectVehicle = (veh: CarProfile) => {
    setCarProfile(veh);
    if (veh.id) {
      localStorage.setItem("simva_selected_vehicle_id", veh.id);
      setTasks(vehiclesTasksMap[veh.id] || []);
      setTracking(vehiclesTrackingMap[veh.id] || []);
    }
  };

  const deleteVehicle = async (vehicleId: string) => {
    setIsLoading(true);
    try {
      const updatedList = vehicles.filter(v => v.id !== vehicleId);
      setVehicles(updatedList);
      localStorage.setItem("simva_vehicles", JSON.stringify(updatedList));

      if (currentUser) {
        // Remove from firestore
        const batch = writeBatch(db);
        batch.delete(doc(db, "users", currentUser.uid, "vehicles", vehicleId));
        
        // delete tasks and tracking inside subcollection
        const tasksSnap = await getDocs(collection(db, "users", currentUser.uid, "vehicles", vehicleId, "tasks"));
        tasksSnap.forEach(d => batch.delete(d.ref));
        
        const trackingSnap = await getDocs(collection(db, "users", currentUser.uid, "vehicles", vehicleId, "tracking"));
        trackingSnap.forEach(d => batch.delete(d.ref));
        
        await batch.commit();
      }

      // If deleted vehicle was the active one, clear context or switch to another
      if (carProfile?.id === vehicleId) {
        const remaining = updatedList[0] || null;
        setCarProfile(remaining);
        if (remaining && remaining.id) {
          localStorage.setItem("simva_selected_vehicle_id", remaining.id);
          setTasks(vehiclesTasksMap[remaining.id] || []);
          setTracking(vehiclesTrackingMap[remaining.id] || []);
        } else {
          localStorage.removeItem("simva_selected_vehicle_id");
          setTasks([]);
          setTracking([]);
        }
      }

      // Remove from lists maps
      const copyTasksMap = { ...vehiclesTasksMap };
      delete copyTasksMap[vehicleId];
      setVehiclesTasksMap(copyTasksMap);

      const copyTrackMap = { ...vehiclesTrackingMap };
      delete copyTrackMap[vehicleId];
      setVehiclesTrackingMap(copyTrackMap);

      setInfoMessage("Vehículo eliminado correctamente.");
      setTimeout(() => setInfoMessage(null), 3000);
    } catch (err: any) {
      console.error("Error deleting vehicle:", err);
      setError("Error al eliminar el vehículo.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setIsLoading(true);
        setError(null);
        try {
          // Initialize/Ensure User Profile document
          await setDoc(
            doc(db, "users", user.uid),
            { userId: user.uid, email: user.email || "" },
            { merge: true }
          );

          // Get all vehicles directly from subcollection using getDocs
          const vehiclesSnap = await getDocs(collection(db, "users", user.uid, "vehicles"));
          const fetchedVehicles: CarProfile[] = [];
          
          vehiclesSnap.forEach((d) => {
            const data = d.data();
            fetchedVehicles.push({
              id: d.id,
              makeModel: String(data.makeModel || ""),
              fuelType: data.fuelType as any,
              currentKm: Number(data.currentKm) || 0,
              monthlyKm: Number(data.monthlyKm) || 0,
              year: Number(data.year) || 0,
              vehicleType: (data.vehicleType as any) || "Coche"
            });
          });

          setVehicles(fetchedVehicles);
          localStorage.setItem("simva_vehicles", JSON.stringify(fetchedVehicles));

          // Load tasks and tracking for all fetched vehicles in parallel
          const newTasksMap: Record<string, MaintenanceTask[]> = {};
          const newTrackingMap: Record<string, TaskTracking[]> = {};

          await Promise.all(fetchedVehicles.map(async (v) => {
            if (!v.id) return;
            const tSnap = await getDocs(collection(db, "users", user.uid, "vehicles", v.id, "tasks"));
            const tList: MaintenanceTask[] = [];
            tSnap.forEach((d) => tList.push(d.data() as MaintenanceTask));
            newTasksMap[v.id] = tList;

            const trSnap = await getDocs(collection(db, "users", user.uid, "vehicles", v.id, "tracking"));
            const trList: TaskTracking[] = [];
            trSnap.forEach((d) => trList.push(d.data() as TaskTracking));
            newTrackingMap[v.id] = trList;
          }));

          setVehiclesTasksMap(newTasksMap);
          setVehiclesTrackingMap(newTrackingMap);

          // Select first vehicle as current profile by default if none selected
          const storedSelectedId = localStorage.getItem("simva_selected_vehicle_id");
          const selectedVeh = fetchedVehicles.find(v => v.id === storedSelectedId) || fetchedVehicles[0] || null;
          setCarProfile(selectedVeh);
          if (selectedVeh && selectedVeh.id) {
            setTasks(newTasksMap[selectedVeh.id] || []);
            setTracking(newTrackingMap[selectedVeh.id] || []);
            localStorage.setItem("simva_selected_vehicle_id", selectedVeh.id);
          } else {
            setTasks([]);
            setTracking([]);
          }

          if (fetchedVehicles.length > 0) {
            setActiveScreen("garaje");
            setIsRegistering(false);
          } else {
            setActiveScreen("garaje");
            setIsRegistering(true);
          }
        } catch (err: any) {
          console.error("Error loading profile from Firestore:", err);
          setError("Incompatibilidad al leer datos sincronizados. Operando en modo local.");

          // Local storage recovery backup
          const storedCars = localStorage.getItem("simva_vehicles");
          if (storedCars) {
            const list: CarProfile[] = JSON.parse(storedCars);
            setVehicles(list);
            const legacySelected = list[0] || null;
            setCarProfile(legacySelected);
            if (legacySelected && legacySelected.id) {
              const cachedTasks = localStorage.getItem(`veh_tasks_${legacySelected.id}`);
              const cachedTracking = localStorage.getItem(`veh_tracking_${legacySelected.id}`);
              if (cachedTasks) setTasks(JSON.parse(cachedTasks));
              if (cachedTracking) setTracking(JSON.parse(cachedTracking));
            }
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        // Logged out safely
        setCarProfile(null);
        setVehicles([]);
        setVehiclesTasksMap({});
        setVehiclesTrackingMap({});
        setTasks([]);
        setTracking([]);
      }
      setAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const checkAndSendEmailAlerts = async (
    veh: CarProfile, 
    tasksList: MaintenanceTask[], 
    trackingList: TaskTracking[]
  ) => {
    if (!currentUser || !currentUser.email) return;

    const localKey = "simva_sent_alerts";
    const sentAlertsRaw = localStorage.getItem(localKey);
    const sentAlerts: Record<string, string> = sentAlertsRaw ? JSON.parse(sentAlertsRaw) : {};

    let updatedMap = { ...sentAlerts };
    let hasUpdatedAny = false;

    for (const t of tasksList) {
      if (t.cada_km <= 0) continue;

      const track = trackingList.find((tr) => tr.id === t.id);
      const lastDoneKm = track?.lastCompletedKm !== undefined ? track.lastCompletedKm : 0;
      const kmRemaining = (lastDoneKm + t.cada_km) - veh.currentKm;

      // Match the exact thresholds
      let currentStatus: "ok" | "warning" | "danger" = "ok";
      if (kmRemaining < dangerDistance) {
        currentStatus = "danger";
      } else if (kmRemaining <= warnDistance) {
        currentStatus = "warning";
      }

      const alertKey = `${veh.id}_${t.id}`;
      const lastSentStatus = sentAlerts[alertKey] || "ok";

      // Trigger transition if it worsened
      const didWorsen = 
        (lastSentStatus === "ok" && (currentStatus === "warning" || currentStatus === "danger")) ||
        (lastSentStatus === "warning" && currentStatus === "danger");

      if (didWorsen && currentStatus !== "ok") {
        updatedMap[alertKey] = currentStatus;
        hasUpdatedAny = true;

        // Real-time Push Notification trigger
        if (notiPush && fcmToken) {
          try {
            const vehTypeLabel = (veh.vehicleType || "vehículo").toLowerCase();
            const pushTitle = `⚠️ Alerta SIMVA: ${vehTypeLabel === "coche" ? "🚗 Coche" : vehTypeLabel === "moto" ? "🏍️ Moto" : "Vehículo"} ${veh.makeModel}`;
            const label = currentStatus === "danger" ? "VENCIDO/CRÍTICO" : "PRÓXIMO RECAMBIO";
            const pushBody = `¡Atención! En tu ${vehTypeLabel} ${veh.makeModel}, está fallando o requiere atención: "${t.tarea}". Quedan ${kmRemaining <= 0 ? "0 km" : `${kmRemaining.toLocaleString("es-ES")} km`}.`;

            console.log("Triggering real-time push notification request...");
            await fetch("/api/send-push-notification", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                fcmToken,
                title: pushTitle,
                body: pushBody,
              }),
            });

            // If the browser window is open and user granted permission, show an active visual alert banner
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(pushTitle, {
                body: pushBody,
                icon: "/icon_simva_logo.png",
              });
            }
          } catch (pushErr) {
            console.error("Failed to send push notification:", pushErr);
          }
        }
      } else if (currentStatus === "ok" && lastSentStatus !== "ok") {
        // If the task status returns to OK (resolved), remove the sentinel so it can alert again on next cycle
        delete updatedMap[alertKey];
        hasUpdatedAny = true;
      }
    }

    if (hasUpdatedAny) {
      localStorage.setItem(localKey, JSON.stringify(updatedMap));
    }
  };

  useEffect(() => {
    if (carProfile && tasks.length > 0 && currentUser) {
      checkAndSendEmailAlerts(carProfile, tasks, tracking);
    }
  }, [carProfile?.currentKm, tasks, tracking, currentUser]);

  // Save profile & fetch Maintenance plan and initialize the wear levels
  const handleSaveProfile = async (
    profile: CarProfile, 
    shouldFetch: boolean,
    lastMaintMonths?: number,
    lastMaintKm?: number
  ) => {
    let vehicleId = profile.id;
    if (!vehicleId) {
      if (currentUser) {
        const autoRef = doc(collection(db, "users", currentUser.uid, "vehicles"));
        vehicleId = autoRef.id;
      } else {
        vehicleId = `veh-${Date.now()}`;
      }
    }

    const cleanProfile: CarProfile = {
      id: vehicleId,
      vehicleType: profile.vehicleType || "Coche",
      makeModel: String(profile.makeModel || ""),
      fuelType: profile.fuelType || "Gasolina",
      currentKm: Number(profile.currentKm) || 0,
      monthlyKm: Number(profile.monthlyKm) || 0,
      year: Number(profile.year) || 0,
      vin: profile.vin ? String(profile.vin) : undefined,
    };

    setCarProfile(cleanProfile);
    localStorage.setItem("simva_selected_vehicle_id", vehicleId);

    // Add/Update to vehicles list
    const updatedVehicles = vehicles.some(v => v.id === vehicleId)
      ? vehicles.map(v => v.id === vehicleId ? cleanProfile : v)
      : [...vehicles, cleanProfile];

    setVehicles(updatedVehicles);
    localStorage.setItem("simva_vehicles", JSON.stringify(updatedVehicles));

    // Save profile to Firestore
    if (currentUser) {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "vehicles", vehicleId), cleanProfile);
      } catch (err) {
        console.error("Error saving profile to Firestore:", err);
        handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}/vehicles/${vehicleId}`);
      }
    }

    setInfoMessage(null);
    setError(null);

    const existingVeh = vehicles.find(v => v.id === vehicleId);
    const didDetailsChange = !existingVeh || (
      existingVeh.makeModel !== cleanProfile.makeModel ||
      existingVeh.fuelType !== cleanProfile.fuelType ||
      existingVeh.vehicleType !== cleanProfile.vehicleType
    );

    let actualFetch = shouldFetch;
    if (existingVeh && !didDetailsChange) {
      actualFetch = false;
    }

    // If fetched, load recommended tasks
    if (actualFetch) {
      setIsLoading(true);
      try {
        const response = await fetch("/api/maintenance-plan", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            makeModel: profile.makeModel,
            fuelType: profile.fuelType,
            year: profile.year,
            vehicleType: profile.vehicleType,
          }),
        });

        if (!response.ok) {
          throw new Error("Respuesta de red errónea al consultar con el servidor backend.");
        }

        const data = await response.json();

        // Incorporate unique client ids for safe key mapping
        const processedTasks = (data.plan || []).map((t: any, idx: number) => ({
          id: `task-${idx}-${Date.now()}`,
          tarea: t.tarea,
          cada_km: Number(t.cada_km) || 0,
          cada_meses: Number(t.cada_meses) || 0,
        }));

        setTasks(processedTasks);
        localStorage.setItem(`veh_tasks_${vehicleId}`, JSON.stringify(processedTasks));
        setVehiclesTasksMap(prev => ({ ...prev, [vehicleId]: processedTasks }));

        // Compute pre-loaded history completes instantly so user gets realistic wear!
        let initialTracking: TaskTracking[] = [];
        if (lastMaintKm !== undefined && lastMaintKm > 0) {
          const maintDate = new Date();
          maintDate.setMonth(maintDate.getMonth() - (lastMaintMonths || 6));
          const lastCompletedDate = maintDate.toISOString().split("T")[0];

          initialTracking = processedTasks.map((t: any) => {
            // Apply last intervention to all basic tasks under 60k km
            if (t.cada_km && t.cada_km <= 60000 && lastMaintKm <= profile.currentKm) {
              return {
                id: t.id,
                lastCompletedKm: lastMaintKm,
                lastCompletedDate: lastCompletedDate
              };
            }
            return null;
          }).filter(Boolean) as TaskTracking[];
        }

        setTracking(initialTracking);
        localStorage.setItem(`veh_tracking_${vehicleId}`, JSON.stringify(initialTracking));
        setVehiclesTrackingMap(prev => ({ ...prev, [vehicleId]: initialTracking }));

        // Store configuration and plan on Firestore Cloud
        if (currentUser) {
          await saveTasksToFirestore(currentUser.uid, vehicleId, processedTasks);
          await saveTrackingToFirestore(currentUser.uid, vehicleId, initialTracking);
        }

        if (data.isFallback || data.message) {
          setInfoMessage(data.message || "Se han aplicado los estándares de la industria recomendados.");
        } else {
          setInfoMessage("¡Felicidades! Plan de mantenimiento oficial obtenido con éxito mediante Gemini IA.");
        }

        // Navigate automatically to Pantalla B: Garaje / Estado
        setActiveScreen("garaje");
        setIsRegistering(false);
      } catch (err: any) {
        console.error("Error fetching recommended maintenance schedule:", err);
        setError("Fallo de red al consultar con el servidor. Se emplearán datos recomendados estándar.");
        
        // Load some local industry defaults immediately so the screen is never empty
        const defaultTasks = getIndustryFallbackPlan(profile.fuelType, profile.vehicleType).map((t: any, idx: number) => ({
          id: `task-fallback-${idx}-${Date.now()}`,
          tarea: t.tarea,
          cada_km: t.cada_km,
          cada_meses: t.cada_meses,
        }));
        setTasks(defaultTasks);
        localStorage.setItem(`veh_tasks_${vehicleId}`, JSON.stringify(defaultTasks));
        setVehiclesTasksMap(prev => ({ ...prev, [vehicleId]: defaultTasks }));

        // Setup custom completion logs for fallback default plan too
        let initialTracking: TaskTracking[] = [];
        if (lastMaintKm !== undefined && lastMaintKm > 0) {
          const maintDate = new Date();
          maintDate.setMonth(maintDate.getMonth() - (lastMaintMonths || 6));
          const lastCompletedDate = maintDate.toISOString().split("T")[0];

          initialTracking = defaultTasks.map((t: any) => {
            if (t.cada_km && t.cada_km <= 60000 && lastMaintKm <= profile.currentKm) {
              return {
                id: t.id,
                lastCompletedKm: lastMaintKm,
                lastCompletedDate: lastCompletedDate
              };
            }
            return null;
          }).filter(Boolean) as TaskTracking[];
        }
        setTracking(initialTracking);
        localStorage.setItem(`veh_tracking_${vehicleId}`, JSON.stringify(initialTracking));
        setVehiclesTrackingMap(prev => ({ ...prev, [vehicleId]: initialTracking }));

        if (currentUser) {
          await saveTasksToFirestore(currentUser.uid, vehicleId, defaultTasks);
          await saveTrackingToFirestore(currentUser.uid, vehicleId, initialTracking);
        }

        setActiveScreen("garaje");
        setIsRegistering(false);
      } finally {
        setIsLoading(false);
      }
    } else {
      const existingTasks = vehiclesTasksMap[vehicleId] || [];
      const existingTracking = vehiclesTrackingMap[vehicleId] || [];

      setTasks(existingTasks);
      setTracking(existingTracking);

      setInfoMessage("¡Vehículo guardado y plan de mantenimiento recalculado con éxito!");
      
      let initialTracking: TaskTracking[] = existingTracking;
      // Auto-reinitialize logs if they edited the vehicle settings manually
      if (lastMaintKm !== undefined && lastMaintKm > 0 && existingTasks.length > 0) {
        const maintDate = new Date();
        maintDate.setMonth(maintDate.getMonth() - (lastMaintMonths || 6));
        const lastCompletedDate = maintDate.toISOString().split("T")[0];

        initialTracking = existingTasks.map((t: any) => {
          if (t.cada_km && t.cada_km <= 60000 && lastMaintKm <= profile.currentKm) {
            return {
              id: t.id,
              lastCompletedKm: lastMaintKm,
              lastCompletedDate: lastCompletedDate
            };
          }
          return null;
        }).filter(Boolean) as TaskTracking[];
        setTracking(initialTracking);
        localStorage.setItem(`veh_tracking_${vehicleId}`, JSON.stringify(initialTracking));
        setVehiclesTrackingMap(prev => ({ ...prev, [vehicleId]: initialTracking }));
      }

      if (currentUser) {
        if (lastMaintKm !== undefined && lastMaintKm > 0 && existingTasks.length > 0) {
          await saveTrackingToFirestore(currentUser.uid, vehicleId, initialTracking);
        }
      }

      // Explicitly recalculate and trigger alerts transition immediately for updated odometer
      await checkAndSendEmailAlerts(cleanProfile, existingTasks, initialTracking);

      // Navigate to Garaje tab
      setActiveScreen("garaje");
      setTimeout(() => setInfoMessage(null), 3500);
    }
  };

  // Safe standard fallback in client-side as well in case of network failures
  function getIndustryFallbackPlan(fuelType: string, vehicleType?: string) {
    const isMoto = (vehicleType || "").toLowerCase() === "moto";
    
    if (isMoto) {
      if ((fuelType || "").toLowerCase().includes("eléctric")) {
        return [
          { tarea: "Revisión de motor eléctrico y batería", cada_km: 15000, cada_meses: 12 },
          { tarea: "Inspección de tensión y engrase de cadena", cada_km: 1000, cada_meses: 3 },
          { tarea: "Revisión de líquido y pastillas de freno", cada_km: 10000, cada_meses: 12 },
          { tarea: "Revisión de neumáticos y presión", cada_km: 3000, cada_meses: 3 }
        ];
      } else {
        return [
          { tarea: "Cambio de aceite de motor y filtro", cada_km: 5000, cada_meses: 12 },
          { tarea: "Limpieza y engrase de cadena de transmisión", cada_km: 1000, cada_meses: 3 },
          { tarea: "Reemplazo de bujía de encendido", cada_km: 12000, cada_meses: 24 },
          { tarea: "Limpieza o cambio de filtro de aire de motor", cada_km: 10000, cada_meses: 12 },
          { tarea: "Inspección de pastillas de freno y neumáticos", cada_km: 5000, cada_meses: 6 },
          { tarea: "Cambio de líquido de frenos", cada_km: 20000, cada_meses: 24 }
        ];
      }
    }

    const common = [
      { tarea: "Cambio de líquido de frenos", cada_km: 60000, cada_meses: 24 },
      { tarea: "Revisión de pastillas y discos de freno", cada_km: 30000, cada_meses: 12 },
      { tarea: "Cambio de filtro del habitáculo (antipolen)", cada_km: 15000, cada_meses: 12 },
      { tarea: "Revisión de nivel de anticongelante", cada_km: 20000, cada_meses: 12 }
    ];
    const typeLower = (fuelType || "Gasolina").toLowerCase();
    if (typeLower.includes("electric") || typeLower.includes("eléctric")) {
      return [
        { tarea: "Rotación y calibración de neumáticos", cada_km: 10000, cada_meses: 12 },
        { tarea: "Cambio de filtro de aire del habitáculo", cada_km: 20000, cada_meses: 12 },
        ...common.slice(0, 2),
        { tarea: "Inspección de batería de alta tensión", cada_km: 30000, cada_meses: 24 }
      ];
    } else if (typeLower.includes("diesel") || typeLower.includes("diésel")) {
      return [
        { tarea: "Cambio de aceite de motor y filtro", cada_km: 15000, cada_meses: 12 },
        { tarea: "Reemplazo de filtro de combustible (diésel)", cada_km: 30000, cada_meses: 24 },
        { tarea: "Cambio de filtro de aire", cada_km: 30000, cada_meses: 24 },
        ...common
      ];
    } else {
      return [
        { tarea: "Cambio de aceite de motor y filtro", cada_km: 15000, cada_meses: 12 },
        { tarea: "Reemplazo de filtro de aire de motor", cada_km: 30000, cada_meses: 24 },
        ...common,
        { tarea: "Cambio de bujías de encendido", cada_km: 60000, cada_meses: 48 }
      ];
    }
  }

  // Update completions log
  const handleUpdateTracking = async (newTrack: TaskTracking[]) => {
    setTracking(newTrack);
    if (carProfile?.id) {
      localStorage.setItem(`veh_tracking_${carProfile.id}`, JSON.stringify(newTrack));
      setVehiclesTrackingMap(prev => ({ ...prev, [carProfile.id!]: newTrack }));
      if (currentUser) {
        await saveTrackingToFirestore(currentUser.uid, carProfile.id, newTrack);
      }
    }
  };

  // Update tasks locally (add custom/delete)
  const handleUpdateTasks = async (newTasks: MaintenanceTask[]) => {
    setTasks(newTasks);
    if (carProfile?.id) {
      localStorage.setItem(`veh_tasks_${carProfile.id}`, JSON.stringify(newTasks));
      setVehiclesTasksMap(prev => ({ ...prev, [carProfile.id!]: newTasks }));
      if (currentUser) {
        await saveTasksToFirestore(currentUser.uid, carProfile.id, newTasks);
      }
    }
  };

  // Complete reset to generic/empty state
  const handleResetAll = async () => {
    if (window.confirm("¿Estás seguro de que deseas limpiar la información actual de tu coche y empezar de nuevo?")) {
      setCarProfile(null);
      setTasks([]);
      setTracking([]);
      setError(null);
      setInfoMessage(null);
      setActiveScreen("garaje");
      setIsRegistering(true);
      
      localStorage.removeItem("automoto_profile");
      localStorage.removeItem("automoto_tasks");
      localStorage.removeItem("automoto_tracking");

      if (currentUser) {
        setIsLoading(true);
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, "users", currentUser.uid, "car", "profile"));
          
          const tasksSnap = await getDocs(collection(db, "users", currentUser.uid, "tasks"));
          tasksSnap.forEach((d) => batch.delete(d.ref));

          const trackingSnap = await getDocs(collection(db, "users", currentUser.uid, "tracking"));
          trackingSnap.forEach((d) => batch.delete(d.ref));

          await batch.commit();
          setInfoMessage("¡Métricas SIMVA restablecidas con éxito!");
          setTimeout(() => setInfoMessage(null), 3000);
        } catch (err) {
          console.error("Error clearing Firebase collections on reset:", err);
          setError("Error al restablecer los datos.");
        } finally {
          setIsLoading(false);
        }
      }
    }
  };

  // GDPR-compliant account deletion
  const handleDeleteAccount = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    setDeleteReauthError(null);
    setError(null);
    setInfoMessage(null);

    const providerId = currentUser.providerData[0]?.providerId || "";
    const isGoogle = providerId === "google.com";

    // 1. Proactive re-authentication based on login provider (prevents auth/requires-recent-login errors)
    if (isGoogle) {
      try {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(currentUser, provider);
      } catch (reauthErr: any) {
        console.error("Reauthentication with Google failed:", reauthErr);
        if (reauthErr.code === "auth/popup-closed-by-user") {
          setDeleteReauthError("La ventana de autenticación con Google fue cerrada antes de completarse.");
        } else {
          setDeleteReauthError("Error de re-autenticación: Por favor, inténtalo de nuevo para confirmar la baja.");
        }
        setIsLoading(false);
        return;
      }
    } else {
      if (!deletePassword) {
        setDeleteReauthError("Introduce tu contraseña de acceso para autorizar la eliminación permanente de tu cuenta.");
        setIsLoading(false);
        return;
      }
      try {
        const credential = EmailAuthProvider.credential(currentUser.email!, deletePassword);
        await reauthenticateWithCredential(currentUser, credential);
      } catch (reauthErr: any) {
        console.error("Reauthentication with email/password failed:", reauthErr);
        if (reauthErr.code === "auth/wrong-password" || reauthErr.code === "auth/invalid-credential") {
          setDeleteReauthError("La contraseña introducida es incorrecta. Por favor, verifícala.");
        } else {
          setDeleteReauthError("Error al verificar credenciales: " + (reauthErr.message || reauthErr));
        }
        setIsLoading(false);
        return;
      }
    }

    try {
      const batch = writeBatch(db);

      // 1. Delete documents list
      batch.delete(doc(db, "users", currentUser.uid, "documents", "list"));

      // 2. Delete settings
      batch.delete(doc(db, "users", currentUser.uid, "settings", "notifications"));

      // 3. Delete car profile
      batch.delete(doc(db, "users", currentUser.uid, "car", "profile"));

      // 4. Delete legacy root tasks & tracking subcollections
      const legacyTasksSnap = await getDocs(collection(db, "users", currentUser.uid, "tasks"));
      legacyTasksSnap.forEach((d) => batch.delete(d.ref));

      const legacyTrackingSnap = await getDocs(collection(db, "users", currentUser.uid, "tracking"));
      legacyTrackingSnap.forEach((d) => batch.delete(d.ref));

      // 5. Delete modern vehicles and their nested tasks & tracking subcollections
      const vehiclesSnap = await getDocs(collection(db, "users", currentUser.uid, "vehicles"));
      for (const vehicleDoc of vehiclesSnap.docs) {
        const vehicleId = vehicleDoc.id;
        
        const nestedTasksSnap = await getDocs(collection(db, "users", currentUser.uid, "vehicles", vehicleId, "tasks"));
        nestedTasksSnap.forEach((d) => batch.delete(d.ref));

        const nestedTrackingSnap = await getDocs(collection(db, "users", currentUser.uid, "vehicles", vehicleId, "tracking"));
        nestedTrackingSnap.forEach((d) => batch.delete(d.ref));

        batch.delete(vehicleDoc.ref);
      }

      await batch.commit();

      // Clear local cache
      localStorage.removeItem("automoto_profile");
      localStorage.removeItem("automoto_tasks");
      localStorage.removeItem("automoto_tracking");
      localStorage.removeItem("simva_documents");
      localStorage.removeItem("simva_fcm_token");

      setCarProfile(null);
      setVehicles([]);
      setTasks([]);
      setTracking([]);
      
      // Clear local confirm and reauthentication state
      setShowDeleteConfirm(false);
      setDeletePassword("");
      setDeleteReauthError(null);

      // 6. Delete the user authentication record in Firebase Auth
      await currentUser.delete();

      setInfoMessage("Tu cuenta y todos tus datos han sido eliminados de forma permanente de los servidores de SIMVA.");
      setTimeout(() => {
        setInfoMessage(null);
        setActiveScreen("garaje");
        setIsRegistering(true);
      }, 3500);

    } catch (err: any) {
      console.error("Error deleting database or authentication records:", err);
      setError("Error crítico durante el borrado de la cuenta. Por favor, ponte en contacto con asistencia.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper inside render for Quick Odometer calibration
  const [newOdo, setNewOdo] = useState("");
  useEffect(() => {
    if (carProfile) {
      setNewOdo(carProfile.currentKm.toString());
    }
  }, [carProfile]);

  const handleUpdateOdometerVal = async (val: number, vehicle: CarProfile) => {
    if (isNaN(val) || val < 0) {
      setError("Por favor, introduce un kilometraje válido superior a 0.");
      return;
    }
    const updated = {
      ...vehicle,
      currentKm: val
    };
    setCarProfile(updated);
    
    // Update in vehicles list
    const updatedVehicles = vehicles.map(v => v.id === vehicle.id ? updated : v);
    setVehicles(updatedVehicles);
    localStorage.setItem("simva_vehicles", JSON.stringify(updatedVehicles));
    if (vehicle.id) {
      localStorage.setItem("simva_selected_vehicle_id", vehicle.id);
    }

    const vehTasks = vehiclesTasksMap[vehicle.id!] || [];
    const vehTracking = vehiclesTrackingMap[vehicle.id!] || [];

    // Ensure state displays recalculated values instantly
    setTasks(vehTasks);
    setTracking(vehTracking);

    setInfoMessage("¡Odómetro calibrado y mantenimiento recalculado con éxito!");
    
    if (currentUser && vehicle.id) {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "vehicles", vehicle.id), updated);
      } catch (err) {
        console.error("Error updating odometer in DB:", err);
      }
    }

    // Explicitly recalculate and trigger alert transition check immediately
    await checkAndSendEmailAlerts(updated, vehTasks, vehTracking);
    
    setTimeout(() => setInfoMessage(null), 3500);
  };

  const handleUpdateOdometer = async (e: FormEvent) => {
    e.preventDefault();
    if (!carProfile) return;
    await handleUpdateOdometerVal(Number(newOdo), carProfile);
  };

  const getNotifications = (): any[] => {
    if (!notiPush) return [];
    const list: any[] = [];
    vehicles.forEach((veh) => {
      // Find tasks list for this vehicle
      const vehTasks = vehiclesTasksMap[veh.id!] || getIndustryFallbackPlan(veh.fuelType, veh.vehicleType) || [];
      const vehTracking = vehiclesTrackingMap[veh.id!] || [];
      
      vehTasks.forEach((task) => {
        const track = vehTracking.find((tr) => tr.id === task.id);
        const odometro = veh.currentKm;
        const lastDoneKm = track?.lastCompletedKm !== undefined ? track.lastCompletedKm : 0;
        
        // Solve for remaining parameters
        let kmRemaining = Infinity;
        if (task.cada_km > 0) {
          const baseKm = (track && track.lastCompletedKm !== undefined) ? track.lastCompletedKm : 0;
          const nextDueKm = baseKm + task.cada_km;
          kmRemaining = nextDueKm - odometro;
        }

        let monthsRemaining = Infinity;
        if (task.cada_meses > 0) {
          if (track && track.lastCompletedDate) {
            const lastDate = new Date(track.lastCompletedDate);
            const today = new Date();
            const diffYears = today.getFullYear() - lastDate.getFullYear();
            const diffMonths = today.getMonth() - lastDate.getMonth();
            const elapsedMonths = diffYears * 12 + diffMonths;
            monthsRemaining = Math.max(0, task.cada_meses - elapsedMonths);
          } else {
            if (kmRemaining !== Infinity) {
              const monthlyUsage = veh.monthlyKm > 0 ? veh.monthlyKm : 1000;
              monthsRemaining = kmRemaining / monthlyUsage;
            } else {
              monthsRemaining = task.cada_meses;
            }
          }
        }
        const roundedMonthsRemaining = Math.max(0, Math.round(monthsRemaining));

        let statusColor: "danger" | "warning" | "ok" = "ok";
        if (task.cada_km > 0) {
          if (kmRemaining < dangerDistance) {
            statusColor = "danger";
          } else if (kmRemaining <= warnDistance) {
            statusColor = "warning";
          }
        } else {
          if (roundedMonthsRemaining <= 1) {
            statusColor = "danger";
          } else if (roundedMonthsRemaining <= 2) {
            statusColor = "warning";
          }
        }

        const typeLabel = veh.vehicleType?.toLowerCase() === "moto" ? "moto" : "coche";
        if (statusColor === "danger") {
          list.push({
            id: `${veh.id}-${task.id}-danger`,
            type: "danger",
            message: `⚠️ Aviso de SIMVA: Tu ${typeLabel} (${veh.makeModel}) requiere revisar urgentemente: ${task.tarea.toLowerCase()} cuanto antes.`,
            vehicleName: veh.makeModel,
            taskName: task.tarea,
            timestampText: "Hace 2 días" // 1 vez cada 3 días
          });
        } else if (statusColor === "warning") {
          list.push({
            id: `${veh.id}-${task.id}-warning`,
            type: "warning",
            message: `SIMVA detectó una alerta leve: revisa ${task.tarea.toLowerCase()} en tu ${typeLabel} (${veh.makeModel}) antes de emprender un viaje largo.`,
            vehicleName: veh.makeModel,
            taskName: task.tarea,
            timestampText: "Hace 6 días" // 1 vez cada semana
          });
        }
      });
    });
    return list;
  };

  if (authChecking) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-white p-6">
        <SimvaLogo className="h-12 w-12 mb-4 animate-bounce shrink-0 drop-shadow-[0_0_15px_rgba(42,193,255,0.4)]" />
        <h2 className="font-sans text-lg font-black tracking-widest uppercase text-white">SIMVA</h2>
        <div className="flex gap-1.5 items-center mt-2.5 font-mono text-[9px] uppercase text-primary-fixed-dim/70 tracking-widest select-none">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-fixed-dim animate-ping" />
          <span>INICIALIZANDO TELEMETRÍA CENTRAL...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background font-sans antialiased text-white pt-20 pb-16 md:pt-24 md:pb-8">
      {/* Premium Dashboard Header */}
      <Header hasCar={!!carProfile} carName={carProfile?.makeModel} notifications={getNotifications()} onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />

      {/* Confirmation Modal Container for Vehicle Deletion */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-sm w-full p-6 rounded-2xl border border-red-500/30 bg-[#151a22] shadow-[0_0_30px_rgba(239,68,68,0.2)] text-left space-y-4">
            <div className="flex items-center gap-3 border-b border-white/5 pb-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 animate-pulse" />
              <h3 className="font-sans font-black text-sm text-red-400 uppercase tracking-tight">¿Eliminar vehículo?</h3>
            </div>
            
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Vehículo seleccionado:</p>
              <p className="text-xs text-white font-extrabold uppercase font-sans tracking-tight bg-white/5 px-3 py-2 rounded-xl border border-white/5">
                {vehicleToDelete.makeModel}
              </p>
            </div>

            <p className="text-[11px] text-on-surface-variant font-medium leading-relaxed">
              Esta acción es permanente e irreversible. Se eliminará el vehículo de tu garaje electrónico junto con todo su plan de mantenimiento, registro de tareas completadas e historial de alertas. No podrás recuperar estos datos.
            </p>

            <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-[10px] font-semibold text-red-300 leading-normal">
              ¿Estás seguro de que deseas proceder con el borrado definitivo?
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setVehicleToDelete(null)}
                className="py-2 px-3.5 bg-white/5 hover:bg-white/10 text-white hover:text-white border border-white/10 hover:border-white/20 text-xs font-mono font-bold rounded-xl transition-all cursor-pointer uppercase tracking-wider"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (vehicleToDelete.id) {
                    const id = vehicleToDelete.id;
                    setVehicleToDelete(null); // Close modal first
                    await deleteVehicle(id);
                    if (selectedDetailVehicleId === id) {
                      setSelectedDetailVehicleId(null);
                    }
                  }
                }}
                className="py-2 px-3.5 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold text-xs font-mono rounded-xl transition-all cursor-pointer uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.25)]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal Container for Account Deletion */}
      {showDeleteConfirm && (() => {
        const providerId = currentUser?.providerData[0]?.providerId || "";
        const isGoogle = providerId === "google.com";

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-red-500/30 bg-[#151a22] shadow-[0_0_30px_rgba(239,68,68,0.2)] text-left space-y-4">
              <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                <AlertTriangle className="h-6 w-6 text-red-500 shrink-0 animate-pulse" />
                <h3 className="font-sans font-black text-base text-red-400 uppercase tracking-tight">¿Eliminar tu cuenta?</h3>
              </div>
              
              <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                Esta acción es irreversible y borrará inmediatamente de forma definitiva toda tu telemetría, vehículos de tu garaje, tareas completadas, historiales, fotos de documentos e informes asociados a tu cuenta <span className="text-[#2ac1ff] font-mono">{currentUser?.email}</span>.
              </p>

              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 text-[11px] font-semibold text-red-300 leading-normal">
                ¿Estás seguro de que deseas proceder? Esta acción no se puede deshacer.
              </div>

              {/* Re-authentication Segment based on Authentication Provider */}
              <div className="border-t border-white/5 pt-3 space-y-3">
                <span className="font-mono text-[9px] font-bold text-red-400/90 uppercase tracking-widest block">
                  Confirmación de Seguridad Requerida
                </span>

                {isGoogle ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-gray-400 leading-normal">
                      Has accedido a SIMVA mediante Google Auth. Para la baja definitiva, se abrirá la ventana de re-autenticación de Google al pulsar el botón de confirmación abajo.
                    </p>
                    <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/5 text-[11.5px] text-gray-300 font-mono">
                      <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                      </svg>
                      <span className="truncate">{currentUser?.email}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] text-gray-400 leading-normal">
                      Por motivos de seguridad, introduce tu contraseña actual de acceso para confirmar la eliminación definitiva de tu cuenta:
                    </p>
                    <input
                      type="password"
                      required
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="Escribe tu contraseña de SIMVA"
                      className="w-full bg-black border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:border-red-500/50 outline-none transition-all font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Specific local reauthentication error */}
              {deleteReauthError && (
                <div className="p-3 bg-red-400/10 border border-red-500/20 text-red-300 rounded-xl text-[11px] font-medium leading-normal animate-pulse">
                  {deleteReauthError}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletePassword("");
                    setDeleteReauthError(null);
                  }}
                  className="py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer uppercase tracking-wider"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="py-2 px-4 bg-red-600 hover:bg-red-500 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer uppercase tracking-wider shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                >
                  Sí, eliminar definitivamente
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Main container with responsive layouts */}
      {!currentUser ? (
        <main className="mx-auto w-full max-w-md px-4 py-8">
          <AuthScreen onAuthSuccess={() => {}} />
        </main>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row w-full max-w-7xl mx-auto relative px-4 md:px-8 gap-6 pt-4">
          {/* MOBILE SIDEBAR BACKGROUND SHADOW BACKDROP */}
          {isMobileMenuOpen && (
            <div 
              className="fixed inset-0 z-45 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-300"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* MOBILE SIDEBAR COLLAPSIBLE DRAWER */}
          <nav 
            className={`fixed top-0 left-0 h-screen w-72 z-48 bg-[#11141a]/95 backdrop-blur-2xl border-r border-white/10 pt-20 pb-8 px-5 flex flex-col justify-start items-stretch gap-3 shadow-[5px_0_30px_rgba(0,0,0,0.6)] md:hidden transition-transform duration-300 ease-in-out ${
              isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="flex items-center justify-between px-3 pb-3 border-b border-white/15 mb-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#2ac1ff] font-extrabold">MENÚ PRINCIPAL</span>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-md text-on-surface-variant hover:text-white cursor-pointer"
                title="Cerrar Menú"
              >
                <span className="text-[10px] font-mono uppercase font-semibold">cerrar ✕</span>
              </button>
            </div>

            {/* Garaje button */}
            <button
              onClick={() => {
                setActiveScreen("garaje");
                setIsRegistering(false);
                setSelectedDetailVehicleId(null);
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3.5 py-3 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "garaje"
                  ? "text-primary-fixed-dim bg-white/5 border border-[#2ac1ff]/30 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <LayoutGrid className="h-5 w-5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Garaje</span>
            </button>

            {/* Mantenimiento button */}
            <button
              onClick={() => {
                setActiveScreen("mantenimientos");
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3.5 py-3 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "mantenimientos"
                  ? "text-primary-fixed-dim bg-white/5 border border-[#2ac1ff]/30 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <Wrench className="h-5 w-5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Mantenimiento</span>
            </button>

            {/* Talleres button */}
            <button
              onClick={() => {
                setActiveScreen("talleres");
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3.5 py-3 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "talleres"
                  ? "text-primary-fixed-dim bg-white/5 border border-[#2ac1ff]/30 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <MapPin className="h-5 w-5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Talleres</span>
            </button>

            {/* Guantera button */}
            <button
              onClick={() => {
                setActiveScreen("documentos");
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3.5 py-3 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "documentos"
                  ? "text-primary-fixed-dim bg-white/5 border border-[#2ac1ff]/30 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <FileText className="h-5 w-5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Guantera</span>
            </button>

            {/* Perfil button */}
            <button
              onClick={() => {
                setActiveScreen("perfil");
                setIsMobileMenuOpen(false);
              }}
              className={`flex items-center gap-3.5 py-3 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "perfil"
                  ? "text-primary-fixed-dim bg-white/5 border border-[#2ac1ff]/30 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <User className="h-5 w-5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Perfil</span>
            </button>
          </nav>

          {/* DESKTOP SIDEBAR - STICKY AND PERSISTENT */}
          <nav className="hidden md:flex md:sticky md:top-24 md:z-10 md:w-64 md:flex-col md:justify-start md:items-stretch gap-3 px-4 py-5 bg-[#11141a]/60 border border-white/5 rounded-2xl shrink-0 h-fit">
            <div className="px-3 pb-3 border-b border-white/5 mb-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#2ac1ff] font-extrabold block">MENÚ PRINCIPAL</span>
            </div>
            
            {/* Garaje button */}
            <button
              onClick={() => {
                setActiveScreen("garaje");
                setIsRegistering(false);
                setSelectedDetailVehicleId(null);
              }}
              className={`flex items-center gap-3 py-2.5 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "garaje"
                  ? "text-primary-fixed-dim bg-[#2ac1ff]/10 border border-[#2ac1ff]/20 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <LayoutGrid className="h-4.5 w-4.5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Garaje</span>
            </button>

            {/* Mantenimiento button */}
            <button
              onClick={() => {
                setActiveScreen("mantenimientos");
              }}
              className={`flex items-center gap-3 py-2.5 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "mantenimientos"
                  ? "text-primary-fixed-dim bg-[#2ac1ff]/10 border border-[#2ac1ff]/20 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <Wrench className="h-4.5 w-4.5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Mantenimiento</span>
            </button>

            {/* Talleres button */}
            <button
              onClick={() => {
                setActiveScreen("talleres");
              }}
              className={`flex items-center gap-3 py-2.5 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "talleres"
                  ? "text-primary-fixed-dim bg-[#2ac1ff]/10 border border-[#2ac1ff]/20 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <MapPin className="h-4.5 w-4.5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Talleres</span>
            </button>

            {/* Guantera/Documentos button */}
            <button
              onClick={() => {
                setActiveScreen("documentos");
              }}
              className={`flex items-center gap-3 py-2.5 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "documentos"
                  ? "text-primary-fixed-dim bg-[#2ac1ff]/10 border border-[#2ac1ff]/20 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <FileText className="h-4.5 w-4.5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Guantera</span>
            </button>

            {/* Perfil button */}
            <button
              onClick={() => {
                setActiveScreen("perfil");
              }}
              className={`flex items-center gap-3 py-2.5 px-4 rounded-xl cursor-pointer w-full text-left transition-all ${
                activeScreen === "perfil"
                  ? "text-primary-fixed-dim bg-[#2ac1ff]/10 border border-[#2ac1ff]/20 font-bold"
                  : "text-on-surface-variant hover:text-white hover:bg-white/5"
              }`}
            >
              <User className="h-4.5 w-4.5 shrink-0 text-[#2ac1ff]" />
              <span className="font-mono text-xs tracking-wider uppercase">Perfil</span>
            </button>
          </nav>

          {/* Main Content Viewport */}
          <main className="flex-1 max-w-2xl mx-auto w-full md:mx-0">
            {/* Dynamic Warning Notification / Info Bar */}
            {error || infoMessage ? (
              <div className="mb-6 animate-fade-in max-w-2xl mx-auto">
                {error ? (
                  <div className="flex items-center gap-2.5 rounded-lg bg-red-500/10 border border-red-500/30 p-4 text-xs font-semibold text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
                    <AlertTriangle className="h-4.5 w-4.5 text-red-500 shrink-0" />
                    <span>{error}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
                    <span>{infoMessage}</span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Dynamic Display of active screen */}
            <div className="mx-auto max-w-2xl">
              {activeScreen === "garaje" && (
                <div className="animate-fade-in flex flex-col gap-6">
                  {isRegistering ? (
                    <div className="animate-fade-in flex flex-col gap-4">
                      <button
                        onClick={() => setIsRegistering(false)}
                        className="py-2 px-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer uppercase tracking-wider flex items-center gap-2 self-start mb-2"
                      >
                        <span>Volver al Garaje</span>
                      </button>
                      <CarProfileForm 
                        onSave={handleSaveProfile} 
                        isLoading={isLoading} 
                        currentProfile={carProfile}
                      />
                    </div>
                  ) : (
                    /* General List of Registered Vehicles - basic cards only */
                    <div className="glass-card p-5 rounded-2xl border border-white/15 shadow-[0_4px_30px_rgba(0,0,0,0.3)] backdrop-blur-md">
                      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                        <div>
                          <h3 className="font-sans font-extrabold text-[#2ac1ff] tracking-tight text-base uppercase">Mis Vehículos Registrados</h3>
                          <p className="text-[10px] text-on-surface-variant font-mono uppercase mt-0.5">se siempre el rey de la carretera</p>
                        </div>
                        <button
                          onClick={() => {
                            setCarProfile(null);
                            setIsRegistering(true);
                          }}
                          className="py-1.5 px-3 bg-[#2ac1ff]/10 hover:bg-[#2ac1ff]/20 border border-[#2ac1ff]/20 hover:border-[#2ac1ff]/40 text-[#2ac1ff] text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider flex items-center gap-1.5"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Añadir Vehículo</span>
                        </button>
                      </div>

                      {vehicles.length === 0 ? (
                        <div className="text-center py-8 text-on-surface-variant text-xs font-mono">
                          No hay vehículos registrados en tu garaje electrónico. Registra uno nuevo.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3.5">
                          {vehicles.map((veh) => {
                            const isSelected = selectedDetailVehicleId === veh.id;
                            const vehTasks = vehiclesTasksMap[veh.id || ""] || [];
                            const vehTracking = vehiclesTrackingMap[veh.id || ""] || [];
                            const lifelineScore = calculateVehicleLifeline(veh, vehTasks, vehTracking);

                            const overallStatusColor = getVehiclesOverallColor(veh, vehTasks, vehTracking);
                            let lifelineColor = "bg-emerald-500";
                            let lifelineText = "text-emerald-400";
                            let lifelineGlow = "shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                            if (overallStatusColor === "danger") {
                              lifelineColor = "bg-red-500";
                              lifelineText = "text-red-400 font-bold animate-pulse";
                              lifelineGlow = "shadow-[0_0_10px_rgba(239,68,68,0.5)]";
                            } else if (overallStatusColor === "warning") {
                              lifelineColor = "bg-amber-500";
                              lifelineText = "text-amber-400";
                              lifelineGlow = "shadow-[0_0_10px_rgba(245,158,11,0.3)]";
                            }

                            const isMotoType = veh.vehicleType === "Moto";

                            return (
                              <div
                                key={veh.id}
                                onClick={() => {
                                  selectVehicle(veh);
                                  setSelectedDetailVehicleId(veh.id || null);
                                  setNewOdo(veh.currentKm.toString());
                                  setActiveScreen("mantenimientos");
                                }}
                                className={`group relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border transition-all cursor-pointer text-left overflow-hidden ${
                                  isSelected
                                    ? "bg-[#1e232d] border-[#2ac1ff]/40 shadow-[0_0_15px_rgba(42,193,255,0.15)]"
                                    : "bg-[#11141a]/40 hover:bg-[#1e232d]/45 border-white/5 hover:border-white/10"
                                }`}
                              >
                                <SVGTachometer isMoto={isMotoType} />
                                {/* Basic Info Portion */}
                                <div className="flex items-start gap-3.5">
                                  <div className={`p-2.5 rounded-lg border transition-all shrink-0 ${
                                    isSelected
                                      ? "bg-[#2ac1ff]/15 border-[#2ac1ff]/30 text-[#2ac1ff]"
                                      : "bg-white/5 border-white/5 text-on-surface-variant group-hover:text-white"
                                  }`}>
                                    {isMotoType ? <Bike className="h-5.5 w-5.5" /> : <Car className="h-5.5 w-5.5" />}
                                  </div>
                                  <div className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-sans font-extrabold text-sm text-white uppercase tracking-tight">
                                        {veh.makeModel}
                                      </h4>
                                    </div>
                                    <p className="text-[10px] text-[#2ac1ff] font-mono uppercase tracking-wider">
                                      {veh.vin ? `VIN: ${veh.vin}` : "Sin número de bastidor (VIN)"}
                                    </p>
                                    <p className="text-[10px] text-primary-fixed-dim font-mono font-bold">
                                      {veh.currentKm.toLocaleString("es-ES")} KMs
                                    </p>
                                  </div>
                                </div>

                                {/* Odometer Lifeline Score */}
                                <div className="mt-3 sm:mt-0 flex flex-col justify-end items-start sm:items-end gap-1.5 min-w-[140px]">
                                  <div className="flex justify-between w-full text-[10px] font-mono">
                                    <span className="text-on-surface-variant">Vida útil:</span>
                                    <span className={`${lifelineText}`}>{lifelineScore}%</span>
                                  </div>
                                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${lifelineColor} ${lifelineGlow}`}
                                      style={{ width: `${lifelineScore}%` }}
                                    />
                                  </div>
                                  <p className="text-[8px] text-on-surface-variant font-mono uppercase tracking-wider">Métrica de desgaste</p>
                                </div>

                                {/* Action buttons: Edit & Delete */}
                                <div className="absolute right-2 top-2 sm:relative sm:right-auto sm:top-auto ml-0 sm:ml-4 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCarProfile(veh);
                                      setIsRegistering(true);
                                    }}
                                    className="p-1.5 text-on-surface-variant hover:text-[#2ac1ff] hover:bg-[#2ac1ff]/10 rounded-md transition-all cursor-pointer"
                                    title="Editar vehículo"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVehicleToDelete(veh);
                                    }}
                                    className="p-1.5 text-on-surface-variant hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all cursor-pointer"
                                    title="Eliminar vehículo"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeScreen === "mantenimientos" && (() => {
                const fleetStatuses = vehicles.map(veh => {
                  const vehTasks = vehiclesTasksMap[veh.id || ""] || [];
                  const vehTracking = vehiclesTrackingMap[veh.id || ""] || [];
                  const status = getVehiclesOverallColor(veh, vehTasks, vehTracking);
                  return { veh, status };
                });

                const criticalVehicles = fleetStatuses.filter(f => f.status === "danger");
                const warningVehicles = fleetStatuses.filter(f => f.status === "warning");
                const okayVehicles = fleetStatuses.filter(f => f.status !== "danger" && f.status !== "warning");

                return (
                  <div className="animate-fade-in flex flex-col gap-6">
                    {vehicles.length === 0 ? (
                      <div className="glass-card p-10 rounded-2xl border border-white/10 text-center space-y-4">
                        <div className="p-4 bg-[#2ac1ff]/10 rounded-full w-fit mx-auto border border-[#2ac1ff]/20">
                          <Wrench className="h-8 w-8 text-[#2ac1ff]" />
                        </div>
                        <h3 className="font-sans font-black text-lg text-white uppercase tracking-tight">Sin vehículos registrados</h3>
                        <p className="text-xs text-on-surface-variant font-mono max-w-sm mx-auto leading-relaxed">
                          Registra un vehículo en tu garaje electrónico para ver su estado y plan de mantenimiento.
                        </p>
                        <button
                          onClick={() => {
                            setActiveScreen("garaje");
                            setIsRegistering(true);
                            setCarProfile(null);
                          }}
                          className="py-2.5 px-5 bg-[#2ac1ff] hover:bg-[#2ac1ff]/90 text-black font-semibold text-xs font-sans rounded-xl transition-all cursor-pointer uppercase tracking-wider shadow-[0_0_15px_rgba(42,193,255,0.2)]"
                        >
                          Registrar Vehículo
                        </button>
                      </div>
                    ) : (
                      <>
                        {/* Fleet health status card requested by the user */}
                        <div className="glass-card p-5 rounded-2xl border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)] backdrop-blur-md text-left">
                          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                            <div>
                              <h3 className="font-sans font-black text-[#2ac1ff] uppercase tracking-tight text-sm flex items-center gap-2">
                                <Sliders className="h-4.5 w-4.5 text-[#2ac1ff]" />
                                <span>Resumen de Alertas y Diagnóstico de Flota</span>
                              </h3>
                              <p className="text-[10px] text-on-surface-variant font-mono uppercase mt-0.5">
                                Estado predictivo de todos los vehículos registrados
                              </p>
                            </div>
                            <div className="font-mono text-[9px] text-[#2ac1ff]/90 bg-[#2ac1ff]/10 border border-[#2ac1ff]/20 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                              {vehicles.length} {vehicles.length === 1 ? "Vehículo" : "Vehículos"}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* 🔴 Sección de Peligro Crítico */}
                            <div className="bg-red-500/5 hover:bg-red-500/[0.08] duration-200 border border-red-500/20 rounded-xl p-4 flex flex-col gap-3 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-red-500 font-bold text-[11px] uppercase tracking-wider font-mono">
                                  <motion.div
                                    animate={{
                                      scale: [1, 1.25, 1],
                                      rotate: [0, -5, 5, 0]
                                    }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: "easeInOut"
                                    }}
                                    className="text-red-500 shrink-0"
                                  >
                                    <AlertTriangle className="h-4 w-4" />
                                  </motion.div>
                                  <span>Peligro Crítico</span>
                                </div>
                                <span className="bg-red-500/20 border border-red-500/30 text-red-400 font-mono text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                                  {criticalVehicles.length}
                                </span>
                              </div>

                              {criticalVehicles.length === 0 ? (
                                <div className="py-2.5 text-center">
                                  <p className="text-[11px] text-on-surface-variant font-mono uppercase tracking-wider">
                                    🟢 Sin Alertas Críticas
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                                  {criticalVehicles.map(({ veh }) => {
                                    const isSelected = selectedDetailVehicleId === veh.id;
                                    return (
                                      <div
                                        key={veh.id}
                                        onClick={() => {
                                          selectVehicle(veh);
                                          setSelectedDetailVehicleId(veh.id || null);
                                          setNewOdo(veh.currentKm.toString());
                                        }}
                                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                                          isSelected
                                            ? "bg-red-500/20 border-red-400 text-white shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                                            : "bg-black/40 border-red-500/20 text-white/90 hover:bg-red-500/10 hover:border-red-500/40"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-red-400 shrink-0">⚠️</span>
                                          <div className="text-left">
                                            <p className="font-sans font-extrabold text-[12px] uppercase leading-tight">
                                              {veh.makeModel}
                                            </p>
                                            <p className="text-[9px] text-[#2ac1ff] font-mono leading-none mt-0.5">
                                              {veh.vin ? `VIN: ${veh.vin}` : "Sin VIN"}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="text-[9px] font-mono font-bold bg-black/60 px-1.5 py-0.5 rounded text-red-400 border border-red-400/20">
                                            {veh.currentKm.toLocaleString("es-ES")} KMs
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveScreen("talleres");
                                            }}
                                            className="py-1 px-2.5 bg-[#2ac1ff]/20 hover:bg-[#2ac1ff]/35 text-[#2ac1ff] hover:text-white border border-[#2ac1ff]/35 hover:border-[#2ac1ff]/60 text-[9px] font-mono font-bold rounded transition-all cursor-pointer uppercase tracking-wider"
                                            title="Buscar taller mecánico para este vehículo"
                                          >
                                            Buscar Taller
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* 🟡 Sección de Advertencia */}
                            <div className="bg-amber-500/5 hover:bg-amber-500/[0.08] duration-200 border border-amber-500/20 rounded-xl p-4 flex flex-col gap-3 transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-amber-500 font-bold text-[11px] uppercase tracking-wider font-mono">
                                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                                  <span>Advertencia</span>
                                </div>
                                <span className="bg-amber-500/20 border border-amber-500/30 text-amber-400 font-mono text-[10px] px-1.5 py-0.5 rounded-md font-bold">
                                  {warningVehicles.length}
                                </span>
                              </div>

                              {warningVehicles.length === 0 ? (
                                <div className="py-2.5 text-center">
                                  <p className="text-[11px] text-on-surface-variant font-mono uppercase tracking-wider">
                                    ⭐ Sin Advertencias
                                  </p>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                                  {warningVehicles.map(({ veh }) => {
                                    const isSelected = selectedDetailVehicleId === veh.id;
                                    return (
                                      <div
                                        key={veh.id}
                                        onClick={() => {
                                          selectVehicle(veh);
                                          setSelectedDetailVehicleId(veh.id || null);
                                          setNewOdo(veh.currentKm.toString());
                                        }}
                                        className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                                          isSelected
                                            ? "bg-amber-500/20 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                            : "bg-black/40 border-amber-500/20 text-white/90 hover:bg-amber-500/10 hover:border-amber-500/40"
                                        }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-amber-400 shrink-0">🔧</span>
                                          <div className="text-left">
                                            <p className="font-sans font-extrabold text-[12px] uppercase leading-tight">
                                              {veh.makeModel}
                                            </p>
                                            <p className="text-[9px] text-[#2ac1ff] font-mono leading-none mt-0.5">
                                              {veh.vin ? `VIN: ${veh.vin}` : "Sin VIN"}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="text-[9px] font-mono font-bold bg-black/60 px-1.5 py-0.5 rounded text-amber-400 border border-amber-400/20">
                                          {veh.currentKm.toLocaleString("es-ES")} KMs
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 🟢 Sección de Vehículos Correctos */}
                          {okayVehicles.length > 0 && (
                            <div className="border-t border-white/5 pt-3.5 mt-3 flex flex-wrap items-center gap-2">
                              <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
                                Vehículos Al Día:
                              </span>
                              {okayVehicles.map(({ veh }) => {
                                const isSelected = selectedDetailVehicleId === veh.id;
                                return (
                                  <button
                                    key={veh.id}
                                    type="button"
                                    onClick={() => {
                                      selectVehicle(veh);
                                      setSelectedDetailVehicleId(veh.id || null);
                                      setNewOdo(veh.currentKm.toString());
                                    }}
                                    className={`py-1 px-2.5 rounded-lg text-[10px] font-mono font-semibold transition-all border flex items-center gap-1.5 cursor-pointer ${
                                      isSelected
                                        ? "bg-emerald-500/20 border-emerald-400 text-white"
                                        : "bg-emerald-950/20 border-emerald-500/10 text-emerald-300 hover:border-emerald-500/30"
                                    }`}
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>{veh.makeModel}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Detail of selected vehicle */}
                        {!selectedDetailVehicleId ? (
                          <div className="glass-card p-6 rounded-2xl border border-white/10 text-center">
                            <p className="text-xs text-on-surface-variant font-mono">
                              👇 Selecciona un vehículo de las listas de arriba para ver su plan de trabajo detallado.
                            </p>
                          </div>
                        ) : (() => {
                          const currentVeh = vehicles.find(v => v.id === selectedDetailVehicleId);
                          if (!currentVeh) {
                            return (
                              <div className="text-center py-6 text-on-surface-variant text-xs font-mono">
                                Vehículo no encontrado.
                              </div>
                            );
                          }

                          const vehTasks = vehiclesTasksMap[currentVeh.id || ""] || [];
                          const vehTracking = vehiclesTrackingMap[currentVeh.id || ""] || [];
                          const lifelineScore = calculateVehicleLifeline(currentVeh, vehTasks, vehTracking);

                          const overallStatusColor = getVehiclesOverallColor(currentVeh, vehTasks, vehTracking);
                          let lifelineColor = "bg-emerald-500";
                          let lifelineText = "text-emerald-400";
                          let lifelineGlow = "shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                          if (overallStatusColor === "danger") {
                            lifelineColor = "bg-red-500";
                            lifelineText = "text-red-400 font-bold animate-pulse";
                            lifelineGlow = "shadow-[0_0_10px_rgba(239,68,68,0.5)]";
                          } else if (overallStatusColor === "warning") {
                            lifelineColor = "bg-amber-500";
                            lifelineText = "text-amber-400";
                            lifelineGlow = "shadow-[0_0_10px_rgba(245,158,11,0.3)]";
                          }

                          const isMotoType = currentVeh.vehicleType === "Moto";

                          return (
                            <div className="animate-fade-in flex flex-col gap-6">
                              <div className="flex items-center justify-between">
                                <h3 className="font-sans font-black text-base text-[#2ac1ff] uppercase tracking-tight">Plan de Mantenimiento Detallado</h3>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCarProfile(currentVeh);
                                    setIsRegistering(true);
                                    setActiveScreen("garaje");
                                  }}
                                  className="py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#2ac1ff]/30 text-white hover:text-[#2ac1ff] text-[10.5px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                                >
                                  Editar Ficha
                                </button>
                              </div>

                              {/* Complete Vehicle Details Summary Panel */}
                              <div className="glass-card p-5 rounded-2xl border border-white/15 shadow-[0_4px_30px_rgba(0,0,0,0.3)] backdrop-blur-md text-left relative overflow-hidden group">
                                <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-[#2ac1ff]/10 to-transparent rounded-bl-full pointer-events-none" />
                                <SVGTachometer isMoto={isMotoType} />
                                
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                  <div className="flex items-start gap-4">
                                    <div className="p-3.5 rounded-xl bg-[#2ac1ff]/15 border border-[#2ac1ff]/30 text-[#2ac1ff] shrink-0">
                                      {isMotoType ? <Bike className="h-7 w-7" /> : <Car className="h-7 w-7" />}
                                    </div>
                                    <div className="space-y-1">
                                      <h3 className="font-sans font-black text-xl text-white uppercase tracking-tight">
                                        {currentVeh.makeModel}
                                      </h3>
                                      <p className="text-xs text-on-surface-variant font-mono">
                                        {currentVeh.vehicleType} · {currentVeh.fuelType} · {currentVeh.year}
                                      </p>
                                      {currentVeh.vin && (
                                        <p className="text-[10px] text-[#2ac1ff] font-mono font-semibold uppercase">
                                          Nº Bastidor (VIN): {currentVeh.vin}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex flex-col items-start md:items-end gap-1.5 shrink-0 min-w-[150px]">
                                    <div className="flex justify-between w-full text-xs font-mono">
                                      <span className="text-on-surface-variant">Línea de vida útil:</span>
                                      <span className={`${lifelineText} font-black`}>{lifelineScore}%</span>
                                    </div>
                                    <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${lifelineColor} ${lifelineGlow}`}
                                        style={{ width: `${lifelineScore}%` }}
                                      />
                                    </div>
                                    <p className="text-[8px] text-on-surface-variant font-mono uppercase tracking-wider">Métrica de desgaste acumulado</p>
                                  </div>
                                </div>
                              </div>

                              {/* Quick Telemetry Odometer Calibration Form */}
                              <div className="glass-card p-4 rounded-xl border border-white/10 space-y-3">
                                <div className="flex items-center gap-2 text-left">
                                  <Gauge className="h-4 w-4 text-[#2ac1ff]" />
                                  <span className="font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                                    Actualiza los KMs de tu vehículo
                                  </span>
                                </div>

                                <form 
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const updatedUserKm = Number(newOdo);
                                    if (isNaN(updatedUserKm) || updatedUserKm <= 0) return;
                                    handleUpdateOdometerVal(updatedUserKm, currentVeh);
                                  }} 
                                  className="flex gap-2.5 items-end text-left"
                                >
                                  <div className="flex-1 flex flex-col gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      value={newOdo}
                                      onChange={(e) => setNewOdo(e.target.value)}
                                      className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono focus:border-[#2ac1ff] focus:outline-none"
                                      placeholder={currentVeh.currentKm.toString()}
                                    />
                                  </div>
                                  <button
                                    type="submit"
                                    className="py-2.5 px-4 bg-[#2ac1ff] hover:bg-[#2ac1ff]/85 text-black font-semibold font-sans text-xs rounded-lg active:scale-95 transition-all cursor-pointer h-[38px] uppercase tracking-wider shrink-0"
                                  >
                                    Calibrar KM
                                  </button>
                                </form>
                              </div>

                              <TaskTracker
                                  tasks={tasks}
                                  tracking={tracking}
                                  car={currentVeh}
                                  onUpdateTracking={handleUpdateTracking}
                                  onUpdateTasks={handleUpdateTasks}
                                  onResetAll={handleResetAll}
                              />
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                );
              })()}

              {activeScreen === "documentos" && (
                <div className="animate-fade-in flex flex-col gap-6">
                  <MisDocumentos />
                </div>
              )}

              {activeScreen === "perfil" && (
                <div className="animate-fade-in space-y-6 text-left">
                  {/* Profile Header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                      <h2 className="font-sans text-2xl font-black text-white tracking-tight uppercase leading-none">
                        {currentUser.displayName || currentUser.email?.split("@")[0] || "Operador Principal"}
                      </h2>
                      <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-wider mt-1">
                        {currentUser.email}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => signOut(auth)}
                      type="button"
                      className="py-1.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <LogOut className="h-3.5 w-3.5 text-red-400" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>

                  {/* Manual Calibration */}
                  {carProfile && (
                    <section className="glass-card p-4 rounded-xl border border-white/5 space-y-2">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-3.5 w-3.5 text-[#2ac1ff]" />
                        <span className="font-mono text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">
                          Calibrar Odómetro
                        </span>
                      </div>
                      <form onSubmit={handleUpdateOdometer} className="flex gap-2.5 items-end">
                        <div className="flex-1">
                          <input
                            type="number"
                            min={0}
                            value={newOdo}
                            onChange={(e) => setNewOdo(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-lg p-2 text-xs text-white font-mono focus:border-primary-fixed-dim"
                          />
                        </div>
                        <button
                          type="submit"
                          className="py-2 px-3 bg-[#2ac1ff]/10 hover:bg-[#2ac1ff]/20 border border-[#2ac1ff]/20 text-[#2ac1ff] font-bold font-mono text-[10px] rounded-lg transition-all cursor-pointer h-[32px] uppercase tracking-wider"
                        >
                          Calibrar
                        </button>
                      </form>
                    </section>
                  )}

                  {/* AJUSTES Section */}
                  <section className="glass-card p-5 rounded-2xl border border-white/10 space-y-5">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                      <Sliders className="h-4.5 w-4.5 text-[#2ac1ff]" />
                      <h4 className="font-sans font-bold text-sm text-[#2ac1ff] uppercase tracking-wider">AJUSTES</h4>
                    </div>

                    {/* Notification Switch */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-semibold text-white block">Notificaciones de Mantenimiento</label>
                          <span className="text-[10px] text-on-surface-variant font-medium">Alertas de desgaste predictivo y sensores preventivos por correo y push.</span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const nextVal = !notiPush;
                            setNotiPush(nextVal);
                            localStorage.setItem("simva_noti_push", String(nextVal));
                            if (nextVal) {
                              await requestPushPermissionAndRegister();
                            }
                          }}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${notiPush ? 'bg-[#2ac1ff]' : 'bg-white/10'}`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-black transition-transform ${notiPush ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {notiPush && (
                        <div className="bg-black/50 border border-white/5 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[9px] text-[#2ac1ff] uppercase">Estado de Push Web:</span>
                            <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${fcmToken ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                              {fcmToken ? 'Canal Conectado' : 'Pendiente Permiso'}
                            </span>
                          </div>
                          
                          {fcmToken ? (
                            <div className="space-y-1">
                              <span className="font-mono text-[8px] text-gray-400 uppercase block select-none">Token de Registro del Dispositivo:</span>
                              <div className="font-mono text-[8px] bg-black/80 px-2 py-1.5 rounded text-[#2ac1ff] break-all border border-white/5 select-all">
                                {fcmToken}
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={requestPushPermissionAndRegister}
                              className="w-full py-1.5 px-2.5 bg-[#2ac1ff]/10 hover:bg-[#2ac1ff]/20 border border-[#2ac1ff]/20 text-[#2ac1ff] font-mono text-[9px] font-bold rounded transition-all uppercase tracking-wider"
                            >
                              Conceder Permiso para Notificaciones Push
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Calibration Thresholds */}
                    <div className="space-y-3.5 border-t border-white/5 pt-4">
                      <div>
                        <span className="font-sans font-bold text-[11px] text-[#2ac1ff] uppercase tracking-wide block mb-1">Intervalos de Alerta de Kilometraje</span>
                        <p className="text-[10px] text-on-surface-variant leading-normal">
                          Configura cuántos kilómetros antes de la expiración se activará el aviso en sistema.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-left">
                          <label className="font-mono text-[9px] font-bold text-amber-400 block uppercase">Notificación Ámbar</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max="10000"
                              value={warnDistance}
                              onChange={(e) => {
                                const v = Math.max(1, Number(e.target.value));
                                setWarnDistance(v);
                                localStorage.setItem("simva_warn_distance", String(v));
                              }}
                              className="w-full bg-black border border-white/10 rounded-lg p-2 text-xs text-white font-mono focus:border-[#2ac1ff] pr-10"
                            />
                            <span className="absolute right-3 top-2.5 text-[10px] text-[#2ac1ff] font-mono">km</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-left">
                          <label className="font-mono text-[9px] font-bold text-red-400 block uppercase">Aviso Rojo</label>
                          <div className="relative">
                            <input
                              type="number"
                              min="1"
                              max="10000"
                              value={dangerDistance}
                              onChange={(e) => {
                                const v = Math.max(1, Number(e.target.value));
                                setDangerDistance(v);
                                localStorage.setItem("simva_danger_distance", String(v));
                              }}
                              className="w-full bg-black border border-white/10 rounded-lg p-2 text-xs text-white font-mono focus:border-[#2ac1ff] pr-10"
                            />
                            <span className="absolute right-3 top-2.5 text-[10px] text-[#2ac1ff] font-mono">km</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Minimal Danger Zone */}
                  <section className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <h4 className="text-red-400 font-sans font-bold text-xs uppercase tracking-wider">Zona de Peligro</h4>
                        <p className="text-[10px] text-on-surface-variant font-sans">
                          Gestión avanzada de registros e identidad.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={handleResetAll}
                          className="py-1.5 px-3 bg-red-500/10 hover:bg-red-500/15 border border-red-500/20 text-red-200 text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                        >
                          Limpiar Datos
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="py-1.5 px-3 bg-[#e11d48]/10 hover:bg-[#e11d48]/20 border border-[#e11d48]/20 text-[#fda4af] text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                        >
                          Eliminar Cuenta
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {activeScreen === "talleres" && (
                <Talleres currentUserEmail={currentUser.email} />
              )}


            </div>
          </main>
        </div>
      )}
    </div>
  );
}
