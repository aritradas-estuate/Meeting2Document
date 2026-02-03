"use node";

import { action } from "../_generated/server";

/**
 * Get the public URL for the 66degrees logo
 * 
 * The logo is stored in Frontend/public/66degrees-logo.svg
 * and is served by the Vite dev server or production build.
 * 
 * During development: http://localhost:3000/66degrees-logo.svg
 * In production: https://<frontend-domain>/66degrees-logo.svg
 * 
 * This action returns the appropriate URL based on the environment.
 */
export const getLogoUrl = action({
  args: {},
  handler: async (ctx) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    
    const logoUrl = `${frontendUrl}/66degrees-logo.svg`;
    
    return {
      logoUrl,
      filename: "66degrees-logo.svg",
      mimeType: "image/svg+xml",
      description: "66degrees company logo with brand colors (Red #C41E3A, Teal #5CBFB3)",
    };
  },
});
