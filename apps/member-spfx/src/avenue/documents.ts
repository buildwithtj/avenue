// Member document uploads (CMP-01). The member sends the file to their own submission item; a flow copies it into
// the private AvenueDocumentFiles library and registers it for staff to verify.
//
// [PROPOSED] engineering limits, not client rules: PDF/JPEG/PNG only and 10 MB per file. Both keep uploads safe to
// open and well under SharePoint's attachment limits; change them here if Flavors needs other formats.

import { DOC_TYPES, type DocType } from './contracts';

export const ALLOWED_EXTENSIONS: string[] = ['pdf', 'jpg', 'jpeg', 'png'];
export const MAX_FILE_BYTES: number = 10 * 1024 * 1024;

export interface IDocumentInput {
  facilityId: string;
  docType: DocType | undefined;
  /** YYYY-MM-DD, as entered */
  issueDate: string;
  expiryDate: string;
  file: { name: string; size: number } | undefined;
  /** Staff only: the member this document is for. The flow refuses it unless the author is staff. */
  onBehalfOf?: string;
}

const YMD: RegExp = /^\d{4}-\d{2}-\d{2}$/;

function validDate(ymd: string): boolean {
  return YMD.test(ymd) && !isNaN(Date.parse(`${ymd}T12:00:00Z`)) && new Date(`${ymd}T12:00:00Z`).toISOString().slice(0, 10) === ymd;
}

export function extensionOf(name: string): string {
  const dot: number = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function validateDocument(input: IDocumentInput): string[] {
  const errors: string[] = [];
  if (!input.docType || DOC_TYPES.indexOf(input.docType) < 0) {
    errors.push('Choose the document type.');
  }
  if (!validDate(input.issueDate)) {
    errors.push('Enter the issue date.');
  }
  if (!validDate(input.expiryDate)) {
    errors.push('Enter the expiry date.');
  } else if (validDate(input.issueDate) && input.expiryDate <= input.issueDate) {
    errors.push('The expiry date must be after the issue date.');
  }
  if (input.onBehalfOf !== undefined && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.onBehalfOf.trim())) {
    errors.push('Enter the member\'s sign-in e-mail.');
  }
  if (!input.file) {
    errors.push('Attach the document.');
  } else {
    if (ALLOWED_EXTENSIONS.indexOf(extensionOf(input.file.name)) < 0) {
      errors.push('Attach a PDF, JPEG or PNG file.');
    }
    if (input.file.size <= 0 || input.file.size > MAX_FILE_BYTES) {
      errors.push('The file must be smaller than 10 MB.');
    }
  }
  return errors;
}

/** A file name SharePoint accepts: letters, digits, dot, dash and underscore only, original extension kept. */
export function safeFileName(name: string): string {
  const ext: string = extensionOf(name);
  const base: string = (ext ? name.slice(0, -(ext.length + 1)) : name).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'document';
  return ext ? `${base}.${ext}` : base;
}

/**
 * Date-only values are written at 12:00 UTC so no site time zone can move them to another day. The item starts with
 * Outcome "Uploading", which the processing flow ignores; it is cleared once the file is attached.
 */
export function toDocumentItem(input: IDocumentInput, submissionId: string): Record<string, unknown> {
  return {
    Title: input.docType,
    FacilityId: input.facilityId,
    SubmissionId: submissionId,
    DocType: input.docType,
    IssueDate: `${input.issueDate}T12:00:00Z`,
    ExpiryDate: `${input.expiryDate}T12:00:00Z`,
    Outcome: 'Uploading',
    ...(input.onBehalfOf ? { OnBehalfOf: input.onBehalfOf.trim().toLowerCase() } : {})
  };
}
