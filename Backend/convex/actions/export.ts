"use node";

import { action, internalAction, ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { google, drive_v3, docs_v1 } from "googleapis";
import { getAuthUserId } from "@convex-dev/auth/server";
import { marked } from "marked";
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
  const html = await marked.parse(markdown);

  const createResponse = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: "application/vnd.google-apps.document",
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: "text/html",
      body: html,
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

/**
 * Applies professional styling to a Google Doc including:
 * - Header with company logo
 * - Footer with document title and page numbers (teal background, white text)
 * - Table header styling (red background, white text)
 *
 * @param docs - Authenticated Google Docs client
 * @param documentId - The Google Doc ID to style
 * @param documentTitle - The document title to display in the footer
 * @returns void - Errors are logged but not thrown to avoid failing the export
 */
async function applyProfessionalStyling(
  docs: docs_v1.Docs,
  documentId: string,
  documentTitle?: string,
): Promise<void> {
  // Brand colors as RGB fractions (0-1)
  const RED_BACKGROUND = { red: 0.769, green: 0.118, blue: 0.227 }; // #C41E3A
  const TEAL_BACKGROUND = { red: 0.361, green: 0.749, blue: 0.702 }; // #5CBFB3
  const WHITE_TEXT = { red: 1.0, green: 1.0, blue: 1.0 }; // #FFFFFF
  
  const LOGO_URL = process.env.FRONTEND_URL 
    ? `${process.env.FRONTEND_URL}/66degrees-logo.svg`
    : "http://localhost:3000/66degrees-logo.svg";

  try {
    await createHeaderWithLogo(docs, documentId, LOGO_URL);
  } catch (error: any) {
    logError("Header creation", error, { documentId });
    logDetail(`Header creation failed: ${error.message} - continuing without header`);
  }

  try {
    await createFooterWithPageNumbers(docs, documentId, documentTitle || "Solution Design Document", TEAL_BACKGROUND, WHITE_TEXT);
  } catch (error: any) {
    logError("Footer creation", error, { documentId });
    logDetail(`Footer creation failed: ${error.message} - continuing without footer`);
  }

  try {
    await applyTableStyling(docs, documentId, RED_BACKGROUND, WHITE_TEXT);
  } catch (error: any) {
    logError("Table styling", error, { documentId });
    logDetail(`Table styling failed: ${error.message} - continuing without table styling`);
  }
}

/**
 * Creates a header with the company logo
 */
async function createHeaderWithLogo(
  docs: docs_v1.Docs,
  documentId: string,
  logoUrl: string,
): Promise<void> {
  const createHeaderResponse = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          createHeader: {
            type: "DEFAULT",
          },
        },
      ],
    },
  });

  const headerId = createHeaderResponse.data.replies?.[0]?.createHeader?.headerId;
  if (!headerId) {
    throw new Error("Failed to create header - no headerId returned");
  }

  logDetail(`Created header with ID: ${headerId}`);

  try {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertInlineImage: {
              location: {
                segmentId: headerId,
                index: 0,
              },
              uri: logoUrl,
              objectSize: {
                width: {
                  magnitude: 72,
                  unit: "PT",
                },
              },
            },
          },
        ],
      },
    });
    logDetail("Logo inserted into header successfully");
  } catch (imageError: any) {
    logDetail(`Logo insertion failed: ${imageError.message} - header created without logo`);
  }
}

/**
 * Creates a footer with document title and page numbers
 * Footer has teal background with white text
 */
async function createFooterWithPageNumbers(
  docs: docs_v1.Docs,
  documentId: string,
  documentTitle: string,
  tealBackground: { red: number; green: number; blue: number },
  whiteText: { red: number; green: number; blue: number },
): Promise<void> {
  const createFooterResponse = await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          createFooter: {
            type: "DEFAULT",
          },
        },
      ],
    },
  });

  const footerId = createFooterResponse.data.replies?.[0]?.createFooter?.footerId;
  if (!footerId) {
    throw new Error("Failed to create footer - no footerId returned");
  }

  logDetail(`Created footer with ID: ${footerId}`);

  const footerText = `${documentTitle}  |  Page `;
  
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: {
              segmentId: footerId,
              index: 0,
            },
            text: footerText,
          },
        },
      ],
    },
  });

  const document = await docs.documents.get({ documentId });
  const footers = document.data.footers;
  
  if (!footers || !footers[footerId]) {
    throw new Error("Footer not found in document after creation");
  }

  const footerContent = footers[footerId].content;
  if (!footerContent || footerContent.length === 0) {
    throw new Error("Footer has no content");
  }

  const updatedDocument = await docs.documents.get({ documentId });
  const updatedFooters = updatedDocument.data.footers;
  
  if (!updatedFooters || !updatedFooters[footerId]) {
    logDetail("Could not find footer for styling");
    return;
  }

  const updatedFooterContent = updatedFooters[footerId].content;
  if (!updatedFooterContent || updatedFooterContent.length === 0) {
    logDetail("Footer content is empty - skipping styling");
    return;
  }

  const stylingRequests: docs_v1.Schema$Request[] = [];

  for (const element of updatedFooterContent) {
    if (element.paragraph) {
      const paragraphStart = element.startIndex || 0;
      const paragraphEnd = element.endIndex || 1;
      
      stylingRequests.push({
        updateParagraphStyle: {
          paragraphStyle: {
            shading: {
              backgroundColor: {
                color: { rgbColor: tealBackground },
              },
            },
          },
          range: {
            segmentId: footerId,
            startIndex: paragraphStart,
            endIndex: paragraphEnd,
          },
          fields: "shading.backgroundColor",
        },
      });

      const paragraphElements = element.paragraph.elements;
      if (paragraphElements) {
        for (const paragraphElement of paragraphElements) {
          const textRun = paragraphElement.textRun;
          if (textRun) {
            const startIndex = paragraphElement.startIndex;
            const endIndex = paragraphElement.endIndex;

            if (startIndex != null && endIndex != null && startIndex < endIndex) {
              stylingRequests.push({
                updateTextStyle: {
                  textStyle: {
                    foregroundColor: {
                      color: { rgbColor: whiteText },
                    },
                  },
                  range: {
                    segmentId: footerId,
                    startIndex,
                    endIndex,
                  },
                  fields: "foregroundColor",
                },
              });
            }
          }
        }
      }
    }
  }

  if (stylingRequests.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: stylingRequests,
      },
    });
    logDetail("Footer styling applied successfully");
  }
}

