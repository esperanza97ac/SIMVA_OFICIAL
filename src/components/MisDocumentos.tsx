import React, { useState, useEffect } from "react";
import { FileText, Calendar, Upload, Trash2, CheckCircle, AlertTriangle, Paperclip, Clock } from "lucide-react";

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  expiryDate: string;
  fileName?: string;
  fileSize?: string;
}

export default function MisDocumentos() {
  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    const saved = localStorage.getItem("simva_documents");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return [
      { id: "permiso", name: "Permiso de Circulación", type: "Obligatorio", expiryDate: "2028-05-20" },
      { id: "itv", name: "Tarjeta ITV / Ficha Técnica", type: "Inspección", expiryDate: "2027-02-15" },
      { id: "seguro", name: "Póliza de Seguro", type: "Seguro", expiryDate: "2026-12-01" },
    ];
  });

  const [dragActive, setDragActive] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("simva_documents", JSON.stringify(documents));
  }, [documents]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    // Select the first document that doesn't have a file uploaded, or update ITV/Insurance as mock upload
    const sizeStr = (file.size / 1024 / 1024).toFixed(2) + " MB";
    
    // Ask which document to associate with or associate to the first empty or default to custom
    setDocuments(prev => {
      const copy = [...prev];
      const targetIdx = copy.findIndex(d => !d.fileName);
      if (targetIdx !== -1) {
        copy[targetIdx] = {
          ...copy[targetIdx],
          fileName: file.name,
          fileSize: sizeStr
        };
      } else {
        // Add custom document
        copy.push({
          id: `doc-${Date.now()}`,
          name: file.name.split(".")[0],
          type: "Extra",
          expiryDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split("T")[0],
          fileName: file.name,
          fileSize: sizeStr
        });
      }
      return copy;
    });

    setSuccessMsg(`Documento "${file.name}" cargado localmente con éxito.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleStartEdit = (doc: DocumentItem) => {
    setEditingId(doc.id);
    setTempDate(doc.expiryDate);
  };

  const handleSaveDate = (id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, expiryDate: tempDate } : d));
    setEditingId(null);
  };

  const handleRemoveFile = (id: string) => {
    setDocuments(prev => prev.map(d => d.id === id ? { ...d, fileName: undefined, fileSize: undefined } : d));
  };

  const getStatus = (dateStr: string) => {
    const today = new Date();
    const expDate = new Date(dateStr);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { label: "Expirado", color: "text-red-400 border-red-500/20 bg-red-500/5", icon: <AlertTriangle className="h-3.5 w-3.5 text-red-400" /> };
    } else if (diffDays <= 30) {
      return { label: `Vence en ${diffDays} días`, color: "text-amber-400 border-amber-500/20 bg-amber-500/5", icon: <Clock className="h-3.5 w-3.5 text-amber-400" /> };
    } else {
      return { label: "Vigente", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5", icon: <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> };
    }
  };

  return (
    <div className="animate-fade-in space-y-6 text-left">
      <header className="mb-2">
        <h2 className="font-sans text-2xl font-black text-white tracking-tight leading-none uppercase flex items-center gap-2">
          <FileText className="h-6 w-6 text-[#2ac1ff]" />
          <span>Mis Documentos</span>
        </h2>
        <p className="text-xs text-on-surface-variant font-medium mt-1 uppercase tracking-wider font-mono">
          GESTOR DE PERMISOS, POLIZAS Y COMPROBANTES DEL VEHÍCULO
        </p>
      </header>

      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)] slide-in">
          <CheckCircle className="h-4.5 w-4.5 text-emerald-500 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* List of default standard documents */}
      <div className="space-y-4">
        {documents.map((doc) => {
          const status = getStatus(doc.expiryDate);
          const isEditing = editingId === doc.id;

          return (
            <div key={doc.id} className="glass-card p-4 rounded-xl border border-white/10 hover:border-white/15 transition-all text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-lg bg-[#2ac1ff]/10 border border-[#2ac1ff]/20 text-[#2ac1ff] shrink-0">
                  <FileText className="h-5.5 w-5.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-sans font-bold text-sm text-white uppercase tracking-tight">
                      {doc.name}
                    </h4>
                    <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-on-surface-variant uppercase font-black">
                      {doc.type}
                    </span>
                  </div>
                  
                  {doc.fileName ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#2ac1ff] font-mono">
                      <Paperclip className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[180px]">{doc.fileName}</span>
                      <span className="text-on-surface-variant text-[9px]">({doc.fileSize})</span>
                      <button 
                        type="button"
                        onClick={() => handleRemoveFile(doc.id)}
                        className="text-red-400 hover:text-red-300 ml-1 font-sans text-[10px] uppercase font-bold"
                      >
                        Eliminar
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] text-on-surface-variant font-mono">
                      Sin archivo adjunto.
                    </p>
                  )}

                  {/* Date information */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar className="h-3.5 w-3.5 text-on-surface-variant" />
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="date"
                          value={tempDate}
                          onChange={(e) => setTempDate(e.target.value)}
                          className="bg-black border border-white/20 text-xs px-2 py-0.5 rounded text-white font-mono focus:outline-none focus:border-[#2ac1ff]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveDate(doc.id)}
                          className="bg-[#2ac1ff] text-black px-2 py-0.5 rounded font-sans text-[10px] font-bold uppercase"
                        >
                          Ok
                        </button>
                      </div>
                    ) : (
                      <span 
                        onClick={() => handleStartEdit(doc)}
                        className="font-mono text-[11px] text-white hover:text-[#2ac1ff] cursor-pointer underline decoration-dotted transition-colors"
                        title="Haga clic para editar vencimiento"
                      >
                        Expira: {doc.expiryDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div className={`px-2.5 py-1.5 rounded-xl border ${status.color} flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider shrink-0 max-w-fit self-start sm:self-center`}>
                {status.icon}
                <span>{status.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drag & Drop File Upload Area */}
      <section 
        className={`glass-card p-6 rounded-2xl border border-dashed transition-all text-center space-y-3 cursor-pointer relative ${
          dragActive 
            ? "border-[#2ac1ff] bg-[#2ac1ff]/5 shadow-[0_0_15px_rgba(42,193,255,0.15)]" 
            : "border-white/10 hover:border-white/20 bg-black/10"
        }`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          type="file" 
          id="docFileInput" 
          multiple={false} 
          onChange={handleFileInput} 
          className="hidden" 
          accept="image/*,application/pdf"
        />
        <label htmlFor="docFileInput" className="cursor-pointer block space-y-2.5">
          <div className="h-10 w-10 rounded-full bg-white/5 mx-auto flex items-center justify-center text-on-surface-variant">
            <Upload className="h-5 w-5 text-[#2ac1ff]" />
          </div>
          <div className="space-y-1">
            <h4 className="font-sans font-bold text-xs text-white uppercase tracking-tight">
              Arrastra y suelta tu documentación técnica aquí
            </h4>
            <p className="text-[10px] text-on-surface-variant max-w-[280px] mx-auto leading-normal">
              O haz clic para explorar tus archivos locales en tu dispositivo. Soporta PDFs e imágenes (ITV, Seguros, Permisos).
            </p>
          </div>
        </label>
      </section>
    </div>
  );
}
