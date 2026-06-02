/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import {
  FileSpreadsheet,
  Upload,
  Camera,
  Download,
  AlertCircle,
  Clock,
  User,
  Activity,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  Plus,
  Save,
  CheckCircle,
  FileText,
  Thermometer,
  Shield,
  Trash2
} from "lucide-react";
import { HourlyConstant, PatientMetadata, ChartParseResult } from "./types";
import { exportExcel, getSampleChartData } from "./utils";
import HistoryList from "./components/HistoryList";
import UploadInstructions from "./components/UploadInstructions";
import GoogleSheetsSync from "./components/GoogleSheetsSync";

export default function App() {
  // Application primary states
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  
  // Patient details state
  const [paciente, setPaciente] = useState<PatientMetadata>({
    fecha: "",
    peso: "",
    talla: "",
    cama: "",
    nombre: ""
  });

  // Hourly clinical constants state (representing hours 0 to 23)
  const [constantes, setConstantes] = useState<HourlyConstant[]>([]);

  // Raw textual analysis returned by Gemini
  const [explanation, setExplanation] = useState<string>("");

  // Loaded image preview state
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Drag and drop border active state
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Local storage clinical history state
  const [savedRecords, setSavedRecords] = useState<any[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Initialize with hours on first mount, load from history if present
  useEffect(() => {
    // Initial blank grid
    resetToBlankGrid();

    // Load localStorage history
    loadHistory();
  }, []);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem("clinico_records_graficas");
      if (stored) {
        setSavedRecords(JSON.parse(stored));
      }
    } catch (e) {
      console.error("No se pudo cargar el historial", e);
    }
  };

  const resetToBlankGrid = () => {
    const blankHours = Array.from({ length: 24 }, (_, i) => ({
      hora: i,
      tas: null,
      tad: null,
      fc: null,
      temperatura: null,
      freq_respiratoria: "",
      diuresis: ""
    }));
    setConstantes(blankHours);
    setPaciente({
      fecha: new Date().toLocaleDateString("es-ES"),
      peso: "",
      talla: "",
      cama: "",
      nombre: ""
    });
    setExplanation("");
    setImagePreview(null);
  };

  // Convert an uploaded File to base64, then submit to express endpoint
  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Por favor, seleccione un formato de imagen válido (JPEG, PNG, WEBP).");
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingStep("Leyendo archivo de imagen...");

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const fullBase64 = reader.result as string;
        setImagePreview(fullBase64);
        
        // Extract base64 payload to send over HTTP POST
        const base64Data = fullBase64.split(",")[1];
        
        await analyzeGraphAPI(base64Data, file.type);
      } catch (err: any) {
        setError(err.message || "Fallo al procesar la imagen.");
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("No se pudo leer el archivo físico de la imagen.");
      setLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // Call express server-side Gemini processing
  const analyzeGraphAPI = async (base64Data: string, mimeType: string) => {
    try {
      setLoadingStep("Enviando a procesar a la Inteligencia Artificial (Gemini 3.5)...");
      
      const timerSteps = setTimeout(() => {
        setLoadingStep("Identificando cuadrículas de horas y curvas de constantes...");
      }, 3000);

      const timerSteps2 = setTimeout(() => {
        setLoadingStep("Transcribiendo cifras de Frecuencia Respiratoria y Diuresis...");
      }, 7000);

      const response = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Data, mimeType }),
      });

      clearTimeout(timerSteps);
      clearTimeout(timerSteps2);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Error del servidor (${response.status})`);
      }

      const result: ChartParseResult = await response.json();

      // Set state values safely
      if (result.paciente) {
        setPaciente({
          fecha: result.paciente.fecha || "",
          peso: result.paciente.peso || "",
          talla: result.paciente.talla || "",
          cama: result.paciente.cama || "",
          nombre: result.paciente.nombre || ""
        });
      }

      if (result.constantes) {
        // Ensure we parse all 24 hours
        const filledHours = Array.from({ length: 24 }, (_, h) => {
          const match = result.constantes.find((c) => c.hora === h);
          return {
            hora: h,
            tas: match && match.tas !== undefined ? match.tas : null,
            tad: match && match.tad !== undefined ? match.tad : null,
            fc: match && match.fc !== undefined ? match.fc : null,
            temperatura: match && match.temperatura !== undefined ? match.temperatura : null,
            freq_respiratoria: match && match.freq_respiratoria !== undefined ? String(match.freq_respiratoria || "") : "",
            diuresis: match && match.diuresis !== undefined ? String(match.diuresis || "") : ""
          };
        });
        setConstantes(filledHours);
      }

      if (result.rawAnalysisExplanation) {
        setExplanation(result.rawAnalysisExplanation);
      }

      showToast("¡Gráfica analizada con éxito!");
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Fallo inesperado al conectar con el motor de IA de Gemini.");
    } finally {
      setLoading(false);
    }
  };

  // Handle cell edit change
  const handleCellChange = (index: number, field: keyof HourlyConstant, value: string) => {
    const updated = [...constantes];
    if (field === "tas" || field === "tad" || field === "fc") {
      const parsed = parseInt(value, 10);
      updated[index] = {
        ...updated[index],
        [field]: isNaN(parsed) ? null : parsed
      };
    } else if (field === "temperatura") {
      // Allow decimal comma/dot entry
      const cleanValue = value.replace(",", ".");
      const parsed = parseFloat(cleanValue);
      updated[index] = {
        ...updated[index],
        [field]: isNaN(parsed) ? null : parsed
      };
    } else {
      updated[index] = {
        ...updated[index],
        [field]: value
      };
    }
    setConstantes(updated);
  };

  // Fill sample data directly to see how it looks out-of-the-box
  const loadPresetExample = () => {
    const sample = getSampleChartData();
    setPaciente(sample.paciente);
    setConstantes(sample.constantes);
    setExplanation("Ejemplo precargado idéntico a la foto que adjuntaste. Incluye las curvas de tensión arterial graficada (tas ~130/tad ~60), frecuencia cardíaca, temperaturas escritas (36.2 y 36) y los registros manuscritos inferiores de frecuencia respiratoria y diuresis para que pruebes el funcionamiento clínico.");
    setImagePreview("https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1200");
    showToast("Muestra precargada de la foto.");
  };

  // Toast confirmation trigger
  const showToast = (msg: string) => {
    setShowSuccessToast(msg);
    setTimeout(() => setShowSuccessToast(null), 4000);
  };

  // Save changes to current session history
  const saveToHistory = () => {
    try {
      const recordsCopy = [...savedRecords];
      const newRecord = {
        id: Date.now().toString(),
        paciente: { ...paciente },
        constantes: [...constantes],
        explanation,
        createdAt: new Date().toLocaleString("es-ES"),
        constantesCount: constantes.filter(c => c.tas || c.fc || c.diuresis).length
      };

      recordsCopy.unshift(newRecord);
      localStorage.setItem("clinico_records_graficas", JSON.stringify(recordsCopy));
      setSavedRecords(recordsCopy);
      showToast("Registro guardado en Historial local.");
    } catch (e) {
      setError("No se pudo guardar la sesión en la memoria persistente.");
    }
  };

  const loadSavedRecord = (id: string) => {
    const match = savedRecords.find((r) => r.id === id);
    if (match) {
      setPaciente(match.paciente);
      setConstantes(match.constantes);
      setExplanation(match.explanation || "");
      setImagePreview(null);
      showToast("Registro cargado de historial.");
    }
  };

  const deleteRecord = (id: string) => {
    const filtered = savedRecords.filter((r) => r.id !== id);
    localStorage.setItem("clinico_records_graficas", JSON.stringify(filtered));
    setSavedRecords(filtered);
    showToast("Registro eliminado.");
  };

  const clearAllHistory = () => {
    if (window.confirm("¿Seguro que deseas borrar permanentemente todo el historial?")) {
      localStorage.removeItem("clinico_records_graficas");
      setSavedRecords([]);
      showToast("Historial borrado.");
    }
  };

  // Download excel helper
  const triggerExcelDownload = () => {
    exportExcel(paciente, constantes);
  };

  // Stats calculation
  const getTotalsAndAverages = () => {
    const diuresisValues = constantes
      .map(c => parseInt(c.diuresis || "0", 10))
      .filter(v => !isNaN(v) && v > 0);
    const sumDiuresis = diuresisValues.reduce((sum, v) => sum + v, 0);

    const fcValues = constantes.filter(c => c.fc !== null) as { fc: number }[];
    const avgFC = fcValues.length > 0 ? Math.round(fcValues.reduce((sum, c) => sum + c.fc, 0) / fcValues.length) : null;

    const tempValues = constantes.filter(c => c.temperatura !== null) as { temperatura: number }[];
    const avgTemp = tempValues.length > 0 ? (tempValues.reduce((sum, c) => sum + c.temperatura, 0) / tempValues.length).toFixed(1) : null;

    const tasValues = constantes.filter(c => c.tas !== null) as { tas: number }[];
    const avgTAS = tasValues.length > 0 ? Math.round(tasValues.reduce((sum, c) => sum + c.tas, 0) / tasValues.length) : null;
    const tadValues = constantes.filter(c => c.tad !== null) as { tad: number }[];
    const avgTAD = tadValues.length > 0 ? Math.round(tadValues.reduce((sum, c) => sum + c.tad, 0) / tadValues.length) : null;

    return {
      sumDiuresis,
      avgFC,
      avgTemp,
      taRange: avgTAS && avgTAD ? `${avgTAS}/${avgTAD}` : null
    };
  };

  const stats = getTotalsAndAverages();

  // Drag and drop event handlers
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
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div id="app-root" className="min-h-screen pb-16">
      {/* Toast Notification */}
      {showSuccessToast && (
        <div id="toast" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-emerald-600 border border-emerald-500 text-white font-medium text-xs py-3 px-4 rounded-xl shadow-xl transition-all duration-300 animate-bounce">
          <CheckCircle className="w-4 h-4" />
          <span>{showSuccessToast}</span>
        </div>
      )}

      {/* Hospital Workspace Header */}
      <header id="app-header" className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-100 z-40 transition-shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-600 rounded-xl text-white shadow-md shadow-teal-600/10">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-teal-50 text-teal-700 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Estudio Clínico
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Analizador de Gráficas UCI-HSP
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-load-preset"
              onClick={loadPresetExample}
              className="px-4 py-2 hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Ver Gráfica de Ejemplo (Demo)</span>
            </button>
            <button
              id="btn-reset"
              onClick={resetToBlankGrid}
              className="px-3 py-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Limpiar datos"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace Layout */}
      <main id="app-main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* LEFT COLUMN: Controls, Uploading Actions & History */}
          <div className="lg:col-span-1 space-y-5">
            {/* Action Box: Upload / Camera Options */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-600" />
                <span>Ingesta de Imagen</span>
              </h2>

              {/* Drag and Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center min-h-[160px]
                  ${dragActive 
                    ? "border-teal-500 bg-teal-50/50 scale-[0.98]" 
                    : "border-slate-200 hover:border-teal-400 hover:bg-slate-50/50"
                  }`}
              >
                <div className="p-3 bg-teal-50 text-teal-700 rounded-2xl mb-3">
                  <Upload className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="font-semibold text-slate-700 text-xs">Cargar foto de gráfica</h3>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal max-w-[150px] mx-auto">
                  Arrastra aquí la imagen de enfermería o pulsa para explorar.
                </p>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files?.[0]) processFile(e.target.files[0]);
                  }}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* Direct Mobile Camera Button */}
              <div className="pt-2">
                <button
                  id="btn-take-photo"
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full bg-slate-900 text-white rounded-xl py-2.5 px-4 text-xs font-semibold hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-slate-900/10"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Sacar foto con el móvil</span>
                </button>
                <input
                  type="file"
                  ref={cameraInputRef}
                  onChange={(e) => {
                    if (e.target.files?.[0]) processFile(e.target.files[0]);
                  }}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
              </div>
            </div>

            {/* Micro widget: Image Preview if Loaded */}
            {imagePreview && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 block">Gráfica Ingestada</span>
                  <span className="text-[10px] text-slate-400 font-mono">Vista rápida</span>
                </div>
                <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-slate-100 bg-slate-100 select-none">
                  <img
                    src={imagePreview}
                    alt="Gráfica de enfermería"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}

            {/* Persistent local History List */}
            <HistoryList
              records={savedRecords}
              onSelect={loadSavedRecord}
              onDelete={deleteRecord}
              onClearAll={clearAllHistory}
            />

            {/* Instruction Guidance Info Card */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm text-slate-500 text-[11px] space-y-1">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold mb-2">
                <Shield className="w-3.5 h-3.5 text-teal-600" />
                <span>Seguridad Médica</span>
              </div>
              <p className="leading-normal">
                Este sistema realiza una visualización asistida para digitalizar curvas de constantes y números manuscritos.
              </p>
              <p className="leading-normal pt-1 text-slate-400">
                La decisión clínica de administración de medicamentos u otros es de exclusiva responsabilidad del profesional sanitario que valida los valores del Excel.
              </p>
            </div>
          </div>

          {/* RIGHT COLUMNS: Patient Details header, Grid clinical spreadsheet, download tools */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Loading Overlay */}
            {loading && (
              <div id="loader" className="bg-white rounded-2xl border border-teal-100 p-8 shadow-sm flex flex-col items-center justify-center text-center py-16 animate-fade-in">
                <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mb-4 animate-spin">
                  <RefreshCw className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Procesando Gráfica de Constantes...</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-2 font-medium">
                  {loadingStep}
                </p>
                <div className="w-48 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-4">
                  <div className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full w-4/5 animate-pulse rounded-full"></div>
                </div>
              </div>
            )}

            {/* Primary Error Display */}
            {error && (
              <div id="error-box" className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3 text-xs text-red-800 animate-slide-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Ha ocurrido un problema</h4>
                  <p className="mt-1 leading-normal">{error}</p>
                </div>
              </div>
            )}

            {/* Dashboard Workspace */}
            {!loading && (
              <div className="space-y-6">
                
                {/* Visual Clinical Aggregates / Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Diuresis Absoluta</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-slate-800 font-mono">
                        {stats.sumDiuresis}
                      </span>
                      <span className="text-xs text-slate-400">ml/24h</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">F.C. Promedio</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-slate-800 font-mono">
                        {stats.avgFC || "-"}
                      </span>
                      <span className="text-xs text-slate-400">lpm</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider">Temperatura Med.</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-slate-800 font-mono">
                        {stats.avgTemp || "-"}
                      </span>
                      <span className="text-xs text-slate-400">ºC</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wider font-sans">T.A. Promedio Med.</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-2xl font-bold text-slate-800 font-mono">
                        {stats.taRange || "-/-"}
                      </span>
                      <span className="text-xs text-slate-400">mmHg</span>
                    </div>
                  </div>
                </div>

                {/* Patient Metadata Card (Fully Editable) */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <User className="w-4 h-4 text-teal-600" />
                      <span>Datos de Gráfica Identificada</span>
                    </h3>
                    <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">Editable</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cama/Gráfica #</label>
                      <input
                        type="text"
                        value={paciente.cama}
                        onChange={(e) => setPaciente({ ...paciente, cama: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-teal-500 transition-colors"
                        placeholder="Nº de cama/hoja"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha Registro</label>
                      <input
                        type="text"
                        value={paciente.fecha}
                        onChange={(e) => setPaciente({ ...paciente, fecha: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-teal-500 transition-colors"
                        placeholder="Fecha"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Peso (Kg)</label>
                      <input
                        type="text"
                        value={paciente.peso}
                        onChange={(e) => setPaciente({ ...paciente, peso: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-teal-500 transition-colors"
                        placeholder="Peso"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Talla (cm)</label>
                      <input
                        type="text"
                        value={paciente.talla}
                        onChange={(e) => setPaciente({ ...paciente, talla: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-150 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:bg-white focus:outline-teal-500 transition-colors"
                        placeholder="Talla"
                      />
                    </div>
                  </div>
                </div>

                {/* Google Sheets Synchronization Module */}
                <GoogleSheetsSync
                  paciente={paciente}
                  constantes={constantes}
                  showToast={showToast}
                  setError={setError}
                />

                {/* Primary Interactive Spreadsheet Sheet */}
                <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-50 gap-4">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                        <Activity className="w-4 h-4 text-teal-600" />
                        <span>Tabla de Constantes en 24 Horas</span>
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                        Haz clic en cualquier celda para corregir o rellenar valores manuscritos individualmente.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        id="btn-save-session"
                        onClick={saveToHistory}
                        className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Persistir en navegador"
                      >
                        <Save className="w-3.5 h-3.5 text-slate-500" />
                        <span>Guardar Copia</span>
                      </button>

                      <button
                        id="btn-download-excel"
                        onClick={triggerExcelDownload}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-600/15 transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exportar a Excel (.xlsx)</span>
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Scrolling Spreadsheet Table wrapping */}
                  <div className="overflow-x-auto border border-slate-100 rounded-2xl custom-scrollbar scroll-smooth">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest block-table-head">
                          <th className="py-3 px-4 text-center border-r border-slate-100 min-w-[70px]">Hora</th>
                          <th className="py-3 px-4 text-teal-700 font-bold border-r border-slate-100 min-w-[95px]">TAS (Sist.)</th>
                          <th className="py-3 px-4 text-teal-700 font-bold border-r border-slate-100 min-w-[95px]">TAD (Diast.)</th>
                          <th className="py-3 px-4 text-red-600 font-bold border-r border-slate-100 min-w-[95px]">FC (Pulso)</th>
                          <th className="py-3 px-4 text-orange-600 font-bold border-r border-slate-100 min-w-[95px]">Temp (ºC)</th>
                          <th className="py-3 px-4 text-indigo-700 font-bold border-r border-slate-100 min-w-[110px]">FR (Resp.)</th>
                          <th className="py-3 px-4 text-violet-700 font-bold min-w-[110px]">Diuresis (ml)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {constantes.map((c, idx) => (
                          <tr
                            key={c.hora}
                            className={`text-xs hover:bg-slate-50/50 transition-colors border-b border-slate-100
                              ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`}
                          >
                            {/* Hour Indicator cell */}
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-500 text-center border-r border-slate-100 bg-slate-50/30">
                              {c.hora.toString().padStart(2, "0")}:00
                            </td>

                            {/* TAS */}
                            <td className="py-1 px-3 border-r border-slate-100">
                              <input
                                type="number"
                                value={c.tas !== null ? c.tas : ""}
                                onChange={(e) => handleCellChange(idx, "tas", e.target.value)}
                                className="w-full bg-transparent border-0 font-mono font-semibold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-teal-500 rounded px-1 py-1"
                                placeholder="-"
                              />
                            </td>

                            {/* TAD */}
                            <td className="py-1 px-3 border-r border-slate-100">
                              <input
                                type="number"
                                value={c.tad !== null ? c.tad : ""}
                                onChange={(e) => handleCellChange(idx, "tad", e.target.value)}
                                className="w-full bg-transparent border-0 font-mono font-semibold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-teal-500 rounded px-1 py-1"
                                placeholder="-"
                              />
                            </td>

                            {/* FC */}
                            <td className="py-1 px-3 border-r border-slate-100">
                              <input
                                type="number"
                                value={c.fc !== null ? c.fc : ""}
                                onChange={(e) => handleCellChange(idx, "fc", e.target.value)}
                                className="w-full bg-transparent border-0 font-mono font-semibold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-red-500 rounded px-1 py-1"
                                placeholder="-"
                              />
                            </td>

                            {/* Temperatura */}
                            <td className="py-1 px-3 border-r border-slate-100 bg-orange-50/5">
                              <input
                                type="text"
                                value={c.temperatura !== null ? c.temperatura : ""}
                                onChange={(e) => handleCellChange(idx, "temperatura", e.target.value)}
                                className="w-full bg-transparent border-0 font-mono font-semibold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-orange-500 rounded px-1 py-1"
                                placeholder="-"
                              />
                            </td>

                            {/* Freq Respiratoria (text allowed for strings like '15/AC') */}
                            <td className="py-1 px-3 border-r border-slate-100">
                              <input
                                type="text"
                                value={c.freq_respiratoria || ""}
                                onChange={(e) => handleCellChange(idx, "freq_respiratoria", e.target.value)}
                                className="w-full bg-transparent border-0 font-mono font-semibold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1 py-1"
                                placeholder="-"
                              />
                            </td>

                            {/* Diuresis */}
                            <td className="py-1 px-3">
                              <input
                                type="text"
                                value={c.diuresis || ""}
                                onChange={(e) => handleCellChange(idx, "diuresis", e.target.value)}
                                className="w-full bg-transparent border-0 font-mono font-semibold text-slate-800 text-center focus:bg-white focus:ring-1 focus:ring-violet-500 rounded px-1 py-1"
                                placeholder="-"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Gemini Extraction Explanation Report */}
                {explanation && (
                  <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-slate-800 text-sm">Reporte de Análisis IA</h3>
                    </div>
                    <p className="text-slate-600 leading-relaxed text-xs whitespace-pre-line bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                      {explanation}
                    </p>
                  </div>
                )}

                {/* Patient Instructions Banner */}
                <UploadInstructions />

              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
