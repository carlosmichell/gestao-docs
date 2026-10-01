use super::*;
use windows::{core::HSTRING, Data::Pdf::PdfDocument, Media::Ocr::OcrEngine, Storage::StorageFile};

// Teste nativo opt-in: depende de um pacote de idioma OCR instalado no Windows.
#[test]
#[ignore = "requer OCR do Windows; execute cargo test -- --ignored"]
fn recognizes_requested_pages_and_rejects_invalid_index() {
    let _apartment = ComApartment::initialize().unwrap();
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../tests/fixtures/ocr.pdf")
        .canonicalize()
        .unwrap();
    // WinRT recebe o caminho comum; canonicalize adiciona o prefixo Win32 estendido.
    let path = path.to_str().unwrap().trim_start_matches(r"\\?\");
    let file = StorageFile::GetFileFromPathAsync(&HSTRING::from(path))
        .unwrap()
        .get()
        .unwrap();
    let pdf = PdfDocument::LoadFromFileAsync(&file)
        .unwrap()
        .get()
        .unwrap();
    let engine = OcrEngine::TryCreateFromUserProfileLanguages().unwrap();
    let max = OcrEngine::MaxImageDimension().unwrap();

    // Ordem inversa para verificar que o índice determina a página lida.
    assert!(recognize_page(&pdf, &engine, 1, max)
        .unwrap()
        .contains("BETA"));
    assert!(recognize_page(&pdf, &engine, 0, max)
        .unwrap()
        .contains("ALPHA"));
    assert!(recognize_page(&pdf, &engine, 2, max).is_err());
}
