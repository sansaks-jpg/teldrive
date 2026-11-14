-- name: ListFileVersions :many
SELECT *
FROM /* TEMPLATE: schema */file_versions
WHERE file_id = sqlc.arg(file_id)
  AND user_id = sqlc.arg(user_id)
ORDER BY version_number DESC, id DESC;

-- name: GetFileVersion :one
SELECT *
FROM /* TEMPLATE: schema */file_versions
WHERE id = sqlc.arg(version_id)
  AND file_id = sqlc.arg(file_id)
  AND user_id = sqlc.arg(user_id);

-- name: GetNextFileVersionNumber :one
SELECT (COALESCE(max(version_number), 0) + 1)::integer AS next_version
FROM /* TEMPLATE: schema */file_versions
WHERE file_id = sqlc.arg(file_id);

-- name: InsertFileVersion :one
INSERT INTO /* TEMPLATE: schema */file_versions (
    id,
    file_id,
    user_id,
    version_number,
    name,
    mime_type,
    size,
    hash_algorithm,
    hash_value,
    encryption,
    encryption_key_version,
    created_by
) VALUES (
    sqlc.arg(id),
    sqlc.arg(file_id),
    sqlc.arg(user_id),
    sqlc.arg(version_number),
    sqlc.arg(name),
    sqlc.narg(mime_type),
    sqlc.arg(size),
    sqlc.narg(hash_algorithm),
    sqlc.narg(hash_value),
    sqlc.arg(encryption),
    sqlc.narg(encryption_key_version),
    sqlc.narg(created_by)
)
RETURNING *;

-- name: CopyFilePartsToVersion :execrows
INSERT INTO /* TEMPLATE: schema */file_version_parts (
    version_id,
    part_no,
    channel_id,
    message_id,
    plain_size,
    stored_size,
    checksum,
    salt,
    block_hashes
)
SELECT
    sqlc.arg(version_id),
    fp.part_no,
    fp.channel_id,
    fp.message_id,
    fp.plain_size,
    fp.stored_size,
    fp.checksum,
    fp.salt,
    fp.block_hashes
FROM /* TEMPLATE: schema */file_parts fp
WHERE fp.file_id = sqlc.arg(file_id);

-- name: DeleteFilePartsForRestore :exec
DELETE FROM /* TEMPLATE: schema */file_parts
WHERE file_id = sqlc.arg(file_id);

-- name: RestoreFileFromVersion :one
UPDATE /* TEMPLATE: schema */files
SET name = sqlc.arg(name),
    mime_type = sqlc.narg(mime_type),
    size = sqlc.arg(size),
    hash_algorithm = sqlc.narg(hash_algorithm),
    hash_value = sqlc.narg(hash_value),
    encryption = sqlc.arg(encryption),
    encryption_key_version = sqlc.narg(encryption_key_version),
    generation = generation + 1,
    updated_at = now()
WHERE id = sqlc.arg(file_id)
  AND user_id = sqlc.arg(user_id)
  AND kind = 'file'
  AND status = 'active'
RETURNING *;

-- name: CopyVersionPartsToFile :execrows
INSERT INTO /* TEMPLATE: schema */file_parts (
    file_id,
    part_no,
    channel_id,
    message_id,
    plain_size,
    stored_size,
    checksum,
    salt,
    block_hashes
)
SELECT
    sqlc.arg(file_id),
    vp.part_no,
    vp.channel_id,
    vp.message_id,
    vp.plain_size,
    vp.stored_size,
    vp.checksum,
    vp.salt,
    vp.block_hashes
FROM /* TEMPLATE: schema */file_version_parts vp
WHERE vp.version_id = sqlc.arg(version_id);
