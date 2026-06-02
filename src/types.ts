/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HourlyConstant {
  hora: number; // 0 to 23
  tas: number | null; // Tensión Arterial Sistólica (mmHg)
  tad: number | null; // Tensión Arterial Diastólica (mmHg)
  fc: number | null; // Frecuencia Cardíaca (lpm)
  temperatura: number | null; // Temperatura (ºC)
  freq_respiratoria: string | null; // Frecuencia respiratoria (p.ej. "9", "AC", "15/AC")
  diuresis: string | null; // Diuresis (p.ej. "10", "-", "5")
}

export interface PatientMetadata {
  fecha: string;
  peso: string;
  talla: string;
  cama: string;
  nombre?: string;
}

export interface ChartParseResult {
  paciente: PatientMetadata;
  constantes: HourlyConstant[];
  rawAnalysisExplanation: string; // Brief summary of what was found
}
