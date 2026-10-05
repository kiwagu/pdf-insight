import { MAX_SCANNED_PAGES } from '@pdf-insight/contracts';
import {
  AnalysisError,
  isScannedPage,
  type ExtractedDocument,
  type TextExtractor,
} from '@pdf-insight/domain';
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentLoadingTask,
  type PDFPageProxy,
} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { joinTextItems } from './page-text';

GlobalWorkerOptions.workerSrc = workerUrl;

const RENDER_SCALE = 1.5;
const JPEG_QUALITY = 0.8;

async function renderPageToJpegBase64(page: PDFPageProxy): Promise<string> {
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1] ?? '';
}

export function createPdfJsExtractor(): TextExtractor {
  return {
    async extract(file, options): Promise<ExtractedDocument> {
      let loadingTask: PDFDocumentLoadingTask | undefined;
      try {
        loadingTask = getDocument({ data: await file.arrayBuffer() });
        const pdf = await loadingTask.promise;
        const maxScanned = Math.min(options.maxScannedPages, MAX_SCANNED_PAGES);
        const pageTexts: string[] = [];
        const scannedPages: ExtractedDocument['scannedPages'] = [];
        for (let n = 1; n <= pdf.numPages; n += 1) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          const text = joinTextItems(content.items.filter((i) => 'str' in i));
          pageTexts.push(text);
          if (isScannedPage(text) && scannedPages.length < maxScanned) {
            scannedPages.push({ page: n, imageJpegBase64: await renderPageToJpegBase64(page) });
          }
        }
        return {
          fileName: file instanceof File ? file.name : 'document.pdf',
          pages: pdf.numPages,
          pageTexts,
          scannedPages,
        };
      } catch (error) {
        // Unreadable, encrypted or broken files, and page render failures, all surface as one code.
        const message = error instanceof Error ? error.message : 'Cannot read the PDF.';
        throw new AnalysisError('extraction_failed', message, false);
      } finally {
        // Releases the worker-side document; the extracted text and images are plain values.
        void loadingTask?.destroy();
      }
    },
  };
}
