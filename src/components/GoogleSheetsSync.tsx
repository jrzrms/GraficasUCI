/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { HourlyConstant, PatientMetadata } from "../types";
import { 
  FileSpreadsheet, 
  Send, 
  Key, 
  Info, 
  CheckCircle2, 
  ExternalLink, 
  HelpCircle, 
  Lock, 
  Clock, 
  Activity, 
  LogOut 
} from "lucide-react";
import { appendRowToGoogleSheet } from "../googleSheetsService";

interface GoogleSheetsSyncProps {
  paciente: PatientMetadata;
  constantes: HourlyConstant[];
  showToast: (msg: string) => void;
  setError: (msg: string | null) => void;
}

export default function GoogleSheetsSync({ paciente, constantes, showToast, setError }: GoogleSheetsSyncProps) {
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(
    "https://docs.google.com/spreadsheets/d/1wTwNGWvhCYyLJkVwSDRpZKo3S9sUauMRzmql-rCCl_Y/edit?usp=sharing"
  );
  const [selectedHour, setSelectedHour] = useState<number>(15); // Preselect 15:00 as seen in the image demo
  const [clientId, setClientId] = useState<string>(() => {
    return localStorage.getItem("google_sheets_client_id") || "";
  });
  const [authToken, setAuthToken] = useState<string>(() => {
    return localStorage.getItem("google_sheets_token") || "";
  });
  const [sending, setSending] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Auto detect first hour with medical constants when data changes
  useEffect(() => {
    const firstActiveHour = constantes.find(c => c.tas !== null || c.fc !== null || c.diuresis !== "-");
    if (firstActiveHour) {
      setSelectedHour(firstActiveHour.hora);
    }
  }, [constantes]);

  // Extract google auth token from redirect URL hash if present
  useEffect(() => {
    try {
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const cleanHash = hash.replace("#", "?");
        const urlParams = new URLSearchParams(cleanHash);
        const token = urlParams.get("access_token");
        if (token) {
          setAuthToken(token);
          localStorage.setItem("google_sheets_token", token);
          
          // Clear hash for UX visual purity
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
          showToast("¡Google Sheets conectado con éxito!");
        }
      }
    } catch (err) {
      console.error("No se pudo parsear el hash de OAuth", err);
    }
  }, [showToast]);

  const extractSpreadsheetId = (url: string): string | null => {
    try {
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      return match ? match[1] : url;
    } catch {
      return null;
    }
  };

  const handleConnectOAuth = () => {
    if (!clientId.trim()) {
      setError("Por favor, introduce tu ID de cliente de Google Cloud Console para iniciar sesión virtual.");
      return;
    }
    
    localStorage.setItem("google_sheets_client_id", clientId.trim());
    setError(null);

    // Google client-side OAuth endpoint redirect
    const redirectUri = window.location.origin + window.location.pathname;
    const scope = "https://www.googleapis.com/auth/spreadsheets";
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${encodeURIComponent(clientId.trim())}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scope)}`;

    showToast("Redirigiendo a Google para inicio de sesión...");
    window.location.href = authUrl;
  };

  const handleManualTokenSave = (token: string) => {
    const cleanToken = token.trim();
    setAuthToken(cleanToken);
    if (cleanToken) {
      localStorage.setItem("google_sheets_token", cleanToken);
      showToast("Token de Google guardado.");
    } else {
      localStorage.removeItem("google_sheets_token");
    }
  };

  const handleDisconnect = () => {
    setAuthToken("");
    localStorage.removeItem("google_sheets_token");
    showToast("Google Sheets desconectado.");
  };

  const handleSendToSheet = async () => {
    setError(null);
    if (!authToken) {
      setError("Por favor, conéctate a Google o introduce un Token de acceso válido en la configuración.");
      return;
    }

    const spreadsheetId = extractSpreadsheetId(spreadsheetUrl);
    if (!spreadsheetId) {
      setError("El enlace de Google Sheets proporcionado parece inválido.");
      return;
    }

    const hourData = constantes.find((c) => c.hora === selectedHour);
    if (!hourData) {
      setError("Hora seleccionada no válida.");
      return;
    }

    // Ask clinical confirmation dialog as instructed by step 2 of manual guidelines
    const confirmed = window.confirm(
      `¿Confirmas el envío de las constantes de las ${selectedHour.toString().padStart(2, "0")}:00 al documento de Google Sheets institucional?`
    );
    if (!confirmed) return;

    setSending(true);
    try {
      await appendRowToGoogleSheet({
        spreadsheetId,
        fecha: paciente.fecha,
        cama: paciente.cama,
        peso: paciente.peso,
        talla: paciente.talla,
        hora: `${selectedHour.toString().padStart(2, "0")}:00`,
        tas: hourData.tas,
        tad: hourData.tad,
        fc: hourData.fc,
        temperatura: hourData.temperatura,
        freq_respiratoria: hourData.freq_respiratoria,
        diuresis: hourData.diuresis,
        token: authToken,
      });

      showToast(`¡Constantes de las ${selectedHour.toString().padStart(2, "0")}:00 enviadas correctamente!`);
    } catch (err: any) {
      console.error(err);
      setError(
        `Fallo al escribir en Google Sheets: ${err.message}. Asegúrate de que el documento es compartido o que tu Token / ID no ha expirado.`
      );
    } finally {
      setSending(false);
    }
  };

  // Pre-fetch selected hour statistics to preview
  const selectedC = constantes.find((c) => c.hora === selectedHour) || {
    tas: null,
    tad: null,
    fc: null,
    temperatura: null,
    freq_respiratoria: "",
    diuresis: ""
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">
            Enviar a Google Sheets
          </h3>
        </div>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="text-[11px] text-teal-600 hover:text-teal-700 font-semibold flex items-center gap-1 transition-colors"
        >
          <Key className="w-3 h-3" />
          <span>{showConfig ? "Ocultar Config" : "Configurar Conexión"}</span>
        </button>
      </div>

      {/* Advanced Google Sheets Connection Panel */}
      {showConfig && (
        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-150 text-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-700 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              <span>Ajustes de Google Cloud API</span>
            </h4>
            {authToken && (
              <button
                onClick={handleDisconnect}
                className="text-[10px] text-red-500 hover:text-red-650 flex items-center gap-0.5"
              >
                <LogOut className="w-3 h-3" />
                <span>Desconectar</span>
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">
                A) Clave de Acceso (OAuth Bearer Token)
              </label>
              <input
                type="password"
                value={authToken}
                onChange={(e) => handleManualTokenSave(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono focus:outline-teal-500"
                placeholder="Inserta aquí tu Token de Google Sheets..."
              />
              <span className="text-[9px] text-slate-400 mt-0.5 block leading-tight">
                Método instantáneo. Puedes obtenerlo en Google OAuth Playground o consolas de testeo.
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200/50">
              <label className="text-[10px] font-bold text-slate-500 block mb-1 font-sans">
                B) Iniciar Sesión con Google (Client ID de GCP)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-mono focus:outline-teal-500"
                  placeholder="ID de cliente (ej. xxxx-yyyy.apps.googleusercontent.com)"
                />
                <button
                  onClick={handleConnectOAuth}
                  className="bg-slate-900 text-white hover:bg-slate-800 px-3 py-1 rounded-lg font-bold text-xs"
                >
                  Conectar
                </button>
              </div>
            </div>
          </div>

          {/* Setup Help */}
          <div className="bg-white/60 rounded-lg p-2.5 border border-slate-200/40 space-y-1 block mt-3">
            <span className="font-bold text-slate-600 block text-[10px]">¿Cómo empezar gratis?</span>
            <ol className="list-decimal pl-4 text-[10px] space-y-0.5 text-slate-500">
              <li>Crea una hoja o usa la plantilla adjunta.</li>
              <li>Saca tu Client ID gratis desde Google Cloud Console.</li>
              <li>Añade <code className="bg-slate-100 px-1 py-0.2 rounded text-[9px] font-mono">{window.location.origin}</code> como URI de redirección autorizada en tu consola de Google.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Main Google sheets properties */}
      <div className="space-y-3">
        <div>
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Enlace de Google Spreadsheet Destino
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={spreadsheetUrl}
              onChange={(e) => setSpreadsheetUrl(e.target.value)}
              className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 focus:bg-white focus:outline-teal-500 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 truncate"
              placeholder="Pega el enlace de tu Google Sheets..."
            />
            <a
              href={spreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500"
              title="Abrir hoja de cálculo"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Selection of the Hour and Live Preview Widget */}
        <div className="grid grid-cols-2 gap-3 pb-1">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Seleccionar Hora
            </label>
            <div className="relative">
              <select
                value={selectedHour}
                onChange={(e) => setSelectedHour(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-teal-500 appearance-none cursor-pointer"
              >
                {Array.from({ length: 24 }).map((_, h) => {
                  const hourObj = constantes.find((c) => c.hora === h);
                  const hasData = hourObj ? (hourObj.tas !== null || hourObj.fc !== null || hourObj.diuresis !== "-") : false;
                  return (
                    <option key={h} value={h} className="font-sans">
                      {h.toString().padStart(2, "0")}:00 {hasData ? "✓ (con datos)" : ""}
                    </option>
                  );
                })}
              </select>
              <div className="absolute right-3 top-2.5 pointer-events-none text-slate-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Registro para Google Sheet
            </label>
            <div className="bg-slate-50/70 border border-slate-150 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-600 flex items-center justify-between">
              <span>{selectedHour.toString().padStart(2, "0")}:00 h</span>
              <span className="text-[10px] text-teal-600 bg-teal-50 px-1.5 rounded-full">
                {selectedC.tas !== null || selectedC.fc !== null || selectedC.diuresis !== "-" ? "Transcribible" : "Vacía"}
              </span>
            </div>
          </div>
        </div>

        {/* Selected Hour constants value live summary box */}
        <div className="bg-gradient-to-br from-teal-50/20 to-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 text-[10px] uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-teal-600" />
            <span>Previsualización de datos a enviar:</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white rounded-lg p-1.5 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-sans">Tensión</span>
              <span className="font-mono text-xs font-bold text-slate-700">
                {selectedC.tas !== null && selectedC.tad !== null ? `${selectedC.tas}/${selectedC.tad}` : "-"}
              </span>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-sans">Freq. Card.</span>
              <span className="font-mono text-xs font-bold text-slate-700">
                {selectedC.fc !== null ? `${selectedC.fc} lpm` : "-"}
              </span>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-sans">Temp.</span>
              <span className="font-mono text-xs font-bold text-slate-700">
                {selectedC.temperatura !== null ? `${selectedC.temperatura} ºC` : "-"}
              </span>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-sans">Resp. (FR)</span>
              <span className="font-mono text-xs font-bold text-slate-700 truncate">
                {selectedC.freq_respiratoria || "-"}
              </span>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-sans">Diuresis</span>
              <span className="font-mono text-xs font-bold text-slate-700 truncate">
                {selectedC.diuresis || "-"}
              </span>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-sans">Cama</span>
              <span className="font-mono text-xs font-bold text-slate-700 truncate">
                {paciente.cama || "-"}
              </span>
            </div>
          </div>
        </div>

        {/* Submit to Sheets Button */}
        <button
          onClick={handleSendToSheet}
          disabled={sending || !authToken}
          className={`w-full font-bold text-xs py-3 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer
            ${sending 
              ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
              : !authToken
                ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.99] shadow-emerald-600/10"
            }`}
        >
          {sending ? (
            <>
              <Clock className="w-4 h-4 animate-spin" />
              <span>Sincronizando con Google...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>{authToken ? "Confirmar y Registrar en Google Sheets" : "Desconectado (Requiere Token de acceso)"}</span>
            </>
          )}
        </button>

        {!authToken && (
          <div className="text-[10px] text-amber-600 bg-amber-50/50 border border-amber-100 rounded-xl p-2.5 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="leading-normal">
              Para desbloquear el registro automático, pulsa en <strong>"Configurar Conexión"</strong> arriba a la derecha y pega tu token o conéctate con Google.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
