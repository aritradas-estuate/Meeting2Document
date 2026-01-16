"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { Storage } from "@google-cloud/storage";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

function parsePrivateKey(rawKey: string): string {
  let key = rawKey;
  
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  
  if (key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }
  
  return key;
}

function validatePrivateKey(key: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    issues.push("Missing BEGIN PRIVATE KEY marker");
  }
  if (!key.includes("-----END PRIVATE KEY-----")) {
    issues.push("Missing END PRIVATE KEY marker");
  }
  if (!key.includes("\n")) {
    issues.push("No newlines found - key may be malformed");
  }
  
  const lines = key.split("\n").filter(l => l.trim());
  if (lines.length < 3) {
    issues.push(`Only ${lines.length} lines found - expected many more`);
  }
  
  return { valid: issues.length === 0, issues };
}

function getStorageClient(): Storage {
  const projectId = process.env.GCS_PROJECT_ID;
  const clientEmail = process.env.GCS_CLIENT_EMAIL;
  const rawPrivateKey = process.env.GCS_PRIVATE_KEY;
  const bucketName = process.env.GCS_BUCKET_NAME;

  console.log("GCS Config Check:", {
    bucketName: bucketName ? `✓ (${bucketName})` : "✗ MISSING",
    projectId: projectId ? `✓ (${projectId})` : "✗ MISSING",
    clientEmail: clientEmail ? `✓ (${clientEmail})` : "✗ MISSING",
    privateKeyLength: rawPrivateKey ? `✓ (${rawPrivateKey.length} chars)` : "✗ MISSING",
  });

  if (!projectId || !clientEmail || !rawPrivateKey) {
    const missing = [];
    if (!projectId) missing.push("GCS_PROJECT_ID");
    if (!clientEmail) missing.push("GCS_CLIENT_EMAIL");
    if (!rawPrivateKey) missing.push("GCS_PRIVATE_KEY");
    throw new Error(`GCS credentials missing: ${missing.join(", ")}`);
  }

  const privateKey = parsePrivateKey(rawPrivateKey);
  const validation = validatePrivateKey(privateKey);
  
  console.log("Private Key Validation:", {
    valid: validation.valid,
    issues: validation.issues.length > 0 ? validation.issues : "none",
    firstChars: privateKey.substring(0, 30) + "...",
    lastChars: "..." + privateKey.substring(privateKey.length - 30),
    lineCount: privateKey.split("\n").length,
  });

  if (!validation.valid) {
    throw new Error(`Invalid private key format: ${validation.issues.join(", ")}`);
  }

  return new Storage({
    projectId,
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
  });
}

function getBucketName(): string {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME environment variable not configured");
  }
  return bucketName;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logError(context: string, error: any) {
  console.error(`[GCS Error] ${context}:`, {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    errors: error.errors,
    name: error.name,
  });
}

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${operationName}: attempt ${attempt}/${maxRetries}...`);
      const result = await operation();
      console.log(`${operationName}: ✓ success on attempt ${attempt}`);
      return result;
    } catch (error: any) {
      lastError = error;
      logError(`${operationName} attempt ${attempt}/${maxRetries}`, error);

      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`${operationName}: retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(
    `${operationName} failed after ${maxRetries} attempts: ${lastError?.message}`
  );
}

export const testConnection = internalAction({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; message: string; details: any }> => {
    console.log("=== GCS Connection Test Started ===");
    
    try {
      console.log("[Test 1/4] Creating storage client...");
      const storage = getStorageClient();
      console.log("[Test 1/4] ✓ Storage client created");

      console.log("[Test 2/4] Getting bucket reference...");
      const bucketName = getBucketName();
      const bucket = storage.bucket(bucketName);
      console.log(`[Test 2/4] ✓ Bucket reference: ${bucketName}`);

      console.log("[Test 3/4] Checking bucket exists and is accessible...");
      const [bucketExists] = await bucket.exists();
      if (!bucketExists) {
        throw new Error(`Bucket '${bucketName}' does not exist or is not accessible`);
      }
      console.log("[Test 3/4] ✓ Bucket exists and is accessible");

      console.log("[Test 4/4] Testing file upload...");
      const testFileName = `test/connection-test-${Date.now()}.txt`;
      const testFile = bucket.file(testFileName);
      await testFile.save("GCS connection test", { resumable: false });
      console.log("[Test 4/4] ✓ Test file uploaded");

      console.log("[Cleanup] Deleting test file...");
      await testFile.delete();
      console.log("[Cleanup] ✓ Test file deleted");

      console.log("=== GCS Connection Test PASSED ===");
      return {
        success: true,
        message: "All GCS connection tests passed!",
        details: {
          bucket: bucketName,
          projectId: process.env.GCS_PROJECT_ID,
          clientEmail: process.env.GCS_CLIENT_EMAIL,
        },
      };
    } catch (error: any) {
      console.error("=== GCS Connection Test FAILED ===");
      logError("Connection test", error);
      
      return {
        success: false,
        message: error.message,
        details: {
          code: error.code,
          statusCode: error.statusCode,
          errors: error.errors,
        },
      };
    }
  },
});