/**
 * Applies styling to table headers (red background, white bold text)
 */
async function applyTableStyling(
  docs: docs_v1.Docs,
  documentId: string,
  redBackground: { red: number; green: number; blue: number },
  whiteText: { red: number; green: number; blue: number },
): Promise<void> {
  // Fetch the document structure
  const document = await docs.documents.get({ documentId });
  const content = document.data.body?.content;

  if (!content) {
    logDetail("No content found in document for styling");
    return;
  }

  // Find all tables in the document
  const tables: Array<{
    startIndex: number;
    table: docs_v1.Schema$Table;
  }> = [];

  for (const element of content) {
    if (element.table) {
      tables.push({
        startIndex: element.startIndex || 0,
        table: element.table,
      });
    }
  }

  if (tables.length === 0) {
    logDetail("No tables found in document - skipping table styling");
    return;
  }

  logDetail(`Found ${tables.length} table(s) to style`);

  // Build batchUpdate requests for all tables
  const requests: docs_v1.Schema$Request[] = [];

  for (const { table } of tables) {
    const firstRow = table.tableRows?.[0];
    if (!firstRow?.tableCells) continue;

    // Style each cell in the first row
    for (const cell of firstRow.tableCells) {
      const cellContent = cell.content;
      if (!cellContent || cellContent.length === 0) continue;

      // Get the cell's start and end indices for background styling
      const cellStartIndex = cell.startIndex;
      const cellEndIndex = cell.endIndex;

      if (cellStartIndex == null || cellEndIndex == null) continue;

      // Apply red background to the cell
      requests.push({
        updateTableCellStyle: {
          tableCellStyle: {
            backgroundColor: {
              color: { rgbColor: redBackground },
            },
          },
          tableRange: {
            tableCellLocation: {
              tableStartLocation: {
                index: table.tableRows?.[0]?.tableCells?.[0]?.content?.[0]?.startIndex
                  ? (table.tableRows[0].tableCells[0].content[0].startIndex - 2)
                  : (cellStartIndex as number) - 2,
              },
              rowIndex: 0,
              columnIndex: firstRow.tableCells.indexOf(cell),
            },
            rowSpan: 1,
            columnSpan: 1,
          },
          fields: "backgroundColor",
        },
      });

      // Apply white text color to all text in the cell
      for (const contentElement of cellContent) {
        if (contentElement.paragraph) {
          const paragraphElements = contentElement.paragraph.elements;
          if (!paragraphElements) continue;

          for (const paragraphElement of paragraphElements) {
            const textRun = paragraphElement.textRun;
            if (!textRun) continue;

            const startIndex = paragraphElement.startIndex;
            const endIndex = paragraphElement.endIndex;

            if (startIndex == null || endIndex == null) continue;
            if (startIndex >= endIndex) continue;

            requests.push({
              updateTextStyle: {
                textStyle: {
                  foregroundColor: {
                    color: { rgbColor: whiteText },
                  },
                  bold: true,
                },
                range: {
                  startIndex,
                  endIndex,
                },
                fields: "foregroundColor,bold",
              },
            });
          }
        }
      }
    }
  }

  if (requests.length === 0) {
    logDetail("No styling requests generated - tables may be empty");
    return;
  }

  logDetail(`Applying ${requests.length} styling request(s) to tables`);

  // Execute the batchUpdate
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests,
    },
  });

  logDetail("Table header styling applied successfully");
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
      const { drive, docs } = await getAuthenticatedClients(ctx);
      logStep(2, 3, "Authenticated", "success");

      logStep(3, 4, "Creating Google Doc...");
      const { googleDocId, webViewLink } = await convertMarkdownToGoogleDoc(
        drive,
        document.markdownContent,
        document.title || "Solution Design Document",
        args.folderId,
      );
      logStep(3, 4, `Created: ${googleDocId}`, "success");

      logStep(4, 4, "Applying professional styling...");
      await applyProfessionalStyling(docs, googleDocId, document.title);
      logStep(4, 4, "Styling applied", "success");

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
      const docs = google.docs({ version: "v1", auth: oauth2Client });

      logStep(2, 3, "Authenticating with Google...");
      logStep(2, 3, "Authenticated", "success");

      logStep(3, 4, "Creating Google Doc...");
      const { googleDocId, webViewLink } = await convertMarkdownToGoogleDoc(
        drive,
        document.markdownContent,
        document.title || "Solution Design Document",
        args.folderId,
      );
      logStep(3, 4, `Created: ${googleDocId}`, "success");

      logStep(4, 4, "Applying professional styling...");
      await applyProfessionalStyling(docs, googleDocId, document.title);
      logStep(4, 4, "Styling applied", "success");

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
