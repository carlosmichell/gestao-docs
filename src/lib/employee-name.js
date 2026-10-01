/** Normaliza nomes extraídos dos documentos para as pastas de saída. */
export function sanitizeFolderName(name) {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
