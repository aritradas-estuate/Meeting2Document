"use node";

import { action, internalAction, ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { google, drive_v3 } from "googleapis";
import { getAuthUserId } from "@convex-dev/auth/server";

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

async function getAuthenticatedDriveClient(ctx: ActionCtx): Promise<{ drive: drive_v3.Drive; user: any }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Unauthorized");

  const user: any = await ctx.runQuery(internal.users.getById, { userId });

  if (!user) throw new Error("User not found");
  if (!user.googleAccessToken) {
    throw new Error("No Google Drive access token available. Please re-authenticate.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
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
      throw new Error("Failed to refresh Google token. Please re-authenticate.");
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
  handler: async (ctx, args): Promise<{ drives: SharedDrive[]; nextPageToken: string | null }> => {
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
  handler: async (ctx, args): Promise<{ items: DriveItem[]; nextPageToken: string | null }> => {
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
      "mimeType contains 'spreadsheet'",
      "mimeType contains 'presentation'",
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

    const items: DriveItem[] = (response.data.files ?? []).map((f: drive_v3.Schema$File) => ({
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
    }));

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
  handler: async (ctx, args): Promise<{
    items: DriveItem[];
    breadcrumbs: Breadcrumb[];
    currentFolder: { id: string; name: string; mimeType: string; isFolder: boolean };
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

    const filesResponse = await ctx.runAction(api.actions.drive.listFiles, {
      folderId: args.folderId,
      driveId: args.driveId,
      pageToken: args.pageToken,
      pageSize: args.pageSize,
    }) as { items: DriveItem[]; nextPageToken: string | null };

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
    const user = await ctx.runQuery(internal.users.getById, { userId: args.userId });
    if (!user || !user.googleAccessToken) {
      throw new Error("User not found or missing Google credentials");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
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
    const user = await ctx.runQuery(internal.users.getById, { userId: args.userId });
    if (!user || !user.googleAccessToken) {
      throw new Error("User not found or missing Google credentials");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
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
