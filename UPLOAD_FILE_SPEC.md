# `/uploadFile` Endpoint Spec

This documents the contract the frontend expects from the backend (nginx / `server.py`)
for the file-attach feature. It's the "step 1" of the 2-step upload flow:

1. **Upload** — user attaches a non-image file → frontend immediately `POST`s it to
   `/uploadFile` → backend saves it and returns a path.
2. **Reference** — when the user sends their message, the frontend just tells the agent
   *where* the file is (that path) and asks it to read it with `read_file`, instead of
   dumping the file's content into the prompt.

Frontend code: `frontend/lib/api/files.ts` (calls the endpoint), used from
`frontend/lib/hooks/files/use-file-upload.ts`.

## Request

```
POST /uploadFile
Content-Type: multipart/form-data

file: <the uploaded file>
```

Same-origin call (no `/api` prefix, no auth header) — same pattern as the existing
`/getCurrentAgent` endpoint, proxied by nginx to `server.py`.

## Response

`200 OK` with JSON containing the path to the saved file:

```json
{ "path": "/some/real/path/on/disk/report.csv" }
```

Non-2xx status = upload failed; the frontend shows an error on the attachment and falls
back to sending the file's raw content inline instead.

## Assumption: real filesystem, no virtual FS

For now, assume `read_file` (and other filesystem tools the agent has) reads from a
**real path on disk** — not a `deepagents`-style virtual/in-memory filesystem. So:

- Save the uploaded file to a real path on the machine the agent runs on (or a mounted
  volume it can reach).
- Return that exact real path in `path` — the frontend passes it to the agent verbatim.

> Small remark for later: if the agent's `read_file` ever moves to a virtual filesystem
> (content stored in graph/thread state instead of disk), this endpoint would need to
> write into that state instead of/in addition to disk. Not needed right now — just
> flagging it so it's not a surprise later.

## Suggested (not required) basics

- Enforce a file size limit here (nginx `client_max_body_size` and/or in
  `server.py`) — the frontend no longer caps size or file type client-side,
  so this endpoint is the only gate. A rejected/oversized upload should
  return a non-2xx status; the frontend surfaces that as an error on the
  attachment.
- Sanitize/namespace the filename when saving (avoid path traversal, collisions).
- Clean up old uploads periodically.
