import React from 'react';
import {
  Video,
  FileText,
  Slideshow,
  Table,
  FilePdf,
  Folder,
  File,
} from '@phosphor-icons/react';

/**
 * MIME type constants for supported file types
 */
export const MIME_TYPES = {
  GOOGLE_DOC: 'application/vnd.google-apps.document',
  GOOGLE_SLIDES: 'application/vnd.google-apps.presentation',
  GOOGLE_SHEETS: 'application/vnd.google-apps.spreadsheet',
  MS_WORD: 'application/msword',
  MS_WORD_OPENXML:
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  MS_POWERPOINT: 'application/vnd.ms-powerpoint',
  MS_POWERPOINT_OPENXML:
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  MS_EXCEL: 'application/vnd.ms-excel',
  MS_EXCEL_OPENXML:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PDF: 'application/pdf',
  FOLDER: 'application/vnd.google-apps.folder',
} as const;

/**
 * Array of supported content types (excludes folders and videos)
 */
export const SUPPORTED_CONTENT_TYPES = [
  MIME_TYPES.GOOGLE_DOC,
  MIME_TYPES.GOOGLE_SLIDES,
  MIME_TYPES.GOOGLE_SHEETS,
  MIME_TYPES.MS_WORD,
  MIME_TYPES.MS_WORD_OPENXML,
  MIME_TYPES.MS_POWERPOINT,
  MIME_TYPES.MS_POWERPOINT_OPENXML,
  MIME_TYPES.MS_EXCEL,
  MIME_TYPES.MS_EXCEL_OPENXML,
  MIME_TYPES.PDF,
] as const;

/**
 * Check if a MIME type represents a video file
 */
export function isVideoFile(mimeType: string): boolean {
  return mimeType.includes('video');
}

/**
 * Check if a MIME type is a supported document type
 */
export function isDocumentFile(mimeType: string): boolean {
  return SUPPORTED_CONTENT_TYPES.includes(
    mimeType as typeof SUPPORTED_CONTENT_TYPES[number]
  );
}

/**
 * Check if a file type is supported (video or document, but not folders)
 */
export function isSupportedFile(mimeType: string): boolean {
  return (isVideoFile(mimeType) || isDocumentFile(mimeType)) &&
    mimeType !== MIME_TYPES.FOLDER;
}

/**
 * Get human-readable label for a file type
 */
export function getFileTypeLabel(mimeType: string): string {
  switch (mimeType) {
    case MIME_TYPES.GOOGLE_DOC:
      return 'Google Doc';
    case MIME_TYPES.MS_WORD:
    case MIME_TYPES.MS_WORD_OPENXML:
      return 'Microsoft Word';
    case MIME_TYPES.GOOGLE_SLIDES:
      return 'Google Slides';
    case MIME_TYPES.MS_POWERPOINT:
    case MIME_TYPES.MS_POWERPOINT_OPENXML:
      return 'Microsoft PowerPoint';
    case MIME_TYPES.GOOGLE_SHEETS:
      return 'Google Sheets';
    case MIME_TYPES.MS_EXCEL:
    case MIME_TYPES.MS_EXCEL_OPENXML:
      return 'Microsoft Excel';
    case MIME_TYPES.PDF:
      return 'PDF';
    case MIME_TYPES.FOLDER:
      return 'Folder';
    default:
      if (isVideoFile(mimeType)) {
        return 'Video';
      }
      return 'File';
  }
}

/**
 * Props for FileTypeIcon component
 */
interface FileTypeIconProps {
  mimeType: string;
  className?: string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
}

/**
 * React component that renders the appropriate Phosphor icon for a file type
 */
export const FileTypeIcon: React.FC<FileTypeIconProps> = ({
  mimeType,
  className = 'h-5 w-5',
  weight = 'duotone',
}) => {
  const iconProps = {
    weight,
    className,
  };

  switch (mimeType) {
    case MIME_TYPES.GOOGLE_DOC:
    case MIME_TYPES.MS_WORD:
    case MIME_TYPES.MS_WORD_OPENXML:
      return <FileText {...iconProps} className={`${className} text-blue-500`} />;
    case MIME_TYPES.GOOGLE_SLIDES:
    case MIME_TYPES.MS_POWERPOINT:
    case MIME_TYPES.MS_POWERPOINT_OPENXML:
      return <Slideshow {...iconProps} className={`${className} text-orange-500`} />;
    case MIME_TYPES.GOOGLE_SHEETS:
    case MIME_TYPES.MS_EXCEL:
    case MIME_TYPES.MS_EXCEL_OPENXML:
      return <Table {...iconProps} className={`${className} text-green-500`} />;
    case MIME_TYPES.PDF:
      return <FilePdf {...iconProps} className={`${className} text-red-500`} />;
    case MIME_TYPES.FOLDER:
      return <Folder {...iconProps} className={`${className} text-blue-500`} />;
    default:
      if (isVideoFile(mimeType)) {
        return <Video {...iconProps} className={`${className} text-purple-500`} />;
      }
      return <File {...iconProps} className={`${className} text-gray-500`} />;
  }
};

FileTypeIcon.displayName = 'FileTypeIcon';
