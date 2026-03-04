"use node";

import { action, internalAction, ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { google, drive_v3 } from "googleapis";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Storage } from "@google-cloud/storage";

function parseGcsPrivateKey(rawKey: string): string {
  let key = rawKey;
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  if (key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }
  return key;
}

function getGcsStorage(): Storage {
  const projectId = process.env.GCS_PROJECT_ID;
  const clientEmail = process.env.GCS_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GCS_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawPrivateKey) {
    const missing = [];
    if (!projectId) missing.push("GCS_PROJECT_ID");
    if (!clientEmail) missing.push("GCS_CLIENT_EMAIL");
    if (!rawPrivateKey) missing.push("GCS_PRIVATE_KEY");
    throw new Error(`GCS credentials missing: ${missing.join(", ")}`);
  }

  return new Storage({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: parseGcsPrivateKey(rawPrivateKey),
    },
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

interface DriveItem {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  createdTime: string | null;
  modifiedTime: string | null;
  webViewLink: string | null;
  iconLink: string | null;
  thumbnailLink: string | null;
  parents: string[] | null;
  isFolder: boolean;
}

interface SharedDrive {
  id: string;
  name: string;
  colorRgb: string | null;
  backgroundImageLink: string | null;
}

interface Breadcrumb {
  id: string;
  name: string;
}

async function getAuthenticatedDriveClient(
  ctx: ActionCtx,
): Promise<{ drive: drive_v3.Drive; user: any }> {
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

  return {
    drive: google.drive({ version: "v3", auth: oauth2Client }),
    user,
  };
}

export const listSharedDrives = action({
  args: {
    pageToken: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ drives: SharedDrive[]; nextPageToken: string | null }> => {
    const { drive } = await getAuthenticatedDriveClient(ctx);

    const response = await drive.drives.list({
      pageSize: Math.min(args.pageSize ?? 50, 100),
      pageToken: args.pageToken ?? undefined,
      fields: "nextPageToken,drives(id,name,colorRgb,backgroundImageLink)",
    });

    return {
      drives: (response.data.drives ?? []).map((d: drive_v3.Schema$Drive) => ({
        id: d.id!,
        name: d.name!,
        colorRgb: d.colorRgb ?? null,
        backgroundImageLink: d.backgroundImageLink ?? null,
      })),
      nextPageToken: response.data.nextPageToken ?? null,
    };
  },
});

export const listFiles = action({
  args: {
    folderId: v.optional(v.string()),
    driveId: v.optional(v.string()),
    query: v.optional(v.string()),
    pageToken: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ items: DriveItem[]; nextPageToken: string | null }> => {
    const { drive } = await getAuthenticatedDriveClient(ctx);

    const qParts = ["trashed = false"];

    if (args.folderId) {
      qParts.push(`'${args.folderId}' in parents`);
    } else if (!args.query) {
      qParts.push("'root' in parents");
    }

    if (args.query) {
      qParts.push(`name contains '${args.query}'`);
    }

    const fileTypes = [
      "mimeType = 'application/vnd.google-apps.folder'",
      "mimeType contains 'video/'",
      "mimeType = 'application/pdf'",
      "mimeType = 'application/vnd.google-apps.document'",
      "mimeType = 'application/vnd.google-apps.presentation'",
      "mimeType = 'application/vnd.google-apps.spreadsheet'",
      "mimeType = 'application/msword'",
      "mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
      "mimeType = 'application/vnd.ms-powerpoint'",
      "mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'",
      "mimeType = 'application/vnd.ms-excel'",
      "mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'",
    ];
    qParts.push(`(${fileTypes.join(" or ")})`);

    const q = qParts.join(" and ");

    const requestParams: any = {
      q,
      pageSize: Math.min(args.pageSize ?? 50, 100),
      fields:
        "nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,thumbnailLink,parents)",
      orderBy: "folder,name",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    };

    if (args.pageToken) {
      requestParams.pageToken = args.pageToken;
    }

    if (args.driveId) {
      requestParams.driveId = args.driveId;
      requestParams.corpora = "drive";
    }

    const response = await drive.files.list(requestParams);

    const items: DriveItem[] = (response.data.files ?? []).map(
      (f: drive_v3.Schema$File) => ({
        id: f.id!,
        name: f.name!,
        mimeType: f.mimeType ?? "",
        size: f.size ? parseInt(f.size) : null,
        createdTime: f.createdTime ?? null,
        modifiedTime: f.modifiedTime ?? null,
        webViewLink: f.webViewLink ?? null,
        iconLink: f.iconLink ?? null,
        thumbnailLink: f.thumbnailLink ?? null,
        parents: f.parents ?? null,
        isFolder: f.mimeType === "application/vnd.google-apps.folder",
      }),
    );

    return {
      items,
      nextPageToken: response.data.nextPageToken ?? null,
    };
  },
});

export const navigate = action({
  args: {
    folderId: v.string(),
    driveId: v.optional(v.string()),
    pageToken: v.optional(v.string()),
    pageSize: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    items: DriveItem[];
    breadcrumbs: Breadcrumb[];
    currentFolder: {
      id: string;
      name: string;
      mimeType: string;
      isFolder: boolean;
    };
    nextPageToken: string | null;
  }> => {
    const { drive } = await getAuthenticatedDriveClient(ctx);

    const folderData = await drive.files.get({
      fileId: args.folderId,
      fields: "id,name,parents",
      supportsAllDrives: true,
    });

    const currentFolder = {
      id: folderData.data.id!,
      name: folderData.data.name!,
      mimeType: "application/vnd.google-apps.folder",
      isFolder: true,
    };

    const breadcrumbs: Breadcrumb[] = [];
    let parentId: string | null = folderData.data.parents?.[0] ?? null;

    while (parentId) {
      try {
        const parent = await drive.files.get({
          fileId: parentId,
          fields: "id,name,parents",
          supportsAllDrives: true,
        });

        breadcrumbs.unshift({
          id: parent.data.id!,
          name: parent.data.name!,
        });

        parentId = parent.data.parents?.[0] ?? null;
      } catch {
        break;
      }
    }

    breadcrumbs.push({
      id: args.folderId,
      name: currentFolder.name,
    });

    const filesResponse = (await ctx.runAction(api.actions.drive.listFiles, {
      folderId: args.folderId,
      driveId: args.driveId,
      pageToken: args.pageToken,
      pageSize: args.pageSize,
    })) as { items: DriveItem[]; nextPageToken: string | null };

    return {
      items: filesResponse.items,
      breadcrumbs,
      currentFolder,
      nextPageToken: filesResponse.nextPageToken,
    };
  },
});

export const getFile = action({
  args: {
    fileId: v.string(),
    driveId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { drive } = await getAuthenticatedDriveClient(ctx);

    const params: any = {
      fileId: args.fileId,
      fields:
        "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,iconLink,thumbnailLink,parents",
    };

    if (args.driveId) {
      params.supportsAllDrives = true;
    }

    const response = await drive.files.get(params);
    const f = response.data;

    return {
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType ?? "",
      size: f.size ? parseInt(f.size) : null,
      createdTime: f.createdTime ?? null,
      modifiedTime: f.modifiedTime ?? null,
      webViewLink: f.webViewLink ?? null,
      iconLink: f.iconLink ?? null,
      thumbnailLink: f.thumbnailLink ?? null,
      parents: f.parents ?? null,
      isFolder: f.mimeType === "application/vnd.google-apps.folder",
    };
  },
});

export const makeFilePublic = internalAction({
  args: {
    fileId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getById, {
      userId: args.userId,
    });
    if (!user || !user.googleAccessToken) {
      throw new Error("User not found or missing Google credentials");
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

    await drive.permissions.create({
      fileId: args.fileId,
      requestBody: {
        type: "anyone",
        role: "reader",
      },
      supportsAllDrives: true,
    });

    const downloadUrl = `https://drive.google.com/uc?id=${args.fileId}&export=download`;
    return downloadUrl;
  },
});

export const revokeFilePublicAccess = internalAction({
  args: {
    fileId: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getById, {
      userId: args.userId,
    });
    if (!user || !user.googleAccessToken) {
      throw new Error("User not found or missing Google credentials");
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

    const permissions = await drive.permissions.list({
      fileId: args.fileId,
      supportsAllDrives: true,
    });

    for (const perm of permissions.data.permissions ?? []) {
      if (perm.type === "anyone" && perm.id) {
        await drive.permissions.delete({
          fileId: args.fileId,
          permissionId: perm.id,
          supportsAllDrives: true,
        });
      }
    }
  },
});

// Timeout constants for large file operations
const DRIVE_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes for Drive API response
const STREAM_IDLE_TIMEOUT_MS = 60 * 1000; // 1 minute without data = timeout

export const downloadAndUploadToGcs = internalAction({
  args: {
    fileId: v.string(),
    fileName: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<string> => {
    const startTime = Date.now();
    const MAX_RETRIES = 3;

    console.log(`\n${"=".repeat(80)}`);
    console.log(`STREAMING UPLOAD: ${args.fileName}`);
    console.log(`File ID: ${args.fileId}`);
    console.log(`Method: Direct streaming (memory-efficient)`);
    console.log(`${"=".repeat(80)}`);

    const user = await ctx.runQuery(internal.users.getById, {
      userId: args.userId,
    });
    if (!user || !user.googleAccessToken) {
      throw new Error("User not found or missing Google credentials");
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

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    let storage: Storage;
    try {
      storage = getGcsStorage();
    } catch (error: any) {
      console.error(`GCS credentials error:`, error.message);
      throw error;
    }

    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("GCS_BUCKET_NAME not configured");
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = args.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const gcsFileName = `temp/${timestamp}_${randomSuffix}_${sanitizedFileName}`;

    const bucket = storage.bucket(bucketName);
    const gcsFile = bucket.file(gcsFileName);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const attemptStart = Date.now();
      console.log(`\nStream attempt ${attempt}/${MAX_RETRIES}...`);

      try {
        console.log(
          `[${new Date().toISOString()}] Requesting stream from Google Drive...`,
        );
        const downloadStart = Date.now();

        const driveResponse = await Promise.race([
          drive.files.get(
            { fileId: args.fileId, alt: "media", supportsAllDrives: true },
            { responseType: "stream" },
          ),
          new Promise<never>((_, reject) =>
            setTimeout(
              () =>
                reject(
                  new Error(
                    `Drive API timeout after ${DRIVE_DOWNLOAD_TIMEOUT_MS / 1000}s - file may be too large or network is slow`,
                  ),
                ),
              DRIVE_DOWNLOAD_TIMEOUT_MS,
            ),
          ),
        ]);

        console.log(
          `[${new Date().toISOString()}] Got stream from Drive API in ${Date.now() - downloadStart}ms, piping to GCS...`,
        );

        const gcsWriteStream = gcsFile.createWriteStream({
          resumable: true,
          metadata: {
            contentType:
              driveResponse.headers?.["content-type"] ||
              "application/octet-stream",
            metadata: {
              originalFileName: args.fileName,
              uploadedAt: new Date().toISOString(),
            },
          },
        });

        const bytesTransferred = await new Promise<number>(
          (resolve, reject) => {
            let transferred = 0;
            let lastLoggedMB = 0;
            let lastDataTime = Date.now();

            const driveStream = driveResponse.data as NodeJS.ReadableStream;

            const idleChecker = setInterval(() => {
              const idleTime = Date.now() - lastDataTime;
              if (idleTime > STREAM_IDLE_TIMEOUT_MS) {
                clearInterval(idleChecker);
                const errorMsg = `Stream idle timeout - no data received for ${STREAM_IDLE_TIMEOUT_MS / 1000}s (transferred ${formatBytes(transferred)} so far)`;
                console.error(`[${new Date().toISOString()}] ${errorMsg}`);
                reject(new Error(errorMsg));
              }
            }, 10000);

            driveStream
              .on("data", (chunk: Buffer) => {
                lastDataTime = Date.now();
                transferred += chunk.length;
                const currentMB = Math.floor(transferred / (20 * 1024 * 1024));
                if (currentMB > lastLoggedMB) {
                  lastLoggedMB = currentMB;
                  console.log(
                    `  [${new Date().toISOString()}] Streamed ${formatBytes(transferred)}...`,
                  );
                }
              })
              .on("error", (err: Error) => {
                clearInterval(idleChecker);
                console.error(
                  `[${new Date().toISOString()}] Drive stream error:`,
                  err.message,
                );
                reject(new Error(`Drive stream error: ${err.message}`));
              })
              .pipe(gcsWriteStream)
              .on("error", (err: Error) => {
                clearInterval(idleChecker);
                console.error(
                  `[${new Date().toISOString()}] GCS stream error:`,
                  err.message,
                );
                reject(new Error(`GCS stream error: ${err.message}`));
              })
              .on("finish", () => {
                clearInterval(idleChecker);
                console.log(
                  `[${new Date().toISOString()}] Stream completed successfully`,
                );
                resolve(transferred);
              });
          },
        );

        const duration = (Date.now() - attemptStart) / 1000;
        const totalDuration = (Date.now() - startTime) / 1000;
        const speedMBps = bytesTransferred / 1024 / 1024 / duration;

        console.log(`\n${"=".repeat(80)}`);
        console.log(`✓ SUCCESS: ${args.fileName}`);
        console.log(`  Size: ${formatBytes(bytesTransferred)}`);
        console.log(`  GCS path: ${gcsFileName}`);
        console.log(
          `  Duration: ${duration.toFixed(1)}s (${speedMBps.toFixed(2)} MB/s)`,
        );
        console.log(`  Total time: ${totalDuration.toFixed(1)}s`);
        console.log(`${"=".repeat(80)}\n`);

        return gcsFileName;
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error.message);

        if (attempt < MAX_RETRIES) {
          const delay = 2000 * Math.pow(2, attempt - 1);
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    const totalDuration = (Date.now() - startTime) / 1000;
    console.error(`\n${"=".repeat(80)}`);
    console.error(`✗ FAILED: ${args.fileName}`);
    console.error(`  Attempts: ${MAX_RETRIES}`);
    console.error(`  Total time: ${totalDuration.toFixed(1)}s`);
    console.error(`  Error: ${lastError?.message}`);
    console.error(`${"=".repeat(80)}\n`);

    throw new Error(
      `GCS streaming upload failed after ${MAX_RETRIES} attempts: ${lastError?.message}`,
    );
  },
});
