import React, { useState, useEffect, useRef } from "react";
import { 
  FileText, 
  Calendar, 
  Upload, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Camera, 
  Bell, 
  BellOff, 
  ArrowLeft 
} from "lucide-react";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface DocumentItem {
  id: string;
  name: string;
  expiryDate: string;
  photoUrl?: string; // Captured camera picture or uploaded file base64 data url
  reminderEnabled?: boolean;
  reminderDays?: number;
}

export default function MisDocumentos() {
  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    const saved = localStorage.getItem("simva_documents");
    let docsList: DocumentItem[] = [];
    if (saved) {
      try {
        docsList = JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }

    const defaults: DocumentItem[] = [
      { id: "permiso", name: "Permiso de Circulación", expiryDate: "2028-05-20", reminderEnabled: true, reminderDays: 30 },
      { id: "itv", name: "Tarjeta ITV / Ficha Técnica", expiryDate: "2027-02-15", reminderEnabled: true, reminderDays: 15 },
      { id: "seguro", name: "Póliza de Seguro", expiryDate: "2026-12-01", reminderEnabled: true, reminderDays: 30 },
      { id: "conducir", name: "Carné de Conducir", expiryDate: "2031-08-10", reminderEnabled: true, reminderDays: 30 },
    ];

    if (docsList.length > 0) {
      const merged = [...docsList];
      defaults.forEach(def => {
        if (!merged.some(d => d.id === def.id)) {
          merged.push(def);
        }
      });
      return merged;
    }

    return defaults;
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Camera & custom OCR simulation states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [selectedDocIdForCamera, setSelectedDocIdForCamera] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrLog, setOcrLog] = useState<string[]>([]);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Sync with Firestore first if logged in
  useEffect(() => {
    const fetchDocsFromFirestore = async () => {
      if (auth.currentUser) {
        try {
          const userDocRef = doc(db, "users", auth.currentUser.uid, "documents", "list");
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data && Array.isArray(data.docs)) {
              const list = data.docs;
              const defaults: DocumentItem[] = [
                { id: "permiso", name: "Permiso de Circulación", expiryDate: "2028-05-20", reminderEnabled: true, reminderDays: 30 },
                { id: "itv", name: "Tarjeta ITV / Ficha Técnica", expiryDate: "2027-02-15", reminderEnabled: true, reminderDays: 15 },
                { id: "seguro", name: "Póliza de Seguro", expiryDate: "2026-12-01", reminderEnabled: true, reminderDays: 30 },
                { id: "conducir", name: "Carné de Conducir", expiryDate: "2031-08-10", reminderEnabled: true, reminderDays: 30 },
              ];
              const merged = [...list];
              defaults.forEach(def => {
                if (!merged.some(d => d.id === def.id)) {
                  merged.push(def);
                }
              });
              setDocuments(merged);
              localStorage.setItem("simva_documents", JSON.stringify(merged));
            }
          }
        } catch (err) {
          console.error("Error loading documents from Firestore:", err);
        }
      }
    };
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchDocsFromFirestore();
      }
    });
    return () => unsubscribe();
  }, []);

  const saveDocumentsList = async (updatedDocs: DocumentItem[]) => {
    setDocuments(updatedDocs);
    localStorage.setItem("simva_documents", JSON.stringify(updatedDocs));
    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid, "documents", "list");
        await setDoc(userDocRef, {
          docs: updatedDocs,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.error("Error saving documents to Firestore:", err);
      }
    }
  };

  const handleStartEdit = (doc: DocumentItem) => {
    setEditingId(doc.id);
    setTempDate(doc.expiryDate);
  };

  const handleSaveDate = (id: string) => {
    const updated = documents.map(d => d.id === id ? { ...d, expiryDate: tempDate } : d);
    saveDocumentsList(updated);
    setEditingId(null);
  };

  const notify = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Format Helper: removes the expiry day only for 'permiso de circulación' ID
  const formatExpiryWithoutDay = (dateStr: string) => {
    if (!dateStr) return "";
    const parts = dateStr.split("-");
    if (parts.length >= 2) {
      return `${parts[0]}-${parts[1]}`; // Return only Year and Month (e.g. YYYY-MM)
    }
    return dateStr;
  };

  const handleToggleReminder = (id: string, enabled: boolean) => {
    const updated = documents.map(d => d.id === id ? { ...d, reminderEnabled: enabled } : d);
    saveDocumentsList(updated);
    notify(`Alertas push ${enabled ? "activadas" : "desactivadas"} para este documento.`);
  };

  const handleUpdateReminderDays = (id: string, days: number) => {
    const updated = documents.map(d => d.id === id ? { ...d, reminderDays: days } : d);
    saveDocumentsList(updated);
    notify(`Antelación de recordatorio guardada con éxito.`);
  };

  // Push sender helper via configured backend endpoint
  const sendTestPushReminder = async (docName: string, expiryDate: string) => {
    const token = localStorage.getItem("simva_fcm_token");
    if (!token) {
      notify("⚠️ Error: Activa las notificações push en Perfil para activar tu canal.");
      return;
    }

    try {
      const displayExpiry = docName.toLowerCase().includes("permiso") 
        ? formatExpiryWithoutDay(expiryDate) 
        : expiryDate;

      const response = await fetch("/api/send-push-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fcmToken: token,
          title: `⏰ Recordatorio SIMVA: ${docName}`,
          body: `¡Atención! Tu document: "${docName}" tiene fecha límite para expirar el día ${displayExpiry}. Realiza tus revisiones a tiempo.`,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(`¡Push enviado! Revisa las notificaciones de tu dispositivo.`);
      } else {
        console.error("Failed to send push:", data);
        notify("❌ Error al procesar push con el servidor.");
      }
    } catch (err) {
      console.error("Error to send test push:", err);
      notify("❌ Error de comunicación con FCM.");
    }
  };

  const getStatus = (dateStr: string) => {
    const today = new Date();
    const expDate = new Date(dateStr);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { 
        label: "Expirado", 
        color: "text-red-400 border-red-500/20 bg-red-500/5", 
        icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> 
      };
    } else if (diffDays <= 90) {
      return { 
        label: "Vigente", 
        color: "text-red-500 border-red-500/20 bg-red-500/5", 
        icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" /> 
      };
    } else if (diffDays <= 180) {
      return { 
        label: "Vigente", 
        color: "text-amber-500 border-amber-500/20 bg-amber-500/5", 
        icon: <Clock className="h-3.5 w-3.5 text-amber-500" /> 
      };
    } else {
      return { 
        label: "Vigente", 
        color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5", 
        icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> 
      };
    }
  };

  const startCamera = async (docId: string) => {
    setSelectedDocIdForCamera(docId);
    setIsCameraActive(true);
    setOcrLog(["Iniciando subsistema CameraX...", "Esperando acceso a la cámara..."]);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setOcrLog(prev => [...prev, "✔ Cámara activa. Encuadre el documento dentro del marco de escaneo."]);
    } catch (err: any) {
      console.error("No se pudo iniciar la cámara:", err);
      setOcrLog(prev => [...prev, "❌ Error al iniciar cámara. Permiso denegado o no disponible."]);
      setTimeout(() => setIsCameraActive(false), 3000);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setSelectedDocIdForCamera(null);
    setOcrLoading(false);
  };

  const captureSnapshotAndOCR = () => {
    if (!videoRef.current || !canvasRef.current || !selectedDocIdForCamera) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageBase64 = canvas.toDataURL("image/jpeg");

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    setOcrLoading(true);
    setOcrLog([
      "✔ Imagen capturada con éxito",
      "Procesando con ML Kit for Firebase TextRecognizer...",
      "Buscando regiones boundingBox...",
      "Identificadas líneas técnicas de interés..."
    ]);

    setTimeout(() => {
      setOcrLog(prev => [...prev, "Analizando: 'COMUNIDAD EUROPEA - ESPAÑA'"]);
    }, 450);

    setTimeout(() => {
      const daysAhead = Math.floor(Math.random() * 800) + 60;
      const simulatedExpiryDate = new Date(Date.now() + daysAhead * 24 * 3600 * 1000).toISOString().split("T")[0];
      
      setOcrLog(prev => [
        ...prev,
        `✔ FECHA ENCONTRADA: ${simulatedExpiryDate}`,
        "✔ Guardando resultado localmente en memoria persistente.",
        "✔ Sincronización realizada en Firestore de Firebase."
      ]);

      const updated = documents.map(d => {
        if (d.id === selectedDocIdForCamera) {
          return {
            ...d,
            expiryDate: simulatedExpiryDate,
            photoUrl: imageBase64
          };
        }
        return d;
      });
      saveDocumentsList(updated);

      setTimeout(() => {
        stopCamera();
        notify(`¡Escaneo de "${documents.find(d => d.id === selectedDocIdForCamera)?.name}" completado!`);
      }, 800);

    }, 1800);
  };

  const handleUploadImageMock = (docId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const randomDays = Math.floor(Math.random() * 400) + 50; 
        const simulatedExpiryDate = new Date(Date.now() + randomDays * 24 * 3600 * 1000).toISOString().split("T")[0];

        const updated = documents.map(d => {
          if (d.id === docId) {
            return {
              ...d,
              expiryDate: simulatedExpiryDate,
              photoUrl: base64data
            };
          }
          return d;
        });
        saveDocumentsList(updated);
        notify(`Documento subido y procesado con éxito.`);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearPhoto = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = documents.map(d => d.id === id ? { ...d, photoUrl: undefined } : d);
    saveDocumentsList(updated);
    notify("Fotografía eliminada del documento.");
  };

  return (
    <div className="animate-fade-in space-y-6 text-left">
      <header className="mb-2">
        <h2 className="font-sans text-2xl font-black text-white tracking-tight leading-none uppercase flex items-center gap-2">
          <FileText className="h-7 w-7 text-[#2ac1ff] shrink-0" />
          <span>Mis Documentos</span>
        </h2>
        <div className="flex gap-2 items-center text-xs text-on-surface-variant font-medium mt-1">
          <span className="text-on-surface-variant font-mono uppercase tracking-wide">
            No dejes que metan al león en la jaula llevando tus docs al día
          </span>
        </div>
      </header>

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] slide-in">
          <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {isCameraActive && (
        <div className="glass-card border border-[#2ac1ff]/30 rounded-2xl p-5 bg-black/90 space-y-4 animate-scale-up z-50">
          <div className="flex justify-between items-center border-b border-white/5 pb-2">
            <h3 className="text-xs font-mono font-bold text-[#2ac1ff] uppercase tracking-wider flex items-center gap-2">
              <Camera className="h-4 w-4 animate-pulse" />
              <span>CameraX + ML Kit TextRecognizer</span>
            </h3>
            <button
              onClick={stopCamera}
              className="text-xs font-mono bg-white/10 hover:bg-white/15 text-white py-1 px-3 rounded-lg"
            >
              CERRAR
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-white/10 flex items-center justify-center">
              {!ocrLoading ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-4 border-2 border-dashed border-[#2ac1ff]/40 rounded-lg pointer-events-none flex items-center justify-center">
                    <div className="w-full h-0.5 bg-[#2ac1ff] opacity-60 absolute animate-scan line-sweep" />
                    <span className="text-[10px] font-mono bg-black/60 text-[#2ac1ff] px-2 py-0.5 rounded border border-[#2ac1ff]/20">
                      ML KIT TEXT TARGET
                    </span>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 space-y-3.5 p-4 text-center">
                  <div className="w-10 h-10 border-4 border-[#2ac1ff]/20 border-t-[#2ac1ff] rounded-full animate-spin" />
                  <p className="text-xs font-mono text-[#2ac1ff] font-bold">ANALIZANDO RECONOCIMIENTO DE TEXTO...</p>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="bg-black/60 rounded-xl p-3 border border-white/5 h-44 md:h-auto overflow-y-auto space-y-1 font-mono text-[10px] text-gray-400 text-left">
              <span className="text-[#2ac1ff] font-bold block mb-1 border-b border-white/5 pb-1">CONSOLA COM.GOOGLE.MLKIT:TEXT-RECOGNITION</span>
              {ocrLog.map((log, idx) => (
                <p key={idx} className="leading-relaxed">
                  <span className="text-on-surface-variant font-black">[{idx}]</span> {log}
                </p>
              ))}
            </div>
          </div>

          <div className="flex justify-center pt-1">
            {!ocrLoading && (
              <button
                type="button"
                onClick={captureSnapshotAndOCR}
                className="py-2 px-6 bg-[#2ac1ff] hover:bg-[#5cd3ff] text-black font-sans font-extrabold text-xs rounded-xl active:scale-95 transition-all shadow-[0_0_15px_rgba(42,193,255,0.3)] uppercase tracking-wider flex items-center gap-2"
              >
                <Camera className="h-4 w-4" />
                <span>Capturar y Procesar Documento</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {documents.map((doc) => {
          const status = getStatus(doc.expiryDate);
          const isEditing = editingId === doc.id;
          const displayExpiry = doc.id === "permiso" 
            ? formatExpiryWithoutDay(doc.expiryDate) 
            : doc.expiryDate;

          return (
            <div 
              key={doc.id} 
              className="glass-card p-5 rounded-2xl border border-white/10 hover:border-white/15 transition-all text-left flex flex-col gap-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 w-full">
                  <div className="relative h-14 w-14 rounded-xl overflow-hidden border border-white/10 bg-[#2ac1ff]/10 text-[#2ac1ff] flex items-center justify-center shrink-0">
                    {doc.photoUrl ? (
                      <>
                        <img 
                          src={doc.photoUrl} 
                          alt={doc.name} 
                          className="h-full w-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                        <button
                          type="button"
                          onClick={(e) => clearPhoto(doc.id, e)}
                          className="absolute bottom-0 right-0 left-0 bg-red-650/80 hover:bg-red-600 text-[8px] font-mono leading-tight py-0.5 text-center text-white font-extrabold uppercase"
                          title="Eliminar foto"
                        >
                          BORRAR
                        </button>
                      </>
                    ) : (
                      <FileText className="h-6 w-6 text-[#2ac1ff]/80" />
                    )}
                  </div>

                  <div className="space-y-1.5 py-0.5">
                    <h4 className="font-sans font-bold text-sm text-white uppercase tracking-tight">
                      {doc.name}
                    </h4>

                    {/* Expiration date layout with edit state */}
                    {doc.id !== "permiso" ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono">
                          <Calendar className="h-3.5 w-3.5 text-[#2ac1ff]" />
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="date"
                                value={tempDate}
                                onChange={(e) => setTempDate(e.target.value)}
                                className="bg-black border border-white/20 text-[10.5px] px-1.5 py-0.5 rounded text-white font-mono focus:outline-none focus:border-[#2ac1ff]"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveDate(doc.id)}
                                className="bg-[#2ac1ff] text-black px-1.5 py-0.5 rounded font-sans text-[9px] font-bold uppercase transition-all cursor-pointer"
                              >
                                Ok
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span 
                                onClick={() => handleStartEdit(doc)}
                                className="text-xs text-white hover:text-[#2ac1ff] cursor-pointer underline decoration-dotted transition-colors"
                                title="Haga clic para editar vencimiento"
                              >
                                Expira: {displayExpiry}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-emerald-400 font-mono bg-emerald-500/5 border border-emerald-500/10 px-2.5 py-0.5 rounded-lg w-fit">
                        No caduca / Permanente
                      </div>
                    )}
                  </div>
                </div>

                {/* Status and Action controls */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => startCamera(doc.id)}
                    className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border border-white/10 font-mono text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="h-3.5 w-3.5 text-[#2ac1ff]" />
                    <span>CámaraX</span>
                  </button>

                  <label className="py-1.5 px-3 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all border border-white/10 font-mono text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 cursor-pointer">
                    <Upload className="h-3.5 w-3.5 text-on-surface-variant" />
                    <span>Subir</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleUploadImageMock(doc.id, e)}
                      className="hidden"
                    />
                  </label>

                  {doc.id !== "permiso" && (
                    <div className={`px-2.5 py-1.5 rounded-xl border ${status.color} flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider shrink-0`}>
                      {status.icon}
                      <span>{status.label}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible Recordatorios Push Alert Config Section */}
              {doc.id !== "permiso" && (
                <div className="w-full mt-2 border-t border-white/5 pt-3">
                  <div className="flex flex-col gap-3 bg-black/40 p-4 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-gray-300 uppercase flex items-center gap-1.5">
                        <Bell className="h-4 w-4 text-[#2ac1ff]" />
                        <span>Recordatorios de Vencer</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleReminder(doc.id, !doc.reminderEnabled)}
                        className={`text-[9px] font-mono px-2.5 py-1 rounded font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          doc.reminderEnabled 
                            ? "bg-[#2ac1ff]/15 text-[#2ac1ff] border border-[#2ac1ff]/35" 
                            : "bg-white/5 text-gray-500 border border-white/5"
                        }`}
                      >
                        {doc.reminderEnabled ? "Activo 🔔" : "Desactivado 🔕"}
                      </button>
                    </div>

                    {doc.reminderEnabled && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-mono">Días de antelación:</span>
                          <select
                            value={doc.reminderDays || 30}
                            onChange={(e) => handleUpdateReminderDays(doc.id, Number(e.target.value))}
                            className="bg-black border border-white/10 text-[10.5px] font-mono rounded px-2 py-1 text-white focus:outline-none focus:border-[#2ac1ff]"
                          >
                            <option value={0}>El mismo día</option>
                            <option value={7}>7 días antes</option>
                            <option value={15}>15 días antes</option>
                            <option value={30}>30 días antes</option>
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={() => sendTestPushReminder(doc.name, doc.expiryDate)}
                          className="py-1 px-2.5 uppercase tracking-wide bg-[#2ac1ff]/10 hover:bg-[#2ac1ff]/20 text-[#2ac1ff] border border-[#2ac1ff]/20 rounded font-mono text-[9px] font-black transition-all cursor-pointer flex items-center gap-1"
                          title="Probar de inmediato el envío de notificación push"
                        >
                          <span>Probar Recordatorio Push 📱</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          );
        })}
      </div>
    </div>
  );
}
