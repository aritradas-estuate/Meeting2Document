/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_assembly from "../actions/assembly.js";
import type * as actions_assets from "../actions/assets.js";
import type * as actions_contentExtraction from "../actions/contentExtraction.js";
import type * as actions_drive from "../actions/drive.js";
import type * as actions_export from "../actions/export.js";
import type * as actions_extraction from "../actions/extraction.js";
import type * as actions_gcs from "../actions/gcs.js";
import type * as actions_generation from "../actions/generation.js";
import type * as actions_synthesis from "../actions/synthesis.js";
import type * as actions_transcription from "../actions/transcription.js";
import type * as auth from "../auth.js";
import type * as documentGenerations from "../documentGenerations.js";
import type * as documents from "../documents.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as keyIdeas from "../keyIdeas.js";
import type * as lib_logger from "../lib/logger.js";
import type * as lib_promptBuilder from "../lib/promptBuilder.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as lib_sectionSchema from "../lib/sectionSchema.js";
import type * as lib_templateLoader from "../lib/templateLoader.js";
import type * as projects from "../projects.js";
import type * as sourceContent from "../sourceContent.js";
import type * as transcripts from "../transcripts.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/assembly": typeof actions_assembly;
  "actions/assets": typeof actions_assets;
  "actions/contentExtraction": typeof actions_contentExtraction;
  "actions/drive": typeof actions_drive;
  "actions/export": typeof actions_export;
  "actions/extraction": typeof actions_extraction;
  "actions/gcs": typeof actions_gcs;
  "actions/generation": typeof actions_generation;
  "actions/synthesis": typeof actions_synthesis;
  "actions/transcription": typeof actions_transcription;
  auth: typeof auth;
  documentGenerations: typeof documentGenerations;
  documents: typeof documents;
  http: typeof http;
  jobs: typeof jobs;
  keyIdeas: typeof keyIdeas;
  "lib/logger": typeof lib_logger;
  "lib/promptBuilder": typeof lib_promptBuilder;
  "lib/prompts": typeof lib_prompts;
  "lib/sectionSchema": typeof lib_sectionSchema;
  "lib/templateLoader": typeof lib_templateLoader;
  projects: typeof projects;
  sourceContent: typeof sourceContent;
  transcripts: typeof transcripts;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
