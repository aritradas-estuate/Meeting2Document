"use node";

import { action, internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { google, drive_v3, docs_v1 } from "googleapis";
import { getAuthUserId } from "@convex-dev/auth/server";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import {
  logPipelineStart,
  logPipelineEnd,
  logStep,
  logDetail,
  logError,
} from "../lib/logger";

async function getAuthenticatedClients(ctx: ActionCtx): Promise<{
  drive: drive_v3.Drive;
  docs: docs_v1.Docs;
  user: any;
}> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");

  const user: any = await ctx.runQuery(internal.users.getById, { userId });

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

  const drive = google.drive({ version: "v3", auth: oauth2Client });
  const docs = google.docs({ version: "v1", auth: oauth2Client });

  return { drive, docs, user };
}

async function convertMarkdownToGoogleDoc(
  drive: drive_v3.Drive,
  markdown: string,
  title: string,
  folderId?: string,
): Promise<{ googleDocId: string; webViewLink: string | null }> {
  // Convert markdown to HTML
  const html = await marked.parse(markdown);

  // Sanitize HTML
  const sanitizedHtml = DOMPurify.sanitize(html);

  // Create Google Doc with HTML content
  const createResponse = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.document",
      parents: folderId ? [folderId] : undefined,
    },
    fields: "id,webViewLink",
  });

  const googleDocId = createResponse.data.id;
  if (!googleDocId) {
    throw new Error("Failed to create Google Doc");
  }

   return {
     googleDocId,
     webViewLink: createResponse.data.webViewLink || null,
   };
}






export const exportToGoogleDocs = action({
  args: {
    documentId: v.id("documents"),
    folderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    logPipelineStart("GOOGLE DOCS EXPORT", args.documentId);

    try {
      logStep(1, 3, "Loading document...");
      const document = await ctx.runQuery(internal.documents.getByIdInternal, {
        documentId: args.documentId,
      });

      if (!document) throw new Error("Document not found");
      if (!document.markdownContent) {
        throw new Error("Document has no content to export");
      }

      logStep(
        1,
        3,
        `Loaded "${document.title}" (${document.markdownContent.length.toLocaleString()} chars)`,
        "success",
      );

      logStep(2, 3, "Authenticating with Google...");
      const { drive } = await getAuthenticatedClients(ctx);
      logStep(2, 3, "Authenticated", "success");

      logStep(3, 3, "Creating and formatting Google Doc...");
      const { googleDocId, webViewLink } = await convertMarkdownToGoogleDoc(
        drive,
        document.markdownContent,
        document.title || "Solution Design Document",
        args.folderId,
      );
      logStep(3, 3, `Created: ${googleDocId}`, "success");

      await ctx.runMutation(internal.documents.updateDriveFileInternal, {
        documentId: args.documentId,
        driveFileId: googleDocId,
        driveFileUrl: webViewLink || undefined,
      });

      logPipelineEnd(
        "GOOGLE DOCS EXPORT",
        args.documentId,
        true,
        Date.now() - startTime,
        {
          "Google Doc ID": googleDocId,
          URL: webViewLink || "N/A",
        },
      );

      return {
        googleDocId,
        webViewLink,
      };
    } catch (error: any) {
      logError("GOOGLE DOCS EXPORT", error, { documentId: args.documentId });

      logPipelineEnd(
        "GOOGLE DOCS EXPORT",
        args.documentId,
        false,
        Date.now() - startTime,
        { Error: error.message },
      );

      throw error;
    }
  },
});

export const exportToGoogleDocsInternal = internalAction({
  args: {
    documentId: v.id("documents"),
    userId: v.id("users"),
    folderId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    logPipelineStart("GOOGLE DOCS EXPORT (Internal)", args.documentId);

    try {
      logStep(1, 3, "Loading document...");
      const document = await ctx.runQuery(internal.documents.getByIdInternal, {
        documentId: args.documentId,
      });

      if (!document) throw new Error("Document not found");
      if (!document.markdownContent) {
        throw new Error("Document has no content to export");
      }

      logStep(
        1,
        3,
        `Loaded "${document.title}" (${document.markdownContent.length.toLocaleString()} chars)`,
        "success",
      );

      const user: any = await ctx.runQuery(internal.users.getById, {
        userId: args.userId,
      });

      if (!user || !user.googleAccessToken) {
        throw new Error("No Google Drive access available");
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );

      oauth2Client.setCredentials({
        access_token: user.googleAccessToken,
        refresh_token: user.googleRefreshToken,
      });

      const drive = google.drive({ version: "v3", auth: oauth2Client });

      logStep(2, 3, "Authenticating with Google...");
      logStep(2, 3, "Authenticated", "success");

      logStep(3, 3, "Creating and formatting Google Doc...");
      const { googleDocId, webViewLink } = await convertMarkdownToGoogleDoc(
        drive,
        document.markdownContent,
        document.title || "Solution Design Document",
        args.folderId,
      );
      logStep(3, 3, `Created: ${googleDocId}`, "success");

      await ctx.runMutation(internal.documents.updateDriveFileInternal, {
        documentId: args.documentId,
        driveFileId: googleDocId,
        driveFileUrl: webViewLink || undefined,
      });

      logPipelineEnd(
        "GOOGLE DOCS EXPORT (Internal)",
        args.documentId,
        true,
        Date.now() - startTime,
        {
          "Google Doc ID": googleDocId,
          URL: webViewLink || "N/A",
        },
      );

      return {
        googleDocId,
        webViewLink,
      };
    } catch (error: any) {
      logError("GOOGLE DOCS EXPORT (Internal)", error, {
        documentId: args.documentId,
      });

      logPipelineEnd(
        "GOOGLE DOCS EXPORT (Internal)",
        args.documentId,
        false,
        Date.now() - startTime,
        { Error: error.message },
      );

      throw error;
    }
  },
});
