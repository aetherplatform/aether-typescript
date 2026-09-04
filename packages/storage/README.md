# Aether Storage SDK Preview

Typed control-plane operations plus direct upload and download helpers. Object
bytes travel directly to the provider URL and never through the Aether control
plane.

`uploadObject` validates the source size, creates the upload intent, performs a
single-part or bounded-concurrency multipart transfer, completes the upload,
and best-effort aborts an incomplete provider upload when transfer or completion
fails. Callers need `storage:objects/*:delete` if they want automatic abort
cleanup in addition to upload capabilities.

`waitForObjectAvailable` polls asynchronous quarantine/scanning state with a
bounded timeout and abort signal. `StorageClient.iterateObjects` follows search
cursors while rejecting repeated cursors and unbounded page traversal.
