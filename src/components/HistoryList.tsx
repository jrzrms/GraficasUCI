/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PatientMetadata } from "../types";
import { FileSpreadsheet, Calendar, Trash2, ArrowUpRight, History } from "lucide-react";

interface SavedRecord {
  id: string;
  paciente: PatientMetadata;
  createdAt: string;
  constantesCount: number;
}

interface HistoryListProps {
  records: SavedRecord[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export default function HistoryList({ records, onSelect, onDelete, onClearAll }: HistoryListProps) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center select-none">
        <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-3">
          <History className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-slate-700 font-medium text-sm">Sin historial de gráficas</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-[200px] mx-auto">
          Las gráficas que analices se guardarán automáticamente aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 mt-2">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Historial de Gráficas</h3>
        </div>
        <button
          onClick={onClearAll}
          className="text-[11px] text-red-500 hover:text-red-600 font-medium transition-colors"
        >
          Borrar todo
        </button>
      </div>

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
        {records.map((rec) => (
          <div
            key={rec.id}
            className="group relative bg-slate-50 hover:bg-teal-50/40 border border-slate-100 hover:border-teal-100 rounded-xl p-3 transition-all duration-200 cursor-pointer"
            onClick={() => onSelect(rec.id)}
          >
            <div className="flex items-start gap-2.5 pr-6">
              <div className="p-1.5 bg-white rounded-lg text-teal-600 border border-slate-100 group-hover:bg-teal-50">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-slate-400 block font-mono">
                  Cama/Gráfica: {rec.paciente.cama || "-"}
                </span>
                <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-teal-700">
                  {rec.paciente.nombre || "Paciente Anónimo"}
                </p>
                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                  <span className="flex items-center gap-0.5">
                    <Calendar className="w-3 h-3 text-slate-300" />
                    {rec.paciente.fecha}
                  </span>
                  <span>•</span>
                  <span>{rec.constantesCount} reg.</span>
                </div>
              </div>
            </div>

            <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(rec.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-all duration-200"
                title="Eliminar del historial"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="text-slate-400 group-hover:text-teal-600 transition-colors">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
