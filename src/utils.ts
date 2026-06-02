/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";
import { HourlyConstant, PatientMetadata } from "./types";

/**
 * Downloads clinical constants to a beautifully structured Excel (.xlsx) file
 */
export function exportExcel(paciente: PatientMetadata, constantes: HourlyConstant[]) {
  const wb = XLSX.utils.book_new();

  // Excel title and patient headers
  const sheetData = [
    ["REGISTRO CLÍNICO - CONSTANTES EXTRAÍDAS DE GRÁFICA DE ENFERMERÍA"],
    [],
    [
      "Fecha:",
      paciente.fecha || "-",
      "Cama u Hoja #:",
      paciente.cama || "-",
      "Peso registrado:",
      paciente.peso || "-",
      "Talla registrada:",
      paciente.talla || "-",
      "Nombre del Paciente:",
      paciente.nombre || "No especificado"
    ],
    [],
    ["Hora (h)", "TAS (mmHg)", "TAD (mmHg)", "FC (lpm)", "Temperatura (ºC)", "FR (rpm)", "Diuresis (ml)"]
  ];

  // Append hourly rows
  constantes.forEach((c) => {
    sheetData.push([
      `${c.hora.toString().padStart(2, "0")}:00`,
      c.tas !== null ? c.tas.toString() : "-",
      c.tad !== null ? c.tad.toString() : "-",
      c.fc !== null ? c.fc.toString() : "-",
      c.temperatura !== null ? c.temperatura.toString() : "-",
      c.freq_respiratoria !== null ? c.freq_respiratoria : "-",
      c.diuresis !== null ? c.diuresis : "-"
    ]);
  });

  // Calculate high-value clinical summaries
  const diuresisValues = constantes
    .map((c) => parseInt(c.diuresis || "0", 10))
    .filter((v) => !isNaN(v) && v > 0);
  const totalDiuresis = diuresisValues.reduce((sum, val) => sum + val, 0);

  const validTemps = constantes.filter((c) => c.temperatura !== null) as { temperatura: number }[];
  const avgTemp = validTemps.length > 0
    ? (validTemps.reduce((sum, c) => sum + c.temperatura, 0) / validTemps.length).toFixed(1)
    : "-";

  const validFC = constantes.filter((c) => c.fc !== null) as { fc: number }[];
  const avgFC = validFC.length > 0
    ? Math.round(validFC.reduce((sum, c) => sum + c.fc, 0) / validFC.length).toString()
    : "-";

  const validTAS = constantes.filter((c) => c.tas !== null) as { tas: number }[];
  const avgTAS = validTAS.length > 0
    ? Math.round(validTAS.reduce((sum, c) => sum + c.tas, 0) / validTAS.length).toString()
    : "-";

  const validTAD = constantes.filter((c) => c.tad !== null) as { tad: number }[];
  const avgTAD = validTAD.length > 0
    ? Math.round(validTAD.reduce((sum, c) => sum + c.tad, 0) / validTAD.length).toString()
    : "-";

  sheetData.push([]);
  sheetData.push(["RESUMEN CLÍNICO AUTOMÁTICO"]);
  sheetData.push(["Diuresis total (ml):", `${totalDiuresis} ml`, "Nº de tomas registradas:", diuresisValues.length.toString()]);
  sheetData.push(["Frecuencia Cardíaca promedio:", `${avgFC} lpm`, "Temperatura promedio:", `${avgTemp} ºC`]);
  sheetData.push(["Tensión Arterial Promedio:", `${avgTAS}/${avgTAD} mmHg`]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set explicit column widths for perfect spreadsheet visual layout
  ws["!cols"] = [
    { wch: 10 }, // Hora
    { wch: 15 }, // TAS
    { wch: 15 }, // TAD
    { wch: 15 }, // FC
    { wch: 18 }, // Temperatura
    { wch: 15 }, // FR
    { wch: 15 }  // Diuresis
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Constantes Clínicas");

  const fileName = `Grafica_Enfermeria_Cama_${paciente.cama || "N"}_${(paciente.fecha || "hoy").replace(/[/\\?%*:|"<>]/g, "-")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Creates sample data that imitates the hospital chart provided in the snapshot
 * in order to give a beautiful out-of-the-box preview and template.
 */
export function getSampleChartData(): { paciente: PatientMetadata; constantes: HourlyConstant[] } {
  const paciente: PatientMetadata = {
    fecha: "16/05/26",
    peso: "92 Kg",
    talla: "172 cm",
    cama: "4",
    nombre: "Paciente Ejemplo (De foto de gráfica)"
  };

  const constantes: HourlyConstant[] = Array.from({ length: 24 }, (_, i) => {
    // Fill specific hours in matches with the uploaded handwritten list
    let tas: number | null = null;
    let tad: number | null = null;
    let fc: number | null = null;
    let temperatura: number | null = null;
    let freq_respiratoria: string | null = null;
    let diuresis: string | null = null;

    // Simulate SBP (TAS) and DBP (TAD) from the curves in the picture
    if (i === 0) { tas = 130; tad = 60; fc = 80; temperatura = 36.5; }
    else if (i === 4) { tas = 125; tad = 55; fc = 84; temperatura = 36.4; }
    else if (i === 8) { tas = 135; tad = 60; fc = 78; temperatura = 36.8; }
    else if (i === 12) { tas = 130; tad = 58; fc = 82; temperatura = 36.2; }
    else if (i === 15) { tas = 120; tad = 62; fc = 80; temperatura = 36.2; } // Hand annotated 36'2
    else if (i === 16) { tas = 125; tad = 60; fc = 85; temperatura = 36.3; }
    else if (i === 20) { tas = 130; tad = 64; fc = 80; temperatura = 36.0; } // Hand annotated 36
    else if (i === 23) { tas = 125; tad = 58; fc = 88; temperatura = 36.5; }

    // Frecuencia Respiratoria row from standard values:
    // 0: 9, 1: 10, 2: 15/AC, 3: AC, 4: AC, 5: AC, 6: AC, ...
    if (i === 0) freq_respiratoria = "9";
    else if (i === 1) freq_respiratoria = "10";
    else if (i === 2) freq_respiratoria = "15/AC";
    else if (i === 8) freq_respiratoria = "15/AC";
    else if (i === 15) freq_respiratoria = "15/AC";
    else if (i === 20) freq_respiratoria = "16";
    else if (i === 21) freq_respiratoria = "17";
    else if ([3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 22, 23].includes(i)) {
      freq_respiratoria = "AC";
    }

    // Diuresis values:
    // 0: 10, 5: 5, 6: 5, 7: 5, 8: 5, 10: 10, 15: 5, 17: 15, 18: 15, 19: 5, 20: 10, 21: 5
    if (i === 0) diuresis = "10";
    else if (i >= 5 && i <= 8) diuresis = "5";
    else if (i === 10) diuresis = "10";
    else if (i === 15) diuresis = "5";
    else if (i === 17 || i === 18) diuresis = "15";
    else if (i === 19) diuresis = "5";
    else if (i === 20) diuresis = "10";
    else if (i === 21) diuresis = "5";
    else {
      diuresis = "-";
    }

    return {
      hora: i,
      tas,
      tad,
      fc,
      temperatura,
      freq_respiratoria,
      diuresis
    };
  });

  return { paciente, constantes };
}
