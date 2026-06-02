/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface SendToSheetParams {
  spreadsheetId: string;
  fecha: string;
  cama: string;
  peso: string;
  talla: string;
  hora: string;
  tas: number | null;
  tad: number | null;
  fc: number | null;
  temperatura: number | null;
  freq_respiratoria: string | null;
  diuresis: string | null;
  token: string;
}

/**
 * Appends a new standardized row to the Google Sheets spreadsheet using the client OAuth token
 */
export async function appendRowToGoogleSheet({
  spreadsheetId,
  fecha,
  cama,
  peso,
  talla,
  hora,
  tas,
  tad,
  fc,
  temperatura,
  freq_respiratoria,
  diuresis,
  token,
}: SendToSheetParams) {
  // We append to range 'A1' so Sheets identifies the bounds and appends after the last active row on the first sheet
  const range = "A1";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

  // Row payload matches perfect spreadsheet alignment (Confidentiality preserves columns structure by putting '-')
  const valuesPayload = [
    [
      fecha || "-",
      cama || "-",
      "-", // No patient name for compliance & confidentiality
      peso || "-",
      talla || "-",
      hora,
      tas !== null ? tas.toString() : "-",
      tad !== null ? tad.toString() : "-",
      fc !== null ? fc.toString() : "-",
      temperatura !== null ? temperatura.toString() : "-",
      freq_respiratoria || "-",
      diuresis || "-"
    ]
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: valuesPayload,
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    const message = errorJson.error?.message || `Error del servidor de Google (${response.status})`;
    throw new Error(message);
  }

  return await response.json();
}
