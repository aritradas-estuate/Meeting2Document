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

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

function parseMarkdownTable(tableLines: string[]): ParsedTable | null {
  if (tableLines.length < 2) return null;

  const headerLine = tableLines[0];
  if (!headerLine.includes("|")) return null;

  const headers = headerLine
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);

  if (headers.length === 0) return null;

  const rows: string[][] = [];
  for (let i = 2; i < tableLines.length; i++) {
    const line = tableLines[i];
    if (!line.includes("|")) continue;

    const cells = line
      .split("|")
      .map((cell) => cell.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || arr.length === headers.length + 2 ? idx > 0 && idx < arr.length - 1 : true)
      .slice(0, headers.length);

    const rawCells = line.split("|");
    const cleanCells: string[] = [];
    for (let j = 0; j < rawCells.length; j++) {
      const cell = rawCells[j].trim();
      if (j === 0 && cell === "") continue;
      if (j === rawCells.length - 1 && cell === "") continue;
      cleanCells.push(cell);
    }

    if (cleanCells.length > 0) {
      while (cleanCells.length < headers.length) {
        cleanCells.push("");
      }
      rows.push(cleanCells.slice(0, headers.length));
    }
  }

  return { headers, rows };
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|");
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && /^\|[\s\-:]+\|/.test(trimmed);
}

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1");
}

type ContentSegment =
  | { type: "text"; lines: string[] }
  | { type: "table"; lines: string[]; parsed: ParsedTable };

function parseMarkdownIntoSegments(markdown: string): ContentSegment[] {
  const lines = markdown.split("\n");
  const segments: ContentSegment[] = [];
  let currentTextLines: string[] = [];
  let currentTableLines: string[] = [];
  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isTable = isTableLine(line);
    const isSeparator = isTableSeparator(line);

    if (isTable || isSeparator) {
      if (!inTable && currentTextLines.length > 0) {
        segments.push({ type: "text", lines: currentTextLines });
        currentTextLines = [];
      }
      inTable = true;
      currentTableLines.push(line);
    } else {
      if (inTable) {
        const parsed = parseMarkdownTable(currentTableLines);
        if (parsed && parsed.headers.length > 0) {
          segments.push({ type: "table", lines: currentTableLines, parsed });
        } else {
          currentTextLines.push(...currentTableLines);
        }
        currentTableLines = [];
        inTable = false;
      }
      currentTextLines.push(line);
    }
  }

  if (inTable && currentTableLines.length > 0) {
    const parsed = parseMarkdownTable(currentTableLines);
    if (parsed && parsed.headers.length > 0) {
      segments.push({ type: "table", lines: currentTableLines, parsed });
    } else {
      currentTextLines.push(...currentTableLines);
    }
  }
  if (currentTextLines.length > 0) {
    segments.push({ type: "text", lines: currentTextLines });
  }

  return segments;
}

function markdownToGoogleDocsRequests(
  markdown: string,
): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = [];
  const segments = parseMarkdownIntoSegments(markdown);
  let currentIndex = 1;

  for (const segment of segments) {
    if (segment.type === "text") {
      for (const line of segment.lines) {
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

        text = stripMarkdownFormatting(text);

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
    } else if (segment.type === "table") {
       const { headers, rows } = segment.parsed;
       const numRows = rows.length + 1;
       const numCols = headers.length;

       if (numCols === 0) continue;

       // [DEBUG] Before insertTable
       console.log(`[TABLE DEBUG] Before insertTable: currentIndex=${currentIndex}, numRows=${numRows}, numCols=${numCols}, requestCount=${requests.length}`);

       requests.push({
         insertTable: {
           location: { index: currentIndex },
           rows: numRows,
           columns: numCols,
         },
       });

      /*
       * Google Docs table index structure (cell text insertion):
       * Cell[row, col] = tableStart + 4 + (row * (numCols * 2 + 1)) + (col * 2)
       * 
       * Insert cells in REVERSE order (last cell first) because each insertText
       * shifts indices for content after the insertion point.
       */
      const getCellIndex = (row: number, col: number): number => {
        return currentIndex + 4 + (row * (numCols * 2 + 1)) + (col * 2);
      };

      const cellInsertions: { row: number; col: number; text: string }[] = [];
      const headerTexts: string[] = [];

      for (let col = 0; col < numCols; col++) {
        const headerText = stripMarkdownFormatting(headers[col]);
        headerTexts.push(headerText);
        if (headerText) {
          cellInsertions.push({ row: 0, col, text: headerText });
        }
      }

      for (let row = 0; row < rows.length; row++) {
        const rowData = rows[row];
        for (let col = 0; col < numCols; col++) {
          const cellText = stripMarkdownFormatting(rowData[col] || "");
          if (cellText) {
            cellInsertions.push({ row: row + 1, col, text: cellText });
          }
        }
      }

      cellInsertions.sort((a, b) => {
        if (a.row !== b.row) return b.row - a.row;
        return b.col - a.col;
      });

       for (const cell of cellInsertions) {
         requests.push({
           insertText: {
             location: { index: getCellIndex(cell.row, cell.col) },
             text: cell.text,
           },
         });
       }

       // [DEBUG] After cell insertions
       console.log(`[TABLE DEBUG] After cell insertions: cellInsertions.length=${cellInsertions.length}, totalTextInserted=${cellInsertions.reduce((sum, cell) => sum + cell.text.length, 0)}`);

       let headerOffset = 0;
      for (let col = 0; col < numCols; col++) {
        const text = headerTexts[col];
        if (text) {
          const baseIndex = getCellIndex(0, col);
          const adjustedIndex = baseIndex + headerOffset;
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: adjustedIndex,
                endIndex: adjustedIndex + text.length,
              },
              textStyle: { bold: true },
              fields: "bold",
            },
          });
          headerOffset += text.length;
        }
      }

       const totalTextInserted = cellInsertions.reduce((sum, cell) => sum + cell.text.length, 0);
       const tableStructureSize = 1 + numRows * (1 + numCols * 2) + 1;
       
       // [DEBUG] After tableStructureSize calculation
       console.log(`[TABLE DEBUG] After tableStructureSize calc: tableStructureSize=${tableStructureSize}, formula=(1 + ${numRows} * (1 + ${numCols} * 2) + 1), totalTextInserted=${totalTextInserted}`);
       
        currentIndex += tableStructureSize + totalTextInserted;
     }
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
