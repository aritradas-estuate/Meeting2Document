"use node";

import { internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { google, drive_v3 } from "googleapis";
import { PDFParse } from "pdf-parse";

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

      const drive = await getAuthenticatedDriveClientFromUser(
        ctx,
        project.userId,
      );

      let extractedText: string;
      const fileId = sourceContent.fileId;

      switch (sourceContent.mimeType) {
        case "application/vnd.google-apps.document": {
          console.log(
            `[contentExtraction] Exporting Google Doc as text/plain`,
          );
          const response = await drive.files.export(
            {
              fileId,
              mimeType: "text/plain",
              supportsAllDrives: true,
            } as any,
          );
          extractedText = String(response.data);
          break;
        }

        case "application/vnd.google-apps.presentation": {
          console.log(
            `[contentExtraction] Exporting Google Slides as text/plain`,
          );
          const response = await drive.files.export(
            {
              fileId,
              mimeType: "text/plain",
              supportsAllDrives: true,
            } as any,
          );
          extractedText = String(response.data);
          break;
        }

        case "application/vnd.google-apps.spreadsheet": {
          console.log(
            `[contentExtraction] Exporting Google Sheets as text/csv`,
          );
          const response = await drive.files.export(
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

        case "application/pdf": {
          console.log(`[contentExtraction] Downloading PDF for text extraction`);
          const response = await drive.files.get(
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

          const parser = new PDFParse({ data: pdfBuffer });
          const pdfData = await parser.getText();
          await parser.destroy();
          extractedText = pdfData.text;

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
    }
  },
});
