// Keep these two constants in sync.
export const PDF_VIEWER_PAGE_SELECTOR = '.react-pdf__Page';
export const PDF_VIEWER_PAGE_CLASSNAME = 'react-pdf__Page z-0';

export const PDF_VIEWER_CONTENT_SELECTOR = '[data-pdf-content]';

/**
 * Size in CSS pixels reserved for page rulers (top + left gutters).
 * Used by the fields editor so rulers sit outside the document.
 */
export const PDF_VIEWER_RULER_SIZE = 24;

export const getPdfPagesCount = () => {
  const pageCountAttr = document.querySelector(PDF_VIEWER_CONTENT_SELECTOR)?.getAttribute('data-page-count');

  const totalPages = Number(pageCountAttr);

  if (!Number.isInteger(totalPages) || totalPages < 1) {
    return 0;
  }

  return totalPages;
};
