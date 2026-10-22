/**
 * Cloudinary photo storage. The app uploads straight to Cloudinary with a short-lived signature from
 * this server; only the https URL is stored in MongoDB (on the homestay), keeping the database small.
 */

import crypto from "crypto";

/**
 * Cloudinary upload signature: every signed param as `name=value`, sorted by name, joined with `&`,
 * the API secret appended, SHA-1 hex. (file, api_key, cloud_name, resource_type are never signed.)
 * https://cloudinary.com/documentation/authentication_signatures
 */
export function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
}

export class CloudinaryService {
  // Read at call time, not import time, so the values loaded by dotenv are always seen
  private static get cloudName() {
    return process.env.CLOUDINARY_CLOUD_NAME || "";
  }
  private static get apiKey() {
    return process.env.CLOUDINARY_API_KEY || "";
  }
  private static get apiSecret() {
    return process.env.CLOUDINARY_API_SECRET || "";
  }

  public static isConfigured(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  /** URL prefix of images stored in this account; anything else is refused as a homestay photo. */
  public static deliveryPrefix(): string {
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/`;
  }

  /**
   * Signed params for one direct upload from the app (valid 1 hour per Cloudinary). The stored image
   * is capped at 1600 px wide and only photo formats are accepted.
   */
  public static getDirectUploadSignature(folder: string) {
    const params = {
      allowed_formats: "jpg,jpeg,png,webp,heic,heif",
      folder,
      timestamp: Math.floor(Date.now() / 1000),
      transformation: "c_limit,w_1600",
    };
    return {
      ...params,
      apiKey: this.apiKey,
      signature: signParams(params, this.apiSecret),
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
    };
  }
}
