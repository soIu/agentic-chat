/**
 * File Validation Utilities
 *
 * Functions for validating files before upload.
 */

import { generateMessageId } from "./message-helpers"
import type { ImageAttachment } from "../../types"

/**
 * Convert a File object to a base64 string.
 * Used for encoding images before sending to the backend.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remove the data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Create an ImageAttachment from a File object.
 * Converts the file to base64 and creates a preview URL.
 */
export const createImageAttachment = async (file: File): Promise<ImageAttachment> => {
  const base64 = await fileToBase64(file)
  const url = URL.createObjectURL(file)

  return {
    id: generateMessageId(),
    base64,
    url,
    mimeType: file.type,
    name: file.name,
    size: file.size,
  }
}

/**
 * Validate if a file is within size limits.
 *
 * No extension/mimetype allowlist: with the 2-step upload flow, non-image
 * files are uploaded to the backend as-is and the agent reads them itself
 * via the read_file tool, so the frontend doesn't need to gatekeep by file
 * type. Images still go through the inline base64 path.
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // HAR files can be large network captures — allow up to 50MB.
  // Public CLC does not support HAR analysis; HAR files are ignored before streaming.
  // All other file types retain the original 10MB limit.
  const isHar = file.name.toLowerCase().endsWith(".har")
  const maxSize = isHar ? 50 * 1024 * 1024 : 10 * 1024 * 1024
  const maxSizeLabel = isHar ? "50MB" : "10MB"
  if (file.size > maxSize) {
    return { valid: false, error: `File must be smaller than ${maxSizeLabel}` }
  }

  return { valid: true }
}

