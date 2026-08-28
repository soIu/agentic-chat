/**
 * Image Types
 *
 * Type definitions for image attachments.
 */

/**
 * Represents an image attachment in a message.
 */
export interface ImageAttachment {
  id: string
  url?: string // URL for displaying the image
  base64?: string // Base64-encoded image data
  mimeType: string // e.g., "image/png", "image/jpeg"
  name?: string // Original filename
  size?: number // File size in bytes
  textLength?: number // Character count for non-image text/code files

  // 2-step upload state (non-image files only): the file is uploaded to the
  // backend as soon as it's attached, and the agent is told to read it from
  // `path` via a filesystem tool instead of receiving inlined file content.
  uploadStatus?: "uploading" | "uploaded" | "error"
  path?: string // Backend filesystem path, set once uploadStatus === "uploaded"
  uploadErrorMessage?: string
}

