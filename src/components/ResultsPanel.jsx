import React, { useState } from 'react';
import { selectSaveLocation, revealFile } from '../lib/tauri-api';
import { writeBinaryFile } from '../lib/file-io';
import { generateZip, generateCombinedZip } from '../lib/zip-utils';

export default function ResultsPanel({ results, onReset }) {
  const [zipStatus, setZipStatus] = useState(null);
  const [zipError, setZipError] = useState('');
  const [zipPath, setZipPath] = useState('');

  if (!results) return null;

  const handleGenerateZip = async () => {
    try {
      setZipStatus('generating');
      setZipError('');

      const defaultName = `Documentos_${results.documentType}_${new Date().toISOString().split('T')[0]}.zip`;
      const savePath = await selectSaveLocation(defaultName);
      if (!savePath) {
        setZipStatus(null);
        return;
      }
      let zipBytes;
      if (results.documentType === 'COMBINADO') {
        zipBytes = generateCombinedZip(results.employees);
      } else {
        zipBytes = generateZip(results.employees, results.documentType);
      }
      await writeBinaryFile(savePath, zipBytes);

      setZipStatus('success');
      setZipPath(savePath);
    } catch (error) {
      setZipStatus('error');
      setZipError(error?.message ?? String(error));
      console.error('Error generating ZIP:', error);
    }
  };

  const handleOpenFolder = async () => {
    if (!zipPath) return;
    try {
      setZipError('');
      await revealFile(zipPath);
    } catch (error) {
      setZipError(`Não foi possível abrir a pasta: ${error?.message ?? error}`);
    }
  };

  return (
    <div className="results-panel w-full bg-white border border-border rounded-2xl mb-12 p-6 shadow-sm flex flex-col h-100">
      <div className="mb-4">
        <h3 className="text-xl font-bold text-text flex items-center gap-2">
          Processamento concluído
        </h3>
        <p className="mt-1 text-sm text-text-muted">
          {results.totalEmployees} {results.totalEmployees === 1 ? 'funcionário processado' : 'funcionários processados'} em{' '}
          {(results.processingTimeMs / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto mb-6 pr-2 custom-scrollbar border border-border rounded-xl bg-background p-2">
        {results.employees.map((emp) => (
          <div key={emp.index} className="flex items-center justify-between p-3 border-b border-border last:border-0 transition-colors rounded-lg">
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-right text-xs text-text-muted tabular-nums">
                {emp.index}
              </span>
              <div>
                <p className="text-text font-medium select-text">{emp.name}</p>
                <p className="text-xs text-text-muted">
                  {results.documentType === 'COMBINADO' ? (
                    <>
                      {emp.trctBytes ? 'TRCT' : ''}
                      {emp.trctBytes && emp.seguroBytes ? ' + ' : ''}
                      {emp.seguroBytes ? 'Seguro' : ''}
                    </>
                  ) : (
                    <>{emp.pageCount} {emp.pageCount === 1 ? 'página' : 'páginas'}</>
                  )}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="results-actions flex flex-wrap items-center gap-3">
        {zipStatus === null && (
          <button
            onClick={handleGenerateZip}
            className="bg-primary hover:bg-primary-hover border border-transparent text-white text-sm font-medium py-2 px-4 rounded-xl transition-colors inline-flex items-center justify-center cursor-pointer"
          >
            Exportar como ZIP
          </button>
        )}

        {zipStatus === 'generating' && (
          <button disabled className="bg-surface-hover text-text-muted text-sm font-medium py-2 px-4 rounded-xl inline-flex items-center justify-center gap-2 cursor-wait border border-border">
            <div className="w-5 h-5 border-2 border-[#cbd5e1] border-t-transparent rounded-full animate-spin"></div>
            Gerando ZIP...
          </button>
        )}

        {zipStatus === 'success' && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenFolder}
              className="bg-surface-hover hover:bg-border text-text text-sm font-medium py-2 px-4 rounded-xl transition-colors inline-flex items-center justify-center border border-border"
            >
              Abrir Pasta do ZIP
            </button>
            <button
              onClick={onReset}
              className="bg-primary hover:bg-primary-hover text-white text-sm font-medium py-2 px-4 rounded-xl transition-colors"
            >
              Concluir
            </button>
          </div>
        )}

        {zipStatus === 'success' && zipError && (
          <p className="basis-full text-red-600 text-sm" role="alert">{zipError}</p>
        )}

        {zipStatus === 'error' && (
          <div className="w-full flex gap-2 items-center">
            <div className="flex-1 text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-200">
              Erro ao gerar ZIP{zipError ? `: ${zipError}` : '.'}
            </div>
            <button onClick={() => { setZipStatus(null); setZipError(''); }} className="bg-surface-hover hover:bg-border text-text px-4 py-3 rounded-xl border border-border">
              Tentar Novamente
            </button>
          </div>
        )}

        {zipStatus === null && (
          <button
            onClick={onReset}
            className="bg-white hover:bg-surface-hover border border-border cursor-pointer text-text font-medium py-2 px-4 rounded-xl transition-colors text-sm"
          >
            Nova operação
          </button>
        )}
      </div>
    </div>
  );
}
