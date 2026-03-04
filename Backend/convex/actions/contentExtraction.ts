"use node";

import { internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { google, drive_v3 } from "googleapis";
import { extractText } from "unpdf";
import * as XLSX from "xlsx";

// Duplicated from drive.ts lines 77-123 — drive.ts doesn't export this helper
async function getAuthenticatedDriveClientFromUser(
  ctx: ActionCtx,
  userId: string,
): Promise<drive_v3.Drive> {
  const user: any = await ctx.runQuery(internal.users.getById, {
    userId: userId as any,
  });

  if (!user) throw new Error("User not found");
  if (!user.googleAccessToken) {
    throw new Error(
      "No Google Drive access token available. Please re-authenticate.",
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    access_token: user.googleAccessToken,
    refresh_token: user.googleRefreshToken,
  });

  if (user.googleTokenExpiresAt && user.googleTokenExpiresAt < Date.now()) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      await ctx.runMutation(internal.users.updateGoogleTokens, {
        userId: user._id,
        accessToken: credentials.access_token!,
        expiresAt: credentials.expiry_date ?? undefined,
      });
    } catch (error) {
      throw new Error(
        "Failed to refresh Google token. Please re-authenticate.",
      );
    }
  }

  return google.drive({ version: "v3", auth: oauth2Client });
}

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_PRESENTATION_MIME = "application/vnd.google-apps.presentation";
const GOOGLE_SPREADSHEET_MIME = "application/vnd.google-apps.spreadsheet";
const OFFICE_WORD_MIME = "application/msword";
const OFFICE_WORD_OPENXML_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const OFFICE_POWERPOINT_MIME = "application/vnd.ms-powerpoint";
const OFFICE_POWERPOINT_OPENXML_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const OFFICE_EXCEL_MIME = "application/vnd.ms-excel";
const OFFICE_EXCEL_OPENXML_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function createTemporaryConvertedCopy(
  drive: drive_v3.Drive,
  fileId: string,
  sourceFileName: string,
  targetMimeType: string,
): Promise<string> {
  const baseName = sourceFileName.replace(/\.[^/.]+$/, "");
  const copyResponse = await drive.files.copy({
    fileId,
    requestBody: {
      name: `[temp-extract] ${baseName} (${Date.now()})`,
      mimeType: targetMimeType,
    },
    fields: "id",
    supportsAllDrives: true,
  } as any);

  const copiedFileId = copyResponse.data.id;
  if (!copiedFileId) {
    throw new Error("Failed to create temporary converted Drive file");
  }

  return copiedFileId;
}

async function deleteTemporaryFileBestEffort(
  drive: drive_v3.Drive,
  fileId: string,
) {
  try {
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    } as any);
  } catch (error: any) {
    console.warn(
      `[contentExtraction] Failed to delete temporary file ${fileId}: ${error?.message ?? error}`,
    );
  }
}

function serializeWorkbookToText(xlsxBuffer: Buffer): string {
  const workbook = XLSX.read(xlsxBuffer, {
    type: "buffer",
    cellDates: true,
    cellText: true,
  });

  const sheetNames = workbook.SheetNames;
  if (!sheetNames.length) {
    return "[Warning: Workbook has no worksheets]";
  }

  const sheetsAsText = sheetNames.map((sheetName, index) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      return `=== SHEET ${index + 1}: ${sheetName} ===\n[Warning: Unable to read sheet data]`;
    }

    const csv = XLSX.utils.sheet_to_csv(worksheet, {
      blankrows: false,
    }).trim();

    return `=== SHEET ${index + 1}: ${sheetName} ===\n${
      csv.length ? csv : "[No tabular data found]"
    }`;
  });

  return `Workbook contains ${sheetNames.length} worksheet(s).\n\n${sheetsAsText.join("\n\n")}`;
}

