import { AnalysisError, type TextExtractor } from '@pdf-insight/domain';

/**
 * The pdf.js extractor, loaded on first use: pdf.js is most of the app's JavaScript, so the page
 * paints without it and the module is fetched when the first file is read. A failed fetch (a
 * dropped connection, or a redeploy that replaced the chunk) is a retryable network error.
 */
export function createPdfJsExtractor(): TextExtractor {
  let impl: Promise<TextExtractor> | undefined;
  const load = () => {
    impl ??= import('./pdfjs-impl').then(
      (mod) => mod.createPdfJsImpl(),
      () => {
        impl = undefined;
        throw new AnalysisError('network', 'Could not load the PDF reader.', true);
      },
    );
    return impl;
  };
  return {
    extract: async (file, options) => (await load()).extract(file, options),
  };
}
