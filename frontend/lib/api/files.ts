/**
 * File Upload API
 *
 * Step 1 of the 2-step file upload flow: send the raw file to the backend
 * (nginx / server.py) and get back a filesystem path. Step 2 happens in
 * useStreamHandler, which tells the agent where to find the file so it can
 * use `read_file` (or another filesystem tool) instead of us inlining the
 * file's full contents into the prompt.
 *
 * Contract with the backend: `POST /uploadFile` as multipart/form-data with
 * the file under the `file` field. Response parsing below tolerates a few
 * reasonable shapes (`{ path }`, `{ file_path }`, a bare path string, or a
 * `["path"]` array) since the exact server.py response isn't finalized yet —
 * adjust `extractPath` if the real contract differs.
 */

export interface UploadedFile {
  path: string
}

function extractPath(body: unknown): string | null {
  if (typeof body === "string" && body.trim()) return body.trim()
  if (Array.isArray(body) && typeof body[0] === "string" && body[0].trim()) {
    return body[0].trim()
  }
  if (body && typeof body === "object") {
    const candidate =
      (body as any).path ?? (body as any).file_path ?? (body as any).filePath ?? (body as any).url
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim()
  }
  return null
}

/**
 * Upload a single file to the backend and return the path the agent can use
 * to read it back via a filesystem tool.
 *
 * @throws Error if the upload fails or the response doesn't contain a path
 */
export async function uploadFile(file: File, signal?: AbortSignal): Promise<UploadedFile> {
  const formData = new FormData()
  formData.append("file", file, file.name)

  const response = await fetch("/uploadFile", {
    method: "POST",
    body: formData,
    signal,
  })

  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`)
  }

  const body = await response.json().catch(() => null)
  const path = extractPath(body)

  if (!path) {
    throw new Error("Upload succeeded but no file path was returned")
  }

  return { path }
}
