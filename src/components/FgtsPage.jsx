import React, { useState, useCallback, useEffect } from 'react';
import { selectTxtFile, onFileDrop } from '../lib/tauri-api';
import { readTextFile } from '../lib/file-io';
import { parseFgtsTxt, generateFgtsPdf } from '../lib/process-fgts';

export default function FgtsPage({ onResults }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState(null);
  const [error, setError] = useState(null);

  const accent = '#367fb9';

  useEffect(() => {
    let unlistenDrop;

    (async () => {
      unlistenDrop = await onFileDrop(async (paths) => {
        const txtPath = paths.find((p) => p.toLowerCase().endsWith('.txt'));
        if (txtPath) {
          const fileName = txtPath.split(/[\\/]/).pop();
          setFile(fileName);
          setDragOver(false);
          setError(null);
          await runProcess(txtPath);
        } else {
          setDragOver(false);
          setError('Por favor, arraste um arquivo TXT de extrato analítico FGTS.');
        }
      });
    })();

    return () => {
      unlistenDrop?.();
    };
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e) => { e.preventDefault(); setDragOver(false); }, []);
  const handleDrop = useCallback((e) => { e.preventDefault(); setDragOver(false); }, []);

  const handleClick = async () => {
    if (processing) return;
    try {
      const filePath = await selectTxtFile();
      if (!filePath) return;
      const fileName = filePath.split(/[\\/]/).pop();
      setFile(fileName);
      setError(null);
      await runProcess(filePath);
    } catch (err) {
      setError(`Erro inesperado: ${err.message ?? err}`);
    }
  };

  const runProcess = async (filePath) => {
    setProcessing(true);
    setProgressInfo(null);
    setError(null);
    const start = performance.now();
    try {
      setProgressInfo({ stage: 'reading', message: 'Lendo arquivo TXT...', progress: 5 });
      const content = await readTextFile(filePath);

      setProgressInfo({ stage: 'parsing', message: 'Analisando conteúdo do extrato...', progress: 15 });
      const fgtsEmployees = parseFgtsTxt(content);

      if (fgtsEmployees.length === 0) {
        throw new Error('Nenhum funcionário encontrado no arquivo TXT. Verifique se o formato é de Extrato Analítico FGTS da Caixa.');
      }

      const total = fgtsEmployees.length;
      setProgressInfo({
        stage: 'generating',
        message: `Gerando PDFs para ${total} funcionários...`,
        progress: 20,
        processedCount: 0,
        totalCount: total,
      });
      const employees = [];
      for (let idx = 0; idx < fgtsEmployees.length; idx++) {
        const emp = fgtsEmployees[idx];
        const progress = 20 + ((idx * 70) / total);

        setProgressInfo({
          stage: 'generating',
          message: `Gerando PDF: ${emp.name}...`,
          progress: Math.round(progress),
          currentEmployee: emp.name,
          processedCount: idx,
          totalCount: total,
        });

        const pdfBytes = generateFgtsPdf(emp.lines);

        employees.push({
          index: idx + 1,
          name: emp.name,
          pageCount: Math.ceil(emp.lines.length / 40),
          pdfBytes: pdfBytes,
        });
      }

      const processingTimeMs = Math.round(performance.now() - start);

      setProgressInfo({
        stage: 'done',
        message: `Processados ${total} funcionários.`,
        progress: 100,
        processedCount: total,
        totalCount: total,
      });

      onResults({
        totalEmployees: total,
        employees,
        totalPages: total,
        processingTimeMs,
        documentType: 'FGTS',
      });
    } catch (err) {
      setError(`Erro inesperado: ${err.message ?? err}`);
    } finally {
      setProcessing(false);
      setProgressInfo(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background font-sans no-drag">

      <main className="processing-workspace flex-1 flex flex-col items-center justify-center px-10 pb-10 gap-6 animate-fade-in-up">
        <p className="text-text-muted text-sm max-w-md text-center">
          Importe o arquivo TXT do Extrato Analítico FGTS da Caixa Econômica Federal. O sistema separa cada funcionário e gera um PDF individual formatado.
        </p>

        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="upload-zone relative w-full max-w-2xl cursor-pointer select-none"
          style={{ minHeight: '340px' }}
        >
          <div
            className="absolute inset-0 rounded-3xl transition-all duration-300"
            style={{
              border: `2.5px dashed ${dragOver ? accent : '#e2e8f0'}`,
              background: dragOver ? `color-mix(in srgb, ${accent} 6%, transparent)` : '#ffffff',
              boxShadow: dragOver ? `0 0 0 6px color-mix(in srgb, ${accent} 12%, transparent)` : '0 1px 3px rgba(0,0,0,0.06)',
            }}
          />
          <div className="relative z-10 flex flex-col items-center justify-center h-full gap-5 py-16 px-8">
            {processing ? (
              <>
                <div className="w-5 h-5 shrink-0 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${accent} transparent ${accent} ${accent}` }} />
                <p className="text-text-muted font-medium">{progressInfo?.message ?? 'Processando…'}</p>
                {progressInfo?.progress != null && (
                  <div className="w-full max-w-xs">
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressInfo.progress}%`, background: accent }} />
                    </div>
                    {progressInfo.processedCount != null && (
                      <p className="text-xs text-[#94a3b8] mt-1 text-center">{progressInfo.processedCount} / {progressInfo.totalCount}</p>
                    )}
                  </div>
                )}
              </>
            ) : file && !error ? (
              <>
                <p className="text-text font-semibold text-lg">{file}</p>
                <p className="text-[#94a3b8] text-sm">Arquivo selecionado — clique para processar outro</p>
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-text font-semibold text-xl">{dragOver ? 'Solte o arquivo aqui' : 'Arraste o TXT para esta área'}</p>
                  <p className="text-[#94a3b8] text-sm mt-1">ou <span className="underline underline-offset-2" style={{ color: accent }}>clique para selecionar do computador</span></p>
                </div>
                <div className="mt-2 px-4 py-1.5 rounded-full bg-surface-hover text-[#94a3b8] text-xs font-medium">Apenas arquivos .txt (Extrato Analítico FGTS)</div>
              </>
            )}
          </div>
        </div>

        {error && (
          <div className="max-w-2xl w-full bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm animate-fade-in">
            {error}
          </div>
        )}
      </main>
    </div>
  );
}
