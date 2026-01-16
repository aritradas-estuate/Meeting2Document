/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_drive from "../actions/drive.js";
import type * as actions_extraction from "../actions/extraction.js";
import type * as actions_gcs from "../actions/gcs.js";
import type * as actions_transcription from "../actions/transcription.js";
import type * as auth from "../auth.js";
import type * as documents from "../documents.js";
import type * as http from "../http.js";
import type * as jobs from "../jobs.js";
import type * as keyIdeas from "../keyIdeas.js";
import type * as lib_prompts from "../lib/prompts.js";
import type * as projects from "../projects.js";
import type * as transcripts from "../transcripts.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/drive": typeof actions_drive;
  "actions/extraction": typeof actions_extraction;
  "actions/gcs": typeof actions_gcs;
  "actions/transcription": typeof actions_transcription;
  auth: typeof auth;
  documents: typeof documents;
  http: typeof http;
  jobs: typeof jobs;
  keyIdeas: typeof keyIdeas;
  "lib/prompts": typeof lib_prompts;
  projects: typeof projects;
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
