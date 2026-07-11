/**
 * Triggers a browser download for a Blob returned by one of the backend
 * report PDF endpoints (e.g. GET /api/reports/sales-summary/pdf). PDFs are
 * generated server-side with QuestPDF — this just saves the bytes the API
 * already sent back.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}
