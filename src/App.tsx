import { useState, useEffect, FormEvent } from "react";
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
import { AlertTriangle, CheckCircle, Car, LayoutGrid, PlusCircle, User, Gauge, LogOut, Bike, Trash2, Plus, ArrowLeft, Wrench, Settings, FileText, Check, Sliders, Bell, Heart } from "lucide-react";
import Talleres from "./components/Talleres";
import MisDocumentos from "./components/MisDocumentos";

// Firebase integration
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, getDocs, setDoc, collection, writeBatch } from "firebase/firestore";
import AuthScreen from "./components/AuthScreen";

export function calculateVehicleLifeline(
  car: CarProfile, 
  tasksList: MaintenanceTask[] = [], 
  trackingList: TaskTracking[] = []
): number {
  if (!tasksList || tasksList.length === 0) return 100;

  let minPercentage = 100;

  tasksList.forEach((t) => {
    let kmPct = 100;
    let timePct = 100;
    const track = trackingList.find((tr) => tr.id === t.id);

    // Mileage calculation
    if (t.cada_km > 0) {
      let kmSince = 0;
      if (track && track.lastCompletedKm !== undefined) {
        kmSince = Math.max(0, car.currentKm - track.lastCompletedKm);
      } else {
        kmSince = car.currentKm % t.cada_km;
      }
      kmPct = Math.max(0, Math.min(100, ((t.cada_km - kmSince) / t.cada_km) * 100));
    }

    // Time calculation
    if (t.cada_meses > 0) {
      let monthsSince = 6; // assume halfway if no log
      if (track && track.lastCompletedDate) {
        const lastDate = new Date(track.lastCompletedDate);
        const today = new Date();
        const diffYears = today.getFullYear() - lastDate.getFullYear();
        const diffMonths = today.getMonth() - lastDate.getMonth();
        monthsSince = Math.max(0, diffYears * 12 + diffMonths);
      }
      timePct = Math.max(0, Math.min(100, ((t.cada_meses - monthsSince) / t.cada_meses) * 100));
    }

    // A task's score is the worst of its wear vectors
    let taskPct = 100;
    if (t.cada_km > 0 && t.cada_meses > 0) {
      taskPct = Math.min(kmPct, timePct);
    } else if (t.cada_km > 0) {
      taskPct = kmPct;
    } else if (t.cada_meses > 0) {
      taskPct = timePct;
    }

    if (taskPct < minPercentage) {
      minPercentage = taskPct;
    }
  });

  return Math.round(minPercentage);
}

