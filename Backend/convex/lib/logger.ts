type LogLevel = "verbose" | "normal" | "minimal";

function getLogLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  if (level === "verbose" || level === "normal" || level === "minimal") {
    return level;
  }
  return "normal";
}

function shouldLog(requiredLevel: LogLevel): boolean {
  const currentLevel = getLogLevel();
  const levels: LogLevel[] = ["minimal", "normal", "verbose"];
  return levels.indexOf(currentLevel) >= levels.indexOf(requiredLevel);
}

const SEPARATOR = "=".repeat(80);
const SEPARATOR_LIGHT = "-".repeat(80);

export function logPipelineStart(
  name: string,
  id: string,
  context?: Record<string, any>,
): void {
  if (!shouldLog("normal")) return;

  console.log(`\n${SEPARATOR}`);
  console.log(`${name}: ${id}`);
  console.log(SEPARATOR);

  if (context && shouldLog("verbose")) {
    for (const [key, value] of Object.entries(context)) {
      console.log(`  ${key}: ${value}`);
    }
    console.log(SEPARATOR_LIGHT);
  }
}

export function logPipelineEnd(
  name: string,
  id: string,
  success: boolean,
  durationMs: number,
  details?: Record<string, any>,
): void {
  if (!shouldLog("minimal")) return;

  console.log(SEPARATOR);
  console.log(
    `${success ? "✓" : "✗"} ${name} ${success ? "SUCCESS" : "FAILED"}: ${id}`,
  );

  if (details && shouldLog("normal")) {
    for (const [key, value] of Object.entries(details)) {
      console.log(`  ${key}: ${value}`);
    }
  }

  console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`${SEPARATOR}\n`);
}

export function logStep(
  current: number,
  total: number,
  message: string,
  status?: "start" | "success" | "fail",
): void {
  if (!shouldLog("normal")) return;

  const prefix = `[Step ${current}/${total}]`;

  if (status === "success") {
    console.log(`${prefix} ✓ ${message}`);
  } else if (status === "fail") {
    console.log(`${prefix} ✗ ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export function logDetail(message: string, data?: any): void {
  if (!shouldLog("verbose")) return;

  console.log(`  ${message}`);
  if (data !== undefined) {
    if (typeof data === "object") {
      console.log(`    ${JSON.stringify(data)}`);
    } else {
      console.log(`    ${data}`);
    }
  }
}

export function logIteration(
  current: number,
  max: number,
  phase: string,
  message?: string,
): void {
  if (!shouldLog("normal")) return;

  const prefix = `[Iteration ${current}/${max}]`;
  console.log(`${prefix} ${phase}${message ? ` - ${message}` : ""}`);
}

export function logAICall(
  model: string,
  purpose: string,
  promptSizeChars?: number,
): void {
  if (!shouldLog("verbose")) return;

  console.log(`  Calling ${model}...`);
  if (promptSizeChars) {
    console.log(`    Purpose: ${purpose}`);
    console.log(`    Prompt size: ~${promptSizeChars.toLocaleString()} chars`);
  }
}

export function logAIResponse(
  model: string,
  success: boolean,
  durationMs: number,
  responseInfo?: string,
): void {
  if (!shouldLog("normal")) return;

  if (success) {
    console.log(
      `  ✓ ${model} response in ${(durationMs / 1000).toFixed(1)}s${responseInfo ? ` (${responseInfo})` : ""}`,
    );
  } else {
    console.log(`  ✗ ${model} failed after ${(durationMs / 1000).toFixed(1)}s`);
  }
}

export function logProgress(items: string[], prefix?: string): void {
  if (!shouldLog("verbose")) return;

  for (const item of items) {
    console.log(`  ${prefix || "-"} ${item}`);
  }
}

export function logError(
  context: string,
  error: any,
  requestPayload?: Record<string, any>,
): void {
  console.error(`\n${SEPARATOR}`);
  console.error(`ERROR in ${context}`);
  console.error(SEPARATOR);
  console.error(`  Message: ${error?.message || String(error)}`);

  if (error?.name) {
    console.error(`  Type: ${error.name}`);
  }

  if (error?.code) {
    console.error(`  Code: ${error.code}`);
  }

  if (requestPayload && shouldLog("verbose")) {
    const sanitized = sanitizePayload(requestPayload);
    console.error(`  Request Payload: ${JSON.stringify(sanitized, null, 2)}`);
  }

  if (error?.stack && shouldLog("normal")) {
    console.error(`  Stack Trace:`);
    const stackLines = error.stack.split("\n").slice(1, 6);
    for (const line of stackLines) {
      console.error(`    ${line.trim()}`);
    }
  }

  console.error(`${SEPARATOR}\n`);
}

function sanitizePayload(payload: Record<string, any>): Record<string, any> {
  const sensitiveKeys = [
    "apiKey",
    "api_key",
    "token",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
    "secret",
    "password",
    "authorization",
  ];

  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizePayload(value);
    } else if (typeof value === "string" && value.length > 500) {
      sanitized[key] =
        `${value.substring(0, 500)}... [truncated, ${value.length} chars total]`;
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function logSummary(title: string, items: Record<string, any>): void {
  if (!shouldLog("normal")) return;

  console.log(`\n  ${title}:`);
  for (const [key, value] of Object.entries(items)) {
    console.log(`    ${key}: ${value}`);
  }
}
