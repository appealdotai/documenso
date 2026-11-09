import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type RenderPdfThumbnailsOptions = {
  url?: string;
  data?: Uint8Array;
  scale?: number;
};

export const renderPdfThumbnails = async ({ url, data, scale = 0.35 }: RenderPdfThumbnailsOptions) => {
  const pdf = await pdfjsLib.getDocument({
    url,
    data,
    cMapUrl: '/static/cmaps/',
  }).promise;

  const pageCount = pdf.numPages;
  const pageIndices = Array.from({ length: pageCount }, (_, index) => index);

  try {
    const thumbnails = await pMap(
      pageIndices,
      async (pageIndex) => {
        const page = await pdf.getPage(pageIndex + 1);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Failed to get canvas context');
        }

        await page.render({
          canvasContext: context,
          viewport,
          canvas,
        }).promise;

        return canvas.toDataURL('image/jpeg', 0.7);
      },
      { concurrency: 4 },
    );

    return {
      pageCount,
      thumbnails,
    };
  } finally {
    await pdf.destroy();
  }
};
