//! OCR local: abre o PDF, transforma cada página em imagem e reconhece o texto.
//! A identificação dos funcionários e a geração dos arquivos ficam no JavaScript.

use serde::Serialize;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};

#[cfg(all(test, windows))]
#[path = "ocr_tests.rs"]
mod tests;

#[derive(Clone, Serialize)]
struct OcrProgress {
    stage: &'static str,
    message: String,
    progress: u32,
}

fn emit_progress(app: &AppHandle, completed: usize, total: usize) {
    let _ = app.emit(
        "processing-progress",
        OcrProgress {
            stage: "ocr",
            message: format!("OCR: página {completed} de {total}"),
            progress: (completed * 100 / total) as u32,
        },
    );
}

/// Recebe índices a partir de zero e devolve um mapa de índice para texto.
#[tauri::command]
pub async fn ocr_pdf_pages(
    app: AppHandle,
    file_path: String,
    page_indices: Vec<u32>,
) -> Result<HashMap<u32, String>, String> {
    if page_indices.is_empty() {
        return Ok(HashMap::new());
    }

    // As chamadas do Windows esperam pela conclusão de cada etapa.
    // Executá-las em segundo plano evita bloquear o runtime assíncrono do Tauri.
    tauri::async_runtime::spawn_blocking(move || {
        emit_progress(&app, 0, page_indices.len());
        recognize_pdf_pages(&app, &file_path, &page_indices)
    })
    .await
    .map_err(|e| format!("Erro interno no OCR: {e}"))?
}

#[cfg(windows)]
fn recognize_pdf_pages(
    app: &AppHandle,
    path: &str,
    page_indices: &[u32],
) -> Result<HashMap<u32, String>, String> {
    use windows::{
        core::HSTRING, Data::Pdf::PdfDocument, Globalization::Language, Media::Ocr::OcrEngine,
        Storage::StorageFile,
    };

    let _apartment = ComApartment::initialize()?;
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path))
        .and_then(|operation| operation.get())
        .map_err(|e| format!("Não foi possível abrir o PDF no Windows: {e}"))?;
    let pdf = PdfDocument::LoadFromFileAsync(&file)
        .and_then(|operation| operation.get())
        .map_err(|e| format!("O Windows não conseguiu carregar este PDF: {e}"))?;
    let portuguese = Language::CreateLanguage(&HSTRING::from("pt-BR"))
        .map_err(|e| format!("Não foi possível preparar o idioma do OCR: {e}"))?;
    let engine = OcrEngine::TryCreateFromLanguage(&portuguese)
        .or_else(|_| OcrEngine::TryCreateFromUserProfileLanguages())
        .map_err(|_| "O OCR do Windows não está disponível. Instale o recurso de OCR em Configurações > Hora e idioma > Idioma e região > Português (Brasil) > Recursos de idioma.".to_string())?;
    let max_dimension = OcrEngine::MaxImageDimension()
        .map_err(|e| format!("Não foi possível configurar o OCR do Windows: {e}"))?;

    // Um único motor, uma página por vez: dispensa canais e divisão entre threads.
    let mut texts = HashMap::with_capacity(page_indices.len());
    for (position, &page_index) in page_indices.iter().enumerate() {
        let text = recognize_page(&pdf, &engine, page_index, max_dimension)
            .map_err(|e| format!("O OCR falhou na página {}: {e}", page_index + 1))?;
        texts.insert(page_index, text);
        emit_progress(app, position + 1, page_indices.len());
    }
    Ok(texts)
}

#[cfg(windows)]
fn recognize_page(
    pdf: &windows::Data::Pdf::PdfDocument,
    engine: &windows::Media::Ocr::OcrEngine,
    page_index: u32,
    max_dimension: u32,
) -> windows::core::Result<String> {
    use windows::{
        Data::Pdf::PdfPageRenderOptions, Graphics::Imaging::BitmapDecoder,
        Storage::Streams::InMemoryRandomAccessStream,
    };

    let page = pdf.GetPage(page_index)?;
    let size = page.Size()?;
    // Mantém a proporção, com largura desejada de 2400 px e o limite do OCR.
    let scale = (2400.0 / size.Width.max(1.0))
        .min(max_dimension as f32 / size.Width.max(1.0))
        .min(max_dimension as f32 / size.Height.max(1.0));
    let options = PdfPageRenderOptions::new()?;
    options.SetDestinationWidth((size.Width * scale).round().max(1.0) as u32)?;
    options.SetDestinationHeight((size.Height * scale).round().max(1.0) as u32)?;

    let stream = InMemoryRandomAccessStream::new()?;
    page.RenderWithOptionsToStreamAsync(&stream, &options)?
        .get()?;
    stream.Seek(0)?;
    let decoder = BitmapDecoder::CreateAsync(&stream)?.get()?;
    let bitmap = decoder.GetSoftwareBitmapAsync()?.get()?;
    let result = engine.RecognizeAsync(&bitmap)?.get()?;
    Ok(result.Text()?.to_string())
}

// COM precisa ser inicializado e liberado na mesma thread.
// Drop garante a liberação inclusive quando uma etapa retorna erro com `?`.
#[cfg(windows)]
struct ComApartment;

#[cfg(windows)]
impl ComApartment {
    fn initialize() -> Result<Self, String> {
        use windows::Win32::System::Com::{CoInitializeEx, COINIT_MULTITHREADED};
        // SAFETY: inicialização nesta thread; o guard só existe em caso de sucesso.
        unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) }
            .ok()
            .map_err(|e| format!("Não foi possível inicializar o OCR do Windows: {e}"))?;
        Ok(Self)
    }
}

#[cfg(windows)]
impl Drop for ComApartment {
    fn drop(&mut self) {
        // SAFETY: o guard é local à função, na mesma thread da inicialização.
        unsafe { windows::Win32::System::Com::CoUninitialize() };
    }
}

#[cfg(not(windows))]
fn recognize_pdf_pages(
    _app: &AppHandle,
    _path: &str,
    _page_indices: &[u32],
) -> Result<HashMap<u32, String>, String> {
    Err("O OCR nativo está disponível apenas na versão para Windows do GestãoDocs.".into())
}
