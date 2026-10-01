/**
 * file-io.js
 *
 * File read/write and shell utilities using Tauri plugins.
 */
import { readFile, writeFile } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';

/**
 * Reads a file from disk as a Uint8Array.
 * @param {string} path - Absolute path to the file.
 * @returns {Promise<Uint8Array>} Raw file bytes.
 */
export async function readBinaryFile(path) {
  return readFile(path);
}

/**
 * Writes raw bytes to a file on disk.
 * @param {string} path - Absolute path where to save the file.
 * @param {Uint8Array} bytes - Raw file contents.
 * @returns {Promise<void>}
 */
export async function writeBinaryFile(path, bytes) {
  await writeFile(path, bytes);
}

/**
 * Reads a text file from disk.
 * @param {string} path - Absolute path to the file.
 * @returns {Promise<string>} File contents as a string.
 */
export async function readTextFile(path) {
  const bytes = await readFile(path);
  return new TextDecoder('utf-8').decode(bytes);
}

/**
 * Mostra o arquivo exportado no explorador de arquivos.
 * @param {string} path - Absolute path to open.
 * @returns {Promise<void>}
 */
export async function revealFile(path) {
  await revealItemInDir(path);
}
