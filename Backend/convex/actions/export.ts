"use node";

import { action, internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { google, drive_v3, docs_v1 } from "googleapis";
import { getAuthUserId } from "@convex-dev/auth/server";
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

function markdownToGoogleDocsRequests(
  markdown: string,
): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [];
  const lines = markdown.split("\n");
  let currentIndex = 1;

  for (const line of lines) {
    if (!line.trim()) {
      requests.push({
        insertText: {
          location: { index: currentIndex },
          text: "\n",
        },
      });
      currentIndex += 1;
      continue;
    }

    const h1Match = line.match(/^# (.+)$/);
    const h2Match = line.match(/^## (.+)$/);
    const h3Match = line.match(/^### (.+)$/);
    const h4Match = line.match(/^#### (.+)$/);
    const bulletMatch = line.match(/^[-*] (.+)$/);
    const numberedMatch = line.match(/^(\d+)\. (.+)$/);

    let text = line;
    let style: string | null = null;
    let isBullet = false;
    let isNumbered = false;

    if (h1Match) {
      text = h1Match[1] || "";
      style = "HEADING_1";
    } else if (h2Match) {
      text = h2Match[1] || "";
      style = "HEADING_2";
    } else if (h3Match) {
      text = h3Match[1] || "";
      style = "HEADING_3";
    } else if (h4Match) {
      text = h4Match[1] || "";
      style = "HEADING_4";
    } else if (bulletMatch) {
      text = bulletMatch[1] || "";
      isBullet = true;
    } else if (numberedMatch) {
      text = numberedMatch[2] || "";
      isNumbered = true;
    }

    text = text.replace(/\*\*(.+?)\*\*/g, "$1");
    text = text.replace(/\*(.+?)\*/g, "$1");
    text = text.replace(/`(.+?)`/g, "$1");
    text = text.replace(/\[(.+?)\]\(.+?\)/g, "$1");

    requests.push({
      insertText: {
        location: { index: currentIndex },
        text: text + "\n",
      },
    });

    const textLength = text.length;

    if (style) {
      requests.push({
        updateParagraphStyle: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + textLength + 1,
          },
          paragraphStyle: {
            namedStyleType: style,
          },
          fields: "namedStyleType",
        },
      });
    }

    if (isBullet) {
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + textLength + 1,
          },
          bulletPreset: "BULLET_DISC_CIRCLE_SQUARE",
        },
      });
    }

    if (isNumbered) {
      requests.push({
        createParagraphBullets: {
          range: {
            startIndex: currentIndex,
            endIndex: currentIndex + textLength + 1,
          },
          bulletPreset: "NUMBERED_DECIMAL_ALPHA_ROMAN",
        },
      });
    }

    currentIndex += textLength + 1;
  }

  return requests;
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
      logStep(1, 4, "Loading document...");
      const document = await ctx.runQuery(internal.documents.getByIdInternal, {
        documentId: args.documentId,
      });

      if (!document) throw new Error("Document not found");
      if (!document.markdownContent) {
        throw new Error("Document has no content to export");
      }

      logStep(
        1,
        4,
        `Loaded "${document.title}" (${document.markdownContent.length.toLocaleString()} chars)`,
        "success",
      );

      logStep(2, 4, "Creating Google Doc...");
      const { drive, docs } = await getAuthenticatedClients(ctx);

      const createResponse = await drive.files.create({
        requestBody: {
          name: document.title || "Solution Design Document",
          mimeType: "application/vnd.google-apps.document",
          parents: args.folderId ? [args.folderId] : undefined,
        },
        fields: "id,webViewLink",
      });

      const googleDocId = createResponse.data.id;
      if (!googleDocId) throw new Error("Failed to create Google Doc");

      logStep(2, 4, `Created: ${googleDocId}`, "success");

      logStep(3, 4, "Converting markdown to Docs format...");
      const requests = markdownToGoogleDocsRequests(document.markdownContent);
      logStep(
        3,
        4,
        `Generated ${requests.length} formatting requests`,
        "success",
      );

      logStep(4, 4, "Applying formatting...");
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: googleDocId,
          requestBody: {
            requests,
          },
        });
      }
      logStep(4, 4, "Formatting applied", "success");

      await ctx.runMutation(internal.documents.updateDriveFileInternal, {
        documentId: args.documentId,
        driveFileId: googleDocId,
        driveFileUrl: createResponse.data.webViewLink || undefined,
      });

      logPipelineEnd(
        "GOOGLE DOCS EXPORT",
        args.documentId,
        true,
        Date.now() - startTime,
        {
          "Google Doc ID": googleDocId,
          URL: createResponse.data.webViewLink || "N/A",
        },
      );

      return {
        googleDocId,
        webViewLink: createResponse.data.webViewLink,
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
      logStep(1, 4, "Loading document...");
      const document = await ctx.runQuery(internal.documents.getByIdInternal, {
        documentId: args.documentId,
      });

      if (!document) throw new Error("Document not found");
      if (!document.markdownContent) {
        throw new Error("Document has no content to export");
      }

      logStep(
        1,
        4,
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
      const docs = google.docs({ version: "v1", auth: oauth2Client });

      logStep(2, 4, "Creating Google Doc...");
      const createResponse = await drive.files.create({
        requestBody: {
          name: document.title || "Solution Design Document",
          mimeType: "application/vnd.google-apps.document",
          parents: args.folderId ? [args.folderId] : undefined,
        },
        fields: "id,webViewLink",
      });

      const googleDocId = createResponse.data.id;
      if (!googleDocId) throw new Error("Failed to create Google Doc");

      logStep(2, 4, `Created: ${googleDocId}`, "success");

      logStep(3, 4, "Converting markdown to Docs format...");
      const requests = markdownToGoogleDocsRequests(document.markdownContent);
      logStep(
        3,
        4,
        `Generated ${requests.length} formatting requests`,
        "success",
      );

      logStep(4, 4, "Applying formatting...");
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: googleDocId,
          requestBody: {
            requests,
          },
        });
      }
      logStep(4, 4, "Formatting applied", "success");

      await ctx.runMutation(internal.documents.updateDriveFileInternal, {
        documentId: args.documentId,
        driveFileId: googleDocId,
        driveFileUrl: createResponse.data.webViewLink || undefined,
      });

      logPipelineEnd(
        "GOOGLE DOCS EXPORT (Internal)",
        args.documentId,
        true,
        Date.now() - startTime,
        {
          "Google Doc ID": googleDocId,
          URL: createResponse.data.webViewLink || "N/A",
        },
      );

      return {
        googleDocId,
        webViewLink: createResponse.data.webViewLink,
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