export const uploadFile = internalAction({
  args: {
    fileName: v.string(),
    fileBufferBase64: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const startTime = Date.now();
    console.log(`=== GCS Upload Started: ${args.fileName} ===`);
    
    let storage: Storage;
    try {
      console.log("[Upload Step 1/5] Creating storage client...");
      storage = getStorageClient();
      console.log("[Upload Step 1/5] ✓ Storage client ready");
    } catch (error: any) {
      logError("Failed to create storage client", error);
      throw error;
    }

    const bucketName = getBucketName();
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = args.fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const gcsFileName = `temp/${timestamp}_${randomSuffix}_${sanitizedFileName}`;

    console.log("[Upload Step 2/5] Preparing upload:", {
      bucket: bucketName,
      destination: gcsFileName,
      base64Length: args.fileBufferBase64.length,
    });

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsFileName);

    console.log("[Upload Step 3/5] Decoding base64 buffer...");
    const buffer = Buffer.from(args.fileBufferBase64, "base64");
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    console.log(`[Upload Step 3/5] ✓ Decoded to ${fileSizeMB} MB`);

    console.log("[Upload Step 4/5] Uploading to GCS...");
    try {
      await withRetry(async () => {
        await file.save(buffer, {
          resumable: true,
          timeout: 300000,
          metadata: {
            contentType: "application/octet-stream",
            metadata: {
              originalFileName: args.fileName,
              uploadedAt: new Date().toISOString(),
            },
          },
        });
      }, "GCS file upload");
    } catch (error: any) {
      logError("Upload failed", error);
      throw new Error(`GCS upload failed: ${error.message}`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Upload Step 5/5] ✓ Upload complete in ${duration}s`);
    console.log(`=== GCS Upload Finished: ${gcsFileName} ===`);

    return gcsFileName;
  },
});

export const generateSignedUrl = internalAction({
  args: {
    gcsFileName: v.string(),
    expirationMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<string> => {
    console.log(`=== Generating Signed URL: ${args.gcsFileName} ===`);
    
    let storage: Storage;
    try {
      storage = getStorageClient();
    } catch (error: any) {
      logError("Failed to create storage client for signed URL", error);
      throw error;
    }

    const bucketName = getBucketName();
    const DEFAULT_EXPIRATION_MINUTES = 120;
    const expirationMinutes = args.expirationMinutes ?? DEFAULT_EXPIRATION_MINUTES;
    const expirationMs = expirationMinutes * 60 * 1000;

    const bucket = storage.bucket(bucketName);
    const file = bucket.file(args.gcsFileName);

    try {
      const [signedUrl] = await withRetry(async () => {
        return await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + expirationMs,
        });
      }, "Generate signed URL");

      console.log(`✓ Signed URL generated (expires in ${expirationMinutes} min)`);
      return signedUrl;
    } catch (error: any) {
      logError("Failed to generate signed URL", error);
      throw new Error(`Signed URL generation failed: ${error.message}`);
    }
  },
});

export const deleteFile = internalAction({
  args: {
    gcsFileName: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    console.log(`=== Deleting GCS file: ${args.gcsFileName} ===`);
    
    let storage: Storage;
    try {
      storage = getStorageClient();
    } catch (error: any) {
      logError("Failed to create storage client for delete", error);
      return;
    }

    const bucketName = getBucketName();
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(args.gcsFileName);

    try {
      const [exists] = await file.exists();

      if (!exists) {
        console.log(`File ${args.gcsFileName} does not exist, skipping delete`);
        return;
      }

      await file.delete();
      console.log(`✓ Deleted ${args.gcsFileName} from GCS`);
    } catch (error: any) {
      logError("Delete failed (lifecycle policy will clean up)", error);
    }
  },
});

export const checkFileExists = internalAction({
  args: {
    gcsFileName: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    try {
      const storage = getStorageClient();
      const bucketName = getBucketName();
      const bucket = storage.bucket(bucketName);
      const file = bucket.file(args.gcsFileName);
      const [exists] = await file.exists();
      return exists;
    } catch (error: any) {
      logError("Check file exists failed", error);
      return false;
    }
  },
});