function SVGTachometer({ isMoto }: { isMoto: boolean }) {
  const maxVal = isMoto ? 14 : 8;
  const redlineRange = isMoto ? 11 : 6;
  const currentRPM = isMoto ? 11.2 : 5.8; // High scale visualization targets for each mode
  
  // Needle orientation angle (-140deg to 140deg scale)
  const angle = -140 + (currentRPM / maxVal) * 280;

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-28 h-28 opacity-20 pointer-events-none overflow-visible select-none transition-all duration-300 group-hover:opacity-35">
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

        {/* Tachometer legend metrics */}
        <text x="50" y="65" fontSize="6.5" textAnchor="middle" fill="rgba(255,255,255,0.25)" className="font-mono uppercase tracking-widest font-extrabold">
          RPM x1000
        </text>
        <text x="50" y="73.5" fontSize="7.5" textAnchor="middle" fill={isMoto ? "#ef4444" : "#2ac1ff"} className="font-mono font-black tracking-wider uppercase">
          {isMoto ? "MOTO 14K" : "CAR 8K"}
        </text>
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
  const [activeScreen, setActiveScreen] = useState<"garaje" | "talleres" | "documentos" | "perfil">("garaje");
  const [selectedDetailVehicleId, setSelectedDetailVehicleId] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

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
    if (!window.confirm("¿Seguro que deseas eliminar definitivamente este vehículo del garaje?")) return;
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

          // Get all vehicles
          const vehiclesSnap = await getDocs(collection(db, "users", user.uid, "vehicles"));
          let fetchedVehicles: CarProfile[] = [];
          
          vehiclesSnap.forEach((d) => {
            const data = d.data();
            fetchedVehicles.push({
              id: d.id,
              ...data
            } as CarProfile);
          });

          // Fallback to legacy single car profile & Migrate
          if (fetchedVehicles.length === 0) {
            const carDoc = await getDoc(doc(db, "users", user.uid, "car", "profile"));
            if (carDoc.exists()) {
              const legacyCar = {
                id: "default-vehicle",
                vehicleType: "Coche" as const,
                ...carDoc.data()
              } as CarProfile;
              fetchedVehicles = [legacyCar];
              
              // Migrate single car to new collection
              await setDoc(doc(db, "users", user.uid, "vehicles", "default-vehicle"), legacyCar);
              
              // Migrate fallback tasks to subcollection
              const legacyTasksSnap = await getDocs(collection(db, "users", user.uid, "tasks"));
              const batchTasks = writeBatch(db);
              legacyTasksSnap.forEach((t) => {
                const tdata = t.data() as MaintenanceTask;
                batchTasks.set(doc(db, "users", user.uid, "vehicles", "default-vehicle", "tasks", t.id), tdata);
              });
              await batchTasks.commit();

              // Migrate fallback tracking to subcollection
              const legacyTrackSnap = await getDocs(collection(db, "users", user.uid, "tracking"));
              const batchTrack = writeBatch(db);
              legacyTrackSnap.forEach((tr) => {
                const trData = tr.data() as TaskTracking;
                batchTrack.set(doc(db, "users", user.uid, "vehicles", "default-vehicle", "tracking", tr.id), trData);
              });
              await batchTrack.commit();
            }
          }

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

    tasksList.forEach(async (t) => {
      if (t.cada_km <= 0) return;

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

        try {
          console.log(`Fiting request for send-alert-email: ${t.tarea} on ${veh.makeModel}`);
          await fetch("/api/send-alert-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userEmail: currentUser.email,
              vehicleName: veh.makeModel,
              taskName: t.tarea,
              status: currentStatus,
              kmRemaining,
              currentKm: veh.currentKm,
            }),
          });
        } catch (error) {
          console.error("Error communicating with email alert API:", error);
        }
      } else if (currentStatus === "ok" && lastSentStatus !== "ok") {
        // If the task status returns to OK (resolved), remove the sentinel so it can alert again on next cycle
        delete updatedMap[alertKey];
        hasUpdatedAny = true;
      }
    });

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
    const vehicleId = profile.id || `veh-${Date.now()}`;
    const cleanProfile = { ...profile, id: vehicleId };

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
      }
    }

    setInfoMessage(null);
    setError(null);

    // If fetched, load recommended tasks
    if (shouldFetch) {
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
            vin: profile.vin,
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
      setInfoMessage("Lectura del odómetro guardada correctamente.");
      
      let initialTracking: TaskTracking[] = [];
      // Auto-reinitialize logs if they edited the vehicle settings manually
      if (lastMaintKm !== undefined && lastMaintKm > 0 && tasks.length > 0) {
        const maintDate = new Date();
        maintDate.setMonth(maintDate.getMonth() - (lastMaintMonths || 6));
        const lastCompletedDate = maintDate.toISOString().split("T")[0];

        initialTracking = tasks.map((t: any) => {
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
        if (lastMaintKm !== undefined && lastMaintKm > 0 && tasks.length > 0) {
          await saveTrackingToFirestore(currentUser.uid, vehicleId, initialTracking);
        }
      }

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

    const doubleConfirm = window.confirm(
      "¿ESTÁS COMPLETAMENTE SEGURO de que deseas eliminar tu cuenta permanentemente?\n\nEsta acción borrará irrevocablemente tu vehículo, tus tareas, tus historiales y tu cuenta de acceso de forma inmediata. No podrás recuperar tus datos."
    );

    if (!doubleConfirm) return;

    setIsLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      // 1. Wipe database entries
      const batch = writeBatch(db);
      batch.delete(doc(db, "users", currentUser.uid, "car", "profile"));

      const tasksSnap = await getDocs(collection(db, "users", currentUser.uid, "tasks"));
      tasksSnap.forEach((d) => batch.delete(d.ref));

      const trackingSnap = await getDocs(collection(db, "users", currentUser.uid, "tracking"));
      trackingSnap.forEach((d) => batch.delete(d.ref));

      await batch.commit();

      // Clear local cache
      localStorage.removeItem("automoto_profile");
      localStorage.removeItem("automoto_tasks");
      localStorage.removeItem("automoto_tracking");

      setCarProfile(null);
      setTasks([]);
      setTracking([]);

      // 2. Delete the user authentication record
      await currentUser.delete();

      setInfoMessage("Tu cuenta y todos tus datos han sido eliminados de forma permanente.");
      setTimeout(() => {
        setInfoMessage(null);
        setActiveScreen("garaje");
        setIsRegistering(true);
      }, 3500);

    } catch (err: any) {
      console.error("Error deleting account:", err);
      if (err.code === "auth/requires-recent-login") {
        setError(
          "Para eliminar tu cuenta por seguridad es necesario que vuelvas a iniciar sesión recientemente. Cierra sesión y entra de nuevo para completar la operación."
        );
      } else {
        setError("Error al eliminar la cuenta de usuario. Por favor, inténtalo de nuevo.");
      }
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

    setInfoMessage("¡Telemetría calibrada con éxito! Distancia de conducción de la unidad actualizada.");
    
    if (currentUser && vehicle.id) {
      try {
        await setDoc(doc(db, "users", currentUser.uid, "vehicles", vehicle.id), updated);
      } catch (err) {
        console.error("Error updating odometer in DB:", err);
      }
    }
    
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
          let nextDueKm = 0;
          if (track && track.lastCompletedKm !== undefined) {
            nextDueKm = track.lastCompletedKm + task.cada_km;
          } else {
            nextDueKm = Math.ceil((odometro + 1) / task.cada_km) * task.cada_km;
          }
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

        if (statusColor === "danger") {
          list.push({
            id: `${veh.id}-${task.id}-danger`,
            type: "danger",
            message: `⚠️ Aviso de SIMVA: Tu coche te pide una revisión de ${task.tarea.toLowerCase()} cuanto antes`,
            vehicleName: veh.makeModel,
            taskName: task.tarea,
            timestampText: "Hace 2 días" // 1 vez cada 3 días
          });
        } else if (statusColor === "warning") {
          list.push({
            id: `${veh.id}-${task.id}-warning`,
            type: "warning",
            message: `SIMVA detectó una anomalía leve. Echa un vistazo a ${task.tarea.toLowerCase()} antes de tu próximo viaje largo.`,
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
    <div className="flex min-h-screen flex-col bg-background font-sans antialiased text-white pt-20 pb-28 md:pt-24 md:pb-8">
      {/* Premium Dashboard Header */}
      <Header hasCar={!!carProfile} carName={carProfile?.makeModel} notifications={getNotifications()} />

      {/* Main container with responsive layouts */}
      {!currentUser ? (
        <main className="mx-auto w-full max-w-md px-4 py-8">
          <AuthScreen onAuthSuccess={() => {}} />
        </main>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row w-full max-w-7xl mx-auto relative px-4 md:px-8 gap-6 pt-4">
          
          {/* PERSISTENT RESPONSIVE NAVIGATION BAR (Sidebar on desktop / bottom bar on mobile) */}
          <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 py-4 bg-[#1e232d]/95 backdrop-blur-xl border-t border-white/5 rounded-t-2xl shadow-[0_-5px_25px_rgba(0,0,0,0.5)] md:sticky md:top-24 md:z-10 md:w-64 md:flex-col md:justify-start md:items-stretch md:gap-3 md:px-4 md:py-5 md:bg-[#11141a]/60 md:border md:border-white/5 md:rounded-2xl md:shadow-none shrink-0">
            <div className="hidden md:block px-3 pb-3 border-b border-white/5 mb-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#2ac1ff] font-extrabold pb-1 block">SIMVA MENÚ</span>
              <span className="text-[10px] text-on-surface-variant font-medium block font-sans">Diagnóstico vehicular</span>
            </div>
            
            <button
              onClick={() => {
                setActiveScreen("garaje");
                setIsRegistering(false);
              }}
              aria-label="Ver garaje de vehículos activos"
              className={`flex flex-col items-center justify-center py-1 px-4 gap-1 transition-all rounded-xl cursor-pointer md:flex-row md:items-center md:gap-3 md:py-2.5 md:px-4 md:justify-start w-full focus-visible:ring-2 focus-visible:ring-[#2ac1ff] outline-none ${
                activeScreen === "garaje"
                  ? "text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(42,193,255,0.5)] scale-[1.02] font-semibold md:bg-primary-fixed-dim/10 md:border md:border-primary-fixed-dim/20"
                  : "text-on-surface-variant hover:text-white md:hover:bg-white/5"
              }`}
            >
              <LayoutGrid className="h-5 w-5 shrink-0" />
              <span className="font-mono text-[9px] md:text-xs tracking-widest md:tracking-wider font-bold uppercase mt-0.5 md:mt-0">Garaje</span>
            </button>

            <button
              onClick={() => setActiveScreen("talleres")}
              aria-label="Buscar talleres mecánicos cercanos"
              className={`flex flex-col items-center justify-center py-1 px-4 gap-1 transition-all rounded-xl cursor-pointer md:flex-row md:items-center md:gap-3 md:py-2.5 md:px-4 md:justify-start w-full focus-visible:ring-2 focus-visible:ring-[#2ac1ff] outline-none ${
                activeScreen === "talleres"
                  ? "text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(42,193,255,0.5)] scale-[1.02] font-semibold md:bg-primary-fixed-dim/10 md:border md:border-primary-fixed-dim/20"
                  : "text-on-surface-variant hover:text-white md:hover:bg-white/5"
              }`}
            >
              <Wrench className="h-5 w-5 shrink-0" />
              <span className="font-mono text-[9px] md:text-xs tracking-widest md:tracking-wider font-bold uppercase mt-0.5 md:mt-0">Talleres</span>
            </button>

            <button
              onClick={() => setActiveScreen("documentos")}
              aria-label="Ver mis documentos"
              className={`flex flex-col items-center justify-center py-1 px-4 gap-1 transition-all rounded-xl cursor-pointer md:flex-row md:items-center md:gap-3 md:py-2.5 md:px-4 md:justify-start w-full focus-visible:ring-2 focus-visible:ring-[#2ac1ff] outline-none ${
                activeScreen === "documentos"
                  ? "text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(42,193,255,0.5)] scale-[1.02] font-semibold md:bg-primary-fixed-dim/10 md:border md:border-primary-fixed-dim/20"
                  : "text-on-surface-variant hover:text-white md:hover:bg-white/5"
              }`}
            >
              <FileText className="h-5 w-5 shrink-0" />
              <span className="font-mono text-[9px] md:text-xs tracking-widest md:tracking-wider font-bold uppercase mt-0.5 md:mt-0">Documentos</span>
            </button>

            <button
              onClick={() => setActiveScreen("perfil")}
              aria-label="Configurar perfil de usuario y telemetría"
              className={`flex flex-col items-center justify-center py-1 px-4 gap-1 transition-all rounded-xl cursor-pointer md:flex-row md:items-center md:gap-3 md:py-2.5 md:px-4 md:justify-start w-full focus-visible:ring-2 focus-visible:ring-[#2ac1ff] outline-none ${
                activeScreen === "perfil"
                  ? "text-primary-fixed-dim drop-shadow-[0_0_10px_rgba(42,193,255,0.5)] scale-[1.02] font-semibold md:bg-primary-fixed-dim/10 md:border md:border-primary-fixed-dim/20"
                  : "text-on-surface-variant hover:text-white md:hover:bg-white/5"
              }`}
            >
              <User className="h-5 w-5 shrink-0" />
              <span className="font-mono text-[9px] md:text-xs tracking-widest md:tracking-wider font-bold uppercase mt-0.5 md:mt-0">Perfil</span>
            </button>
          </nav>

          {/* Main Content Viewport */}
          <main className="flex-1 max-w-2xl mx-auto w-full md:mx-0">
            {/* Dynamic Warning Notification / Info Bar */}
            {(error || infoMessage) && (
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
            )}

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
                        <ArrowLeft className="h-4 w-4 text-[#2ac1ff]" />
                        <span>Volver al Garaje</span>
                      </button>
                      <CarProfileForm 
                        onSave={handleSaveProfile} 
                        isLoading={isLoading} 
                        currentProfile={carProfile}
                      />
                    </div>
                  ) : selectedDetailVehicleId ? (() => {
                    const currentVeh = vehicles.find(v => v.id === selectedDetailVehicleId);
                    if (!currentVeh) {
                      setSelectedDetailVehicleId(null);
                      return null;
                    }

                    const vehTasks = vehiclesTasksMap[currentVeh.id || ""] || [];
                    const vehTracking = vehiclesTrackingMap[currentVeh.id || ""] || [];
                    const lifelineScore = calculateVehicleLifeline(currentVeh, vehTasks, vehTracking);

                    let lifelineColor = "bg-emerald-500";
                    let lifelineText = "text-emerald-400";
                    let lifelineGlow = "shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                    if (lifelineScore < 30) {
                      lifelineColor = "bg-red-500";
                      lifelineText = "text-red-400 font-bold animate-pulse";
                      lifelineGlow = "shadow-[0_0_10px_rgba(239,68,68,0.5)]";
                    } else if (lifelineScore < 70) {
                      lifelineColor = "bg-amber-500";
                      lifelineText = "text-amber-400";
                      lifelineGlow = "shadow-[0_0_10px_rgba(245,158,11,0.3)]";
                    }

                    const isMotoType = currentVeh.vehicleType === "Moto";

                    return (
                      <div className="animate-fade-in flex flex-col gap-6">
                        {/* Back navigation header */}
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setSelectedDetailVehicleId(null)}
                            className="py-2 px-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-xs font-mono font-bold rounded-xl transition-all cursor-pointer uppercase tracking-wider flex items-center gap-2"
                          >
                            <ArrowLeft className="h-4 w-4 text-[#2ac1ff]" />
                            <span>← Volver al Garaje</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedDetailVehicleId(null);
                              setCarProfile(currentVeh);
                              setIsRegistering(true);
                            }}
                            className="py-1.5 px-3.5 bg-[#2ac1ff]/10 hover:bg-[#2ac1ff]/20 border border-[#2ac1ff]/20 text-[#2ac1ff] text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                          >
                            Editar Vehículo
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

                            {/* Circular Lifeline Metric */}
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

                        {/* Dedicated Quick Telemetry Odometer Calibration Form */}
                        <div className="glass-card p-4 rounded-xl border border-white/10 space-y-3">
                          <div className="flex items-center gap-2 text-left">
                            <Gauge className="h-4 w-4 text-[#2ac1ff]" />
                            <span className="font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                              Calibración Rápida de Odómetro (Telemetría Activa)
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
                              <label className="font-mono text-[9px] font-bold text-on-surface-variant uppercase">Lectura del cuentakilómetros real</label>
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

                        {/* Interactive Task Tracker for Selected Vehicle Details */}
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
                  })() : (
                    /* General List of Registered Vehicles - basic cards only */
                    <div className="glass-card p-5 rounded-2xl border border-white/15 shadow-[0_4px_30px_rgba(0,0,0,0.3)] backdrop-blur-md">
                      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                        <div>
                          <h3 className="font-sans font-extrabold text-[#2ac1ff] tracking-tight text-base uppercase">Mis Vehículos Registrados</h3>
                          <p className="text-[10px] text-on-surface-variant font-mono uppercase mt-0.5">SELECCIONA UN VEHÍCULO PARA CONTROLAR SU PLAN Y DETALLES</p>
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
                            const isSelected = carProfile?.id === veh.id;
                            const vehTasks = vehiclesTasksMap[veh.id || ""] || [];
                            const vehTracking = vehiclesTrackingMap[veh.id || ""] || [];
                            const lifelineScore = calculateVehicleLifeline(veh, vehTasks, vehTracking);

                            let lifelineColor = "bg-emerald-500";
                            let lifelineText = "text-emerald-400";
                            let lifelineGlow = "shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                            if (lifelineScore < 30) {
                              lifelineColor = "bg-red-500";
                              lifelineText = "text-red-400 font-bold animate-pulse";
                              lifelineGlow = "shadow-[0_0_10px_rgba(239,68,68,0.5)]";
                            } else if (lifelineScore < 70) {
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
                                    <p className="text-[10px] text-on-surface-variant font-mono">
                                      {veh.fuelType} · {veh.year} · VIN: {veh.vin || "No especificado"}
                                    </p>
                                    <p className="text-[10px] text-primary-fixed-dim font-mono font-bold">
                                      Odómetro: {veh.currentKm.toLocaleString("es-ES")} KMs
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

                                {/* Quick delete vehicle anchor */}
                                <div className="absolute right-2 top-2 sm:relative sm:right-auto sm:top-auto ml-0 sm:ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (veh.id) {
                                        deleteVehicle(veh.id);
                                        if (selectedDetailVehicleId === veh.id) {
                                          setSelectedDetailVehicleId(null);
                                        }
                                      }
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

              {activeScreen === "documentos" && (
                <div className="animate-fade-in flex flex-col gap-6">
                  <MisDocumentos />
                </div>
              )}

              {activeScreen === "perfil" && (
                <div className="animate-fade-in space-y-6 text-left">
                  {/* Profile Header */}
                  <header className="mb-2">
                    <h2 className="font-sans text-2xl font-bold text-white tracking-tight mb-1">
                      Perfil de Telemetría
                    </h2>
                    <p className="text-xs text-on-surface-variant font-medium">
                      Información de tu nodo SIMVA y herramientas de calibración del sistema.
                    </p>
                  </header>

                  {/* Driver Card */}
                  <section className="glass-card p-5 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden shadow-lg">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 shrink-0 rounded-full bg-primary-fixed-dim/20 border border-primary-fixed-dim/40 flex items-center justify-center text-primary-fixed-dim font-bold text-base shadow-[0_0_15px_rgba(0,221,221,0.2)]">
                        {currentUser.email ? currentUser.email[0].toUpperCase() : "U"}
                      </div>
                      <div>
                        <h3 className="text-white font-sans font-bold text-sm">Operador Principal</h3>
                        <p className="font-mono text-[9px] text-primary-fixed-dim uppercase tracking-wider">
                          {currentUser.email}
                        </p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">
                          ID: {currentUser.uid.slice(0, 12)}... · SIMVA Conectado
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => signOut(auth)}
                      type="button"
                      className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-200 text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5 self-start sm:self-center"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Cerrar Sesión</span>
                    </button>

                    <div className="absolute top-4 right-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 text-[9px] font-mono text-emerald-400 font-bold hidden sm:block">
                      SISTEMA_OK
                    </div>
                  </section>

                  {/* Stats Grid */}
                  <section className="grid grid-cols-3 gap-3">
                    <div className="glass-card p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                      <span className="font-mono text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">ODÓMETRO</span>
                      <span className="font-mono text-xs font-bold text-white truncate">
                        {carProfile ? `${carProfile.currentKm.toLocaleString("es-ES")} km` : "--"}
                      </span>
                    </div>
                    
                    <div className="glass-card p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                      <span className="font-mono text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">PLAN RECOM</span>
                      <span className="font-mono text-xs font-bold text-white truncate">
                        {tasks.length} Tareas
                      </span>
                    </div>

                    <div className="glass-card p-3 rounded-xl border border-white/10 flex flex-col gap-1">
                      <span className="font-mono text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">HISTORIAL</span>
                      <span className="font-mono text-xs font-bold text-white truncate">
                        {tracking.length} Logs
                      </span>
                    </div>
                  </section>

                  {/* Quick Odometer Calibration */}
                  {carProfile && (
                    <section className="glass-card p-4 rounded-xl border border-white/10 space-y-3.5">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-primary-fixed-dim" />
                        <span className="font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                          Calibración Manual de Telemetría
                        </span>
                      </div>

                      <form onSubmit={handleUpdateOdometer} className="flex gap-2.5 items-end">
                        <div className="flex-1 flex flex-col gap-1">
                           <label className="font-mono text-[9px] font-bold text-on-surface-variant">KILÓMETROS DEL SENSOR</label>
                          <input
                            type="number"
                            min={0}
                            value={newOdo}
                            onChange={(e) => setNewOdo(e.target.value)}
                            className="w-full bg-black border border-outline-variant rounded-lg p-2.5 text-xs text-white font-mono focus:border-primary-fixed-dim"
                          />
                        </div>
                        <button
                          type="submit"
                          className="py-2.5 px-4 bg-primary-fixed-dim text-black font-semibold font-mono text-[11px] rounded-lg hover:bg-white active:scale-95 transition-all cursor-pointer h-[38px] uppercase tracking-wider shrink-0"
                        >
                          Calibrar
                        </button>
                      </form>
                    </section>
                  )}

                  {/* SIMVA Alerts Preferences */}
                  <section className="glass-card p-5 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                      <Sliders className="h-4.5 w-4.5 text-[#2ac1ff]" />
                      <h4 className="font-sans font-bold text-sm text-[#2ac1ff] uppercase tracking-wider">PREFERENCIAS DEL ASISTENTE SIMVA</h4>
                    </div>

                    {/* Toggle rows */}
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-semibold text-white block">Notificaciones de Mantenimiento</label>
                          <span className="text-[10px] text-on-surface-variant font-medium">Alertas de desgaste predictivo y sensores preventivos.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !notiPush;
                            setNotiPush(nextVal);
                            localStorage.setItem("simva_noti_push", String(nextVal));
                          }}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${notiPush ? 'bg-[#2ac1ff]' : 'bg-white/10'}`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-black transition-transform ${notiPush ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-semibold text-white block">Avisos Acústicos Críticos</label>
                          <span className="text-[10px] text-on-surface-variant font-medium">Bip de advertencia al iniciar cuando hay tareas expiradas rojas.</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !soundEnabled;
                            setSoundEnabled(nextVal);
                            localStorage.setItem("simva_sound_enabled", String(nextVal));
                          }}
                          className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${soundEnabled ? 'bg-[#2ac1ff]' : 'bg-white/10'}`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-black transition-transform ${soundEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* Calibration Thresholds */}
                  <section className="glass-card p-5 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                      <Bell className="h-4.5 w-4.5 text-[#2ac1ff]" />
                      <h4 className="font-sans font-bold text-sm text-[#2ac1ff] uppercase tracking-wider">INTERVALOS DE ALERTA DE KILOMETRAJE</h4>
                    </div>
                    <p className="text-[10.5px] text-on-surface-variant">
                      Personaliza cuántos kilómetros antes de que expire la tarea de mantenimiento se activará el aviso en sistema.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5 text-left">
                        <label className="font-mono text-[9px] font-bold text-on-surface-variant text-amber-400 block uppercase">NOTIFICACIÓN AMBAR (PREVENTIVA)</label>
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
                            className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono focus:border-[#2ac1ff] pr-10"
                          />
                          <span className="absolute right-3 top-2.5 text-[10px] text-[#2ac1ff] font-mono">km</span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <label className="font-mono text-[9px] font-bold text-on-surface-variant text-red-400 block uppercase">AVISO ROJO (URGENTE)</label>
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
                            className="w-full bg-black border border-white/10 rounded-lg p-2.5 text-xs text-white font-mono focus:border-[#2ac1ff] pr-10"
                          />
                          <span className="absolute right-3 top-2.5 text-[10px] text-[#2ac1ff] font-mono">km</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Reset zone */}
                  <section className="glass-card p-4 rounded-xl border border-red-500/15 bg-red-500/5 space-y-4">
                    <div className="space-y-0.5">
                      <h4 className="text-red-400 font-sans font-bold text-xs uppercase tracking-wider">Zona de Peligro</h4>
                      <p className="text-[11px] text-on-surface-variant font-sans">
                        Acciones avanzadas de gestión de registros e identidad de cuenta.
                      </p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 bg-black/25 border border-white/5 p-3 rounded-lg space-y-2">
                        <p className="text-[10.5px] font-sans text-gray-300">
                          Restablece tu dispositivo borrando el coche actual y las tareas cargadas en sistema de forma local y remota.
                        </p>
                        <button
                          onClick={handleResetAll}
                          className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-200 text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider"
                        >
                          Limpiar Datos
                        </button>
                      </div>

                      <div className="flex-1 bg-black/25 border border-white/5 p-3 rounded-lg space-y-2">
                        <p className="text-[10.5px] font-sans text-gray-300">
                          Elimina tu perfil SIMVA y borra todos tus datos asociados definitivamente del sistema y tu cuenta.
                        </p>
                        <button
                          onClick={handleDeleteAccount}
                          className="py-2.5 px-3 bg-red-600/25 hover:bg-red-600/40 border border-red-500/20 text-red-100 text-[10px] font-mono font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider"
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
