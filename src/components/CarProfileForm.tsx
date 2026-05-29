import { useState, useEffect, FormEvent } from "react";
import { 
  Car, 
  ChevronDown, 
  Fuel, 
  Droplets, 
  Zap, 
  Leaf, 
  Calendar, 
  Gauge, 
  Wrench, 
  ArrowRight,
  Bike,
  AlertCircle
} from "lucide-react";
import { CarProfile, FuelType, VehicleType } from "../types";

import { 
  SPANISH_BRANDS, 
  SPANISH_MODELS,
  SPANISH_MOTO_BRANDS,
  SPANISH_MOTO_MODELS
} from "../data/spanishVehicles";

interface CarProfileFormProps {
  onSave: (
    profile: CarProfile, 
    shouldFetch: boolean, 
    lastMaintMonths?: number, 
    lastMaintKm?: number
  ) => void;
  isLoading: boolean;
  currentProfile: CarProfile | null;
}

export default function CarProfileForm({ onSave, isLoading, currentProfile }: CarProfileFormProps) {
  const [vehicleType, setVehicleType] = useState<VehicleType>("Coche");
  const [brand, setBrand] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
  const [isBrandOpen, setIsBrandOpen] = useState(false);

  const [model, setModel] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [isModelOpen, setIsModelOpen] = useState(false);

  const [fuelType, setFuelType] = useState<FuelType>("Gasolina");
  const [year, setYear] = useState<number>(2024);
  const [currentKm, setCurrentKm] = useState<string>("");
  const [monthlyKm, setMonthlyKm] = useState<number>(1000);
  const [vin, setVin] = useState("");

  // New slider and input fields for "ÚLTIMO MANTENIMIENTO"
  const [lastMaintMonths, setLastMaintMonths] = useState<number>(6);
  const [lastMaintKm, setLastMaintKm] = useState<string>("");

  // GDPR consent state required for registration
  const [legalChecked, setLegalChecked] = useState(currentProfile ? true : false);

  // Sync state if currentProfile exists
  useEffect(() => {
    if (currentProfile) {
      setVehicleType(currentProfile.vehicleType || "Coche");
      setVin(currentProfile.vin || "");
      // Split brand and model if saved as joined makeModel
      const parts = currentProfile.makeModel.includes("-")
        ? currentProfile.makeModel.split("-")
        : currentProfile.makeModel.split(" ");
      if (parts.length > 0) {
        const firstWord = parts[0];
        const rest = parts.slice(1).join(" ");
        setBrand(firstWord);
        setBrandSearch(firstWord);
        setModel(rest);
        setModelSearch(rest);
      } else {
        setBrand(currentProfile.makeModel);
        setBrandSearch(currentProfile.makeModel);
        setModel("");
        setModelSearch("");
      }
      setFuelType(currentProfile.fuelType);
      setYear(currentProfile.year);
      setCurrentKm(currentProfile.currentKm.toString());
      setMonthlyKm(currentProfile.monthlyKm || 1000);
      setLegalChecked(true);
    }
  }, [currentProfile]);

  const brandsList = vehicleType === "Moto" ? SPANISH_MOTO_BRANDS : SPANISH_BRANDS;
  const modelsList = vehicleType === "Moto" ? SPANISH_MOTO_MODELS : SPANISH_MODELS;

  const filteredBrands = brandsList.filter((b) =>
    b.toLowerCase().includes(brandSearch.trim().toLowerCase())
  );

  const availableModels = brand ? (modelsList[brand] || []) : [];
  const filteredModels = availableModels.filter((m) =>
    m.toLowerCase().includes(modelSearch.trim().toLowerCase())
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!brand.trim()) return;

    const fullMakeModel = model.trim() 
      ? `${brand.trim()}-${model.trim()}`
      : brand.trim();

    const finalKm = Number(currentKm) || 0;
    const finalLastKm = lastMaintKm ? Number(lastMaintKm) : undefined;

    onSave({
      id: currentProfile?.id || `veh-${Date.now()}`,
      vehicleType,
      makeModel: fullMakeModel,
      fuelType,
      year: Number(year),
      currentKm: finalKm,
      monthlyKm: Number(monthlyKm),
      vin: vin.trim() || undefined
    }, true, lastMaintMonths, finalLastKm);
  };

  const selectFuel = (type: FuelType) => {
    setFuelType(type);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Simulation Header */}
      <header className="mb-2 text-left">
        <h2 className="font-sans text-2xl font-semibold text-white tracking-tight mb-1">
          Añadir Vehículo
        </h2>
        <p className="text-xs text-on-surface-variant font-medium">
          Introduce los detalles técnicos de tu vehículo.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 text-left" id="vehicleForm">
        
        {/* Basic Info Glass Card */}
        <section className="glass-card p-5 rounded-2xl space-y-5 shadow-lg border border-white/10">
          
          {/* VEHICLE TYPE SELECTOR */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              TIPO DE VEHÍCULO
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setVehicleType("Coche");
                  setBrand("");
                  setBrandSearch("");
                  setModel("");
                  setModelSearch("");
                }}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border font-mono text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  vehicleType === "Coche"
                    ? "bg-primary-fixed-dim/15 border-primary-fixed-dim text-primary-fixed-dim shadow-[0_0_12px_rgba(42,193,255,0.25)]"
                    : "bg-surface-container/50 border-white/5 text-on-surface-variant hover:text-white"
                }`}
              >
                <Car className="h-4 w-4" />
                <span>COCHE</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setVehicleType("Moto");
                  setBrand("");
                  setBrandSearch("");
                  setModel("");
                  setModelSearch("");
                }}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border font-mono text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  vehicleType === "Moto"
                    ? "bg-primary-fixed-dim/15 border-primary-fixed-dim text-primary-fixed-dim shadow-[0_0_12px_rgba(42,193,255,0.25)]"
                    : "bg-surface-container/50 border-white/5 text-on-surface-variant hover:text-white"
                }`}
              >
                <Bike className="h-4 w-4" />
                <span>MOTO</span>
              </button>
            </div>
          </div>

          {/* Brand dropdown */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
              <span>MARCA DEL VEHÍCULO</span>
              {brand && (
                <span className="text-[10px] text-primary-fixed-dim/85 font-mono normal-case tracking-normal">
                  Filtro registrado en España
                </span>
              )}
            </label>
            <div className="relative w-full">
              <input
                type="text"
                required
                placeholder="Busca o escribe marca (Ej: SEAT)..."
                value={brandSearch}
                onFocus={() => setIsBrandOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsBrandOpen(false), 200);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setBrandSearch(val);
                  setBrand(val);
                  setModel("");
                  setModelSearch("");
                }}
                className="w-full bg-black border border-outline-variant rounded-lg p-3 pr-10 text-sm text-white focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none transition-all placeholder-primary-600/50 font-sans"
              />
              <button
                type="button"
                onClick={() => setIsBrandOpen(!isBrandOpen)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-all cursor-pointer p-0.5"
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isBrandOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Suggestions list popup */}
            {isBrandOpen && (
              <div id="brand-dropdown-list" className="absolute left-0 right-0 top-[100%] z-[120] mt-1.5 max-h-56 overflow-y-auto bg-black border border-white/10 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.9)] divide-y divide-white/5 scrollbar-thin">
                {filteredBrands.length > 0 ? (
                  filteredBrands.map((b) => (
                    <div
                      key={b}
                      onMouseDown={() => {
                        setBrand(b);
                        setBrandSearch(b);
                        setModel("");
                        setModelSearch("");
                        setIsBrandOpen(false);
                      }}
                      className="px-4 py-2.5 hover:bg-white/5 active:bg-white/10 text-white text-xs cursor-pointer font-sans transition-all flex items-center justify-between"
                    >
                      <span className="font-semibold">{b}</span>
                      <span className="text-[9px] font-mono text-primary-fixed-dim/80 uppercase tracking-widest bg-primary-fixed-dim/5 px-1.5 py-0.5 rounded border border-primary-fixed-dim/10">
                        ESP
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-on-surface-variant font-medium font-sans">
                    Marca libre "{brandSearch}" (no registrada en España)
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Model dropdown dynamic to selected Brand */}
          <div className="flex flex-col gap-1.5 relative">
            <label className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
              <span>MODELO</span>
              {brand && (
                <span className="text-[10px] text-on-surface-variant font-mono normal-case tracking-normal">
                  {availableModels.length} modelos listados
                </span>
              )}
            </label>
            <div className="relative w-full">
              <input
                type="text"
                required
                placeholder={brand ? `Busca o ingresa un modelo de ${brand}...` : "Primero selecciona una marca"}
                value={modelSearch}
                disabled={!brand.trim()}
                onFocus={() => setIsModelOpen(true)}
                onBlur={() => {
                  setTimeout(() => setIsModelOpen(false), 200);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  setModelSearch(val);
                  setModel(val);
                }}
                className="w-full bg-black border border-outline-variant rounded-lg p-3 pr-10 text-sm text-white focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none transition-all placeholder-primary-600/50 disabled:opacity-50 disabled:cursor-not-allowed font-sans"
              />
              <button
                type="button"
                disabled={!brand.trim()}
                onClick={() => setIsModelOpen(!isModelOpen)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white transition-all cursor-pointer p-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isModelOpen ? "rotate-180" : ""}`} />
              </button>
            </div>

            {/* Suggestions list popup */}
            {isModelOpen && brand.trim() && (
              <div id="model-dropdown-list" className="absolute left-0 right-0 top-[100%] z-[120] mt-1.5 max-h-56 overflow-y-auto bg-black border border-white/10 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.9)] divide-y divide-white/5 scrollbar-thin">
                {filteredModels.length > 0 ? (
                  filteredModels.map((m) => (
                    <div
                      key={m}
                      onMouseDown={() => {
                        setModel(m);
                        setModelSearch(m);
                        setIsModelOpen(false);
                      }}
                      className="px-4 py-2.5 hover:bg-white/5 active:bg-white/10 text-white text-xs cursor-pointer font-sans transition-all flex items-center justify-between"
                    >
                      <span className="font-semibold">{m}</span>
                      <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10">
                        Ok
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-xs text-on-surface-variant font-medium font-sans">
                    Modelo personalizado "{modelSearch}" para {brand}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Grid layout for Year & Current Odometer */}
          <div className="grid grid-cols-2 gap-4">
            
            {/* Year selector */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                AÑO
              </label>
              <div className="relative group">
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-black border border-outline-variant duration-150 rounded-lg p-3 text-sm text-white appearance-none focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none transition-all cursor-pointer"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                  <option value={2024}>2024</option>
                  <option value={2023}>2023</option>
                  <option value={2022}>2022</option>
                  <option value={2021}>2021</option>
                  <option value={2020}>2020</option>
                  <option value={2019}>2019</option>
                  <option value={2018}>2018</option>
                  <option value={2017}>2017</option>
                  <option value={2016}>2016</option>
                  <option value={2015}>2015</option>
                  <option value={2014}>2014</option>
                  <option value={2013}>2013</option>
                  <option value={2012}>2012</option>
                  <option value={2011}>2011</option>
                  <option value={2010}>2010</option>
                  <option value={2009}>2009</option>
                  <option value={2008}>2008</option>
                </select>
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">
                  <ChevronDown className="h-4 w-4" />
                </span>
              </div>
            </div>

            {/* Current Km */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
                KILÓMETROS ACTUALES
              </label>
              <input
                type="number"
                min={0}
                placeholder="Ej: 45000"
                value={currentKm}
                onChange={(e) => setCurrentKm(e.target.value)}
                required
                className="w-full bg-black border border-outline-variant duration-150 rounded-lg p-3 text-sm text-white font-mono focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none transition-all placeholder-primary-600"
              />
            </div>

          </div>

          {/* VIN optional field */}
          <div className="flex flex-col gap-1.5 pt-1.5">
            <label className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
              <span>NÚMERO DE BASTIDOR (VIN)</span>
              <span className="text-[9px] font-mono text-primary-fixed-dim uppercase bg-primary-fixed-dim/5 px-2 py-0.5 rounded border border-primary-fixed-dim/10 tracking-widest font-extrabold select-none">
                PRECI_OK
              </span>
            </label>
            <input
              type="text"
              placeholder="Número de bastidor de 17 caracteres (opcional)"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              maxLength={17}
              className="w-full bg-black border border-outline-variant duration-150 rounded-lg p-3 text-sm text-white font-mono uppercase tracking-widest focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none transition-all placeholder-primary-600/50"
            />
          </div>

        </section>

        {/* Fuel Type Tabs Glass Card */}
        <section className="glass-card p-5 rounded-2xl space-y-3.5 shadow-lg border border-white/10">
          <label className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
            TIPO DE COMBUSTIBLE
          </label>
          <div className="grid grid-cols-4 gap-2">
            
            {/* Tab: Gasolina */}
            <button
              type="button"
              onClick={() => selectFuel("Gasolina")}
              className={`flex flex-col items-center justify-center p-3.5 border rounded-xl gap-1.5 transition-all text-xs font-mono font-medium active:scale-95 cursor-pointer ${
                fuelType === "Gasolina"
                  ? "bg-primary-fixed-dim text-black border-primary-fixed-dim shadow-[0_0_12px_rgba(0,221,221,0.4)]"
                  : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-white"
              }`}
            >
              <Fuel className="h-4 w-4" />
              <span className="text-[10px] tracking-wider uppercase">GASOLINA</span>
            </button>

            {/* Tab: Diésel */}
            <button
              type="button"
              onClick={() => selectFuel("Diésel")}
              className={`flex flex-col items-center justify-center p-3.5 border rounded-xl gap-1.5 transition-all text-xs font-mono font-medium active:scale-95 cursor-pointer ${
                fuelType === "Diésel"
                  ? "bg-primary-fixed-dim text-black border-primary-fixed-dim shadow-[0_0_12px_rgba(0,221,221,0.4)]"
                  : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-white"
              }`}
            >
              <Droplets className="h-4 w-4" />
              <span className="text-[10px] tracking-wider uppercase">DIESEL</span>
            </button>

            {/* Tab: Eléctrico */}
            <button
              type="button"
              onClick={() => selectFuel("Eléctrico")}
              className={`flex flex-col items-center justify-center p-3.5 border rounded-xl gap-1.5 transition-all text-xs font-mono font-medium active:scale-95 cursor-pointer ${
                fuelType === "Eléctrico"
                  ? "bg-primary-fixed-dim text-black border-primary-fixed-dim shadow-[0_0_12px_rgba(0,221,221,0.4)]"
                  : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-white"
              }`}
            >
              <Zap className="h-4 w-4" />
              <span className="text-[10px] tracking-wider uppercase">ELECTRICO</span>
            </button>

            {/* Tab: Híbrido */}
            <button
              type="button"
              onClick={() => selectFuel("Híbrido")}
              className={`flex flex-col items-center justify-center p-3.5 border rounded-xl gap-1.5 transition-all text-xs font-mono font-medium active:scale-95 cursor-pointer ${
                fuelType === "Híbrido"
                  ? "bg-primary-fixed-dim text-black border-primary-fixed-dim shadow-[0_0_12px_rgba(0,221,221,0.4)]"
                  : "bg-surface-container border-outline-variant text-on-surface-variant hover:text-white"
              }`}
            >
              <Leaf className="h-4 w-4" />
              <span className="text-[10px] tracking-wider uppercase">HIBRIDO</span>
            </button>

          </div>
        </section>

        {/* Maintenance History Details Glass Card */}
        <section className="glass-card p-5 rounded-2xl space-y-4 relative overflow-hidden border border-white/10">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-primary-fixed-dim/20"></div>
          
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary-fixed-dim" />
            <span className="font-mono text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              ÚLTIMO MANTENIMIENTO
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Months elapsed slider */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">
                HACE CUÁNTOS MESES
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={lastMaintMonths}
                  onChange={(e) => setLastMaintMonths(Number(e.target.value))}
                  className="flex-1 accent-primary-fixed-dim h-1 bg-primary-900 rounded-lg appearance-none cursor-pointer"
                />
                <span className="font-mono text-sm font-semibold text-primary-fixed-dim w-10 text-center shrink-0">
                  {lastMaintMonths}m
                </span>
              </div>
            </div>

            {/* Mileage level elapsed */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">
                KM DEL MANTENIMIENTO
              </label>
              <input
                type="number"
                min={0}
                placeholder="Km registrados"
                value={lastMaintKm}
                onChange={(e) => setLastMaintKm(e.target.value)}
                className="w-full bg-black border border-outline-variant duration-150 rounded-lg p-3 text-sm text-white font-mono focus:border-primary-fixed-dim focus:ring-1 focus:ring-primary-fixed-dim outline-none transition-all placeholder-primary-600"
              />
            </div>

          </div>
        </section>

        {/* Minimalist advisory notice */}
        <div className="flex gap-3 p-4 bg-primary-fixed-dim/5 border border-primary-fixed-dim/15 rounded-2xl text-left shadow-[0_0_15px_rgba(42,193,255,0.03)]">
          <AlertCircle className="h-4.5 w-4.5 text-[#2ac1ff] shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-gray-400">
            <strong>SIMVA</strong> te ofrece una información orientativa de alta precisión. Ante la duda, recurre a un profesional.
          </p>
        </div>

        {/* GDPR Legal Acknowledgment checkbox for Vehicle Registration */}
        <section className="glass-card p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4 shadow-lg">
          <div>
            <span className="font-mono text-[9px] font-bold text-primary-fixed-dim/95 uppercase tracking-widest block">
              CONFORMIDAD LEGAL Y REGISTRO (RGPD)
            </span>
            <p className="text-[10px] text-on-surface-variant font-medium mt-1">
              De acuerdo con la LOPDGDD y el RGPD europeo.
            </p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer select-none group">
            <input
              type="checkbox"
              required
              id="legalCheckbox"
              checked={legalChecked}
              onChange={(e) => setLegalChecked(e.target.checked)}
              className="mt-1 rounded bg-black border border-white/20 text-primary-fixed-dim focus:ring-0 cursor-pointer h-4.5 w-4.5 shrink-0"
            />
            <span className="text-[11px] leading-relaxed text-gray-300 group-hover:text-white transition-colors">
              Acepto la Política de Privacidad y consiento expresamente el tratamiento de los datos técnicos y kilometraje de mi coche para la calibración del diagnóstico SIMVA. <strong className="text-secondary-fixed-dim font-bold">(Obligatorio)</strong>
            </span>
          </label>
        </section>

        {/* Main interactive submit action */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isLoading || !brand.trim() || !legalChecked}
            className="w-full py-4 bg-primary-fixed-dim text-black hover:bg-white hover:text-black font-mono text-[14px] font-bold rounded-xl active:scale-95 duration-100 transition-all neon-glow-blue flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider disabled:opacity-40"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                <span>GUARDANDO VEHÍCULO...</span>
              </>
            ) : (
              <>
                <span>REGISTRAR VEHÍCULO</span>
                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>

      </form>

      {/* Embedded Ambient Glows from SIMVA background decorations */}
      <div className="fixed top-1/3 -right-24 w-64 h-64 bg-primary-fixed-dim/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="fixed bottom-1/4 -left-24 w-48 h-48 bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none"></div>
    </div>
  );
}
