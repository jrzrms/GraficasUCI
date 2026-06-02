/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Camera, Eye, HelpCircle, FileText, CheckCircle2 } from "lucide-react";

export default function UploadInstructions() {
  return (
    <div className="bg-gradient-to-br from-indigo-50/70 to-teal-50/40 rounded-2xl border border-indigo-100/50 p-5 mt-4 text-xs text-slate-600">
      <div className="flex items-center gap-2 mb-3 text-indigo-950 font-semibold text-sm">
        <HelpCircle className="w-4 h-4 text-indigo-600" />
        <span>Instrucciones para un análisis óptimo</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/80 rounded-xl p-3 border border-indigo-100/30 flex gap-2.5">
          <div className="p-1 h-fit bg-indigo-50 text-indigo-700 rounded-lg">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-indigo-950 mb-0.5">Captura nítida</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Toma la foto de frente, evitando sombras, pliegues o inclinación excesiva en el papel.
            </p>
          </div>
        </div>

        <div className="bg-white/80 rounded-xl p-3 border border-indigo-100/30 flex gap-2.5">
          <div className="p-1 h-fit bg-emerald-50 text-emerald-700 rounded-lg">
            <Eye className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-emerald-950 mb-0.5">Visibilidad de curvas</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Asegúrate de que las curvas de presión arterial (TAS/TAD), frecuencia cardíaca (FC) y temperatura estén visibles.
            </p>
          </div>
        </div>

        <div className="bg-white/80 rounded-xl p-3 border border-indigo-100/30 flex gap-2.5">
          <div className="p-1 h-fit bg-teal-50 text-teal-700 rounded-lg">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-semibold text-teal-950 mb-0.5">Filas numéricas legibles</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Los números escritos a mano de <strong>Frecuencia Respiratoria</strong> y <strong>Diuresis</strong> deben ser claros.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-indigo-100/40 flex items-center gap-2 text-[11px] text-slate-500">
        <span className="inline-block p-1 bg-teal-50 text-teal-600 rounded-full">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </span>
        <span>
          <strong>Corrección interactiva:</strong> Tras el análisis automático, podrás editar manualmente cualquier celda antes de exportar a Excel.
        </span>
      </div>
    </div>
  );
}