export const extractContent = internalAction({
  args: {
    sourceContentId: v.id("sourceContent"),
  },
  handler: async (ctx, args) => {
    const { sourceContentId } = args;

    const sourceContent = await ctx.runQuery(
      internal.sourceContent.getByIdInternal,
      { sourceContentId },
    );
    if (!sourceContent) {
      throw new Error(`sourceContent ${sourceContentId} not found`);
    }

    console.log(
      `[contentExtraction] Starting extraction for "${sourceContent.fileName}" (${sourceContent.mimeType})`,
    );

    await ctx.runMutation(internal.sourceContent.updateStatus, {
      sourceContentId,
      status: "extracting",
    });

    let drive: drive_v3.Drive | null = null;
    let temporaryFileId: string | null = null;

    try {
      const MAX_FILE_SIZE = 20 * 1024 * 1024;
      if (sourceContent.fileSize && sourceContent.fileSize > MAX_FILE_SIZE) {
        throw new Error("File too large (>20MB limit)");
      }

      const job: any = await ctx.runQuery(internal.jobs.getByIdInternal, {
        jobId: sourceContent.jobId,
      });
      if (!job) throw new Error("Associated job not found");

      const project: any = await ctx.runQuery(
        internal.projects.getByIdInternal,
        { projectId: job.projectId },
      );
      if (!project) throw new Error("Associated project not found");

      const authenticatedDrive = await getAuthenticatedDriveClientFromUser(
        ctx,
        project.userId,
      );
      drive = authenticatedDrive;

      let extractedText: string;
      const fileId = sourceContent.fileId;

      switch (sourceContent.mimeType) {
        case GOOGLE_DOC_MIME:
        case OFFICE_WORD_MIME:
        case OFFICE_WORD_OPENXML_MIME: {
          if (
            sourceContent.mimeType === OFFICE_WORD_MIME ||
            sourceContent.mimeType === OFFICE_WORD_OPENXML_MIME
          ) {
            console.log(
              `[contentExtraction] Converting Microsoft Word to Google Doc for extraction`,
            );
            temporaryFileId = await createTemporaryConvertedCopy(
              authenticatedDrive,
              fileId,
              sourceContent.fileName,
              GOOGLE_DOC_MIME,
            );
          }

          console.log(
            `[contentExtraction] Exporting document as text/plain`,
          );
          const response = await authenticatedDrive.files.export(
            {
              fileId: temporaryFileId ?? fileId,
              mimeType: "text/plain",
              supportsAllDrives: true,
            } as any,
          );
          extractedText = String(response.data);
          break;
        }

        case GOOGLE_PRESENTATION_MIME:
        case OFFICE_POWERPOINT_MIME:
        case OFFICE_POWERPOINT_OPENXML_MIME: {
          if (
            sourceContent.mimeType === OFFICE_POWERPOINT_MIME ||
            sourceContent.mimeType === OFFICE_POWERPOINT_OPENXML_MIME
          ) {
            console.log(
              `[contentExtraction] Converting Microsoft PowerPoint to Google Slides for extraction`,
            );
            temporaryFileId = await createTemporaryConvertedCopy(
              authenticatedDrive,
              fileId,
              sourceContent.fileName,
              GOOGLE_PRESENTATION_MIME,
            );
          }

          console.log(
            `[contentExtraction] Exporting presentation as text/plain`,
          );
          const response = await authenticatedDrive.files.export(
            {
              fileId: temporaryFileId ?? fileId,
              mimeType: "text/plain",
              supportsAllDrives: true,
            } as any,
          );
          extractedText = String(response.data);
          break;
        }

        case GOOGLE_SPREADSHEET_MIME: {
          console.log(
            `[contentExtraction] Exporting Google Sheets as text/csv`,
          );
          const response = await authenticatedDrive.files.export(
            {
              fileId,
              mimeType: "text/csv",
              supportsAllDrives: true,
            } as any,
          );
          extractedText =
            "Note: Only the first sheet was exported.\n\n" +
            String(response.data);
          break;
        }

        case OFFICE_EXCEL_MIME:
        case OFFICE_EXCEL_OPENXML_MIME: {
          console.log(
            `[contentExtraction] Converting Microsoft Excel to Google Sheets for extraction`,
          );
          temporaryFileId = await createTemporaryConvertedCopy(
            authenticatedDrive,
            fileId,
            sourceContent.fileName,
            GOOGLE_SPREADSHEET_MIME,
          );

          console.log(
            `[contentExtraction] Exporting converted spreadsheet as .xlsx for all-sheet parsing`,
          );
          const response = await authenticatedDrive.files.export(
            {
              fileId: temporaryFileId,
              mimeType: OFFICE_EXCEL_OPENXML_MIME,
              supportsAllDrives: true,
            } as any,
            { responseType: "arraybuffer" },
          );

          const xlsxBuffer = Buffer.from(response.data as ArrayBuffer);
          extractedText = serializeWorkbookToText(xlsxBuffer);
          break;
        }

        case "application/pdf": {
          console.log(`[contentExtraction] Downloading PDF for text extraction`);
          const response = await authenticatedDrive.files.get(
            {
              fileId,
              alt: "media",
              supportsAllDrives: true,
            },
            { responseType: "arraybuffer" },
          );

          const pdfBuffer = Buffer.from(response.data as ArrayBuffer);
          console.log(
            `[contentExtraction] PDF downloaded, size: ${pdfBuffer.length} bytes`,
          );

          const { text } = await extractText(new Uint8Array(pdfBuffer), {
            mergePages: true,
          });
          extractedText = text;

          // Scanned PDF heuristic: <50 chars extracted from a >100KB file
          if (
            extractedText.trim().length < 50 &&
            sourceContent.fileSize &&
            sourceContent.fileSize > 100 * 1024
          ) {
            throw new Error(
              "This appears to be a scanned PDF. Only text-based PDFs are supported.",
            );
          }
          break;
        }

        default:
          throw new Error(
            `Unsupported MIME type for content extraction: ${sourceContent.mimeType}`,
          );
      }

      if (!extractedText || extractedText.trim().length === 0) {
        extractedText = "[Warning: This document appears to be empty]";
        console.log(
          `[contentExtraction] Document "${sourceContent.fileName}" appears to be empty`,
        );
      }

      console.log(
        `[contentExtraction] Extracted ${extractedText.length} chars from "${sourceContent.fileName}"`,
      );

      await ctx.runMutation(internal.sourceContent.saveContent, {
        sourceContentId,
        text: extractedText,
      });

      console.log(
        `[contentExtraction] Successfully completed extraction for "${sourceContent.fileName}"`,
      );

      await ctx.runMutation(internal.jobs.checkCompletion, {
        jobId: sourceContent.jobId,
      });
    } catch (error: any) {
      console.error(
        `[contentExtraction] Failed to extract "${sourceContent.fileName}":`,
        error.message,
      );

      // Remap Google API 403 "Export size limit exceeded" to a user-friendly message
      let errorMessage = error.message || "Unknown extraction error";
      if (
        error.code === 403 ||
        errorMessage.includes("Export size limit exceeded") ||
        errorMessage.includes("too large")
      ) {
        if (errorMessage.includes("Export size limit")) {
          errorMessage =
            "File too large for text extraction (>10MB export limit)";
        }
      }

      await ctx.runMutation(internal.sourceContent.updateStatus, {
        sourceContentId,
        status: "failed",
        error: errorMessage,
      });

      await ctx.runMutation(internal.jobs.checkCompletion, {
        jobId: sourceContent.jobId,
      });
    } finally {
      if (drive && temporaryFileId) {
        await deleteTemporaryFileBestEffort(drive, temporaryFileId);
      }
    }
  },
});
