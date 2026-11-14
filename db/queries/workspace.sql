-- name: ListPhotoTimeline :many
SELECT
    f.id,
    f.user_id,
    f.parent_id,
    f.name,
    f.kind,
    f.mime_type,
    f.size,
    f.hash_algorithm,
    f.hash_value,
    f.encryption,
    f.encryption_key_version,
    f.status,
    f.mod_time,
    f.generation,
    f.created_at,
    f.updated_at,
    f.deleted_at,
    mm.taken_at,
    mm.width,
    mm.height,
    mm.camera_make,
    mm.camera_model,
    COALESCE(mm.favorite, FALSE)::boolean AS favorite
FROM /* TEMPLATE: schema */files f
LEFT JOIN /* TEMPLATE: schema */media_metadata mm ON mm.file_id = f.id
WHERE f.user_id = sqlc.arg(user_id)
  AND f.kind = 'file'
  AND f.status = 'active'
  AND (f.mime_type LIKE 'image/%' OR f.mime_type LIKE 'video/%')
  AND (NOT sqlc.arg(favorites_only)::boolean OR COALESCE(mm.favorite, FALSE))
  AND (
    sqlc.narg(album_id)::uuid IS NULL
    OR EXISTS (
      SELECT 1
      FROM /* TEMPLATE: schema */photo_album_items pai
      WHERE pai.album_id = sqlc.narg(album_id)::uuid
        AND pai.file_id = f.id
    )
  )
ORDER BY COALESCE(mm.taken_at, f.mod_time, f.created_at) DESC, f.id DESC
LIMIT sqlc.arg(page_size);

-- name: GetPhotoTimelineItem :one
SELECT
    f.id,
    f.user_id,
    f.parent_id,
    f.name,
    f.kind,
    f.mime_type,
    f.size,
    f.hash_algorithm,
    f.hash_value,
    f.encryption,
    f.encryption_key_version,
    f.status,
    f.mod_time,
    f.generation,
    f.created_at,
    f.updated_at,
    f.deleted_at,
    mm.taken_at,
    mm.width,
    mm.height,
    mm.camera_make,
    mm.camera_model,
    COALESCE(mm.favorite, FALSE)::boolean AS favorite
FROM /* TEMPLATE: schema */files f
LEFT JOIN /* TEMPLATE: schema */media_metadata mm ON mm.file_id = f.id
WHERE f.id = sqlc.arg(file_id)
  AND f.user_id = sqlc.arg(user_id)
  AND f.kind = 'file'
  AND f.status = 'active';

-- name: UpsertMediaMetadata :one
INSERT INTO /* TEMPLATE: schema */media_metadata (
    file_id,
    user_id,
    taken_at,
    width,
    height,
    camera_make,
    camera_model,
    favorite,
    updated_at
) VALUES (
    sqlc.arg(file_id),
    sqlc.arg(user_id),
    sqlc.narg(taken_at),
    sqlc.narg(width),
    sqlc.narg(height),
    sqlc.narg(camera_make),
    sqlc.narg(camera_model),
    COALESCE(sqlc.narg(favorite)::boolean, FALSE),
    now()
)
ON CONFLICT (file_id) DO UPDATE
SET taken_at = COALESCE(sqlc.narg(taken_at), media_metadata.taken_at),
    width = COALESCE(sqlc.narg(width), media_metadata.width),
    height = COALESCE(sqlc.narg(height), media_metadata.height),
    camera_make = COALESCE(sqlc.narg(camera_make), media_metadata.camera_make),
    camera_model = COALESCE(sqlc.narg(camera_model), media_metadata.camera_model),
    favorite = COALESCE(sqlc.narg(favorite)::boolean, media_metadata.favorite),
    updated_at = now()
RETURNING *;

-- name: ListPhotoAlbums :many
SELECT
    pa.id,
    pa.user_id,
    pa.name,
    pa.description,
    pa.cover_file_id,
    pa.created_at,
    pa.updated_at,
    count(pai.file_id)::bigint AS item_count
FROM /* TEMPLATE: schema */photo_albums pa
LEFT JOIN /* TEMPLATE: schema */photo_album_items pai ON pai.album_id = pa.id
WHERE pa.user_id = sqlc.arg(user_id)
GROUP BY pa.id, pa.user_id, pa.name, pa.description, pa.cover_file_id, pa.created_at, pa.updated_at
ORDER BY pa.created_at DESC, pa.id DESC;

-- name: GetPhotoAlbumForUser :one
SELECT *
FROM /* TEMPLATE: schema */photo_albums
WHERE id = sqlc.arg(album_id)
  AND user_id = sqlc.arg(user_id);

-- name: CreatePhotoAlbum :one
INSERT INTO /* TEMPLATE: schema */photo_albums (
    id,
    user_id,
    name,
    description
) VALUES (
    sqlc.arg(id),
    sqlc.arg(user_id),
    sqlc.arg(name),
    sqlc.narg(description)
)
RETURNING *;

-- name: DeletePhotoAlbum :execrows
DELETE FROM /* TEMPLATE: schema */photo_albums
WHERE id = sqlc.arg(album_id)
  AND user_id = sqlc.arg(user_id);

-- name: AddPhotoAlbumItem :exec
INSERT INTO /* TEMPLATE: schema */photo_album_items (album_id, file_id)
VALUES (sqlc.arg(album_id), sqlc.arg(file_id))
ON CONFLICT (album_id, file_id) DO NOTHING;

-- name: RemovePhotoAlbumItem :exec
DELETE FROM /* TEMPLATE: schema */photo_album_items
WHERE album_id = sqlc.arg(album_id)
  AND file_id = sqlc.arg(file_id);

-- name: CreateWorkspaceCatalogFile :one
INSERT INTO /* TEMPLATE: schema */files (
    id,
    user_id,
    parent_id,
    name,
    kind,
    mime_type,
    size,
    encryption,
    status,
    mod_time
) VALUES (
    sqlc.arg(id),
    sqlc.arg(user_id),
    sqlc.narg(parent_id),
    sqlc.arg(name),
    'file',
    sqlc.arg(mime_type),
    sqlc.arg(size),
    false,
    'active',
    sqlc.arg(mod_time)
)
RETURNING *;

-- name: UpsertWorkspaceDocument :one
INSERT INTO /* TEMPLATE: schema */workspace_documents (
    file_id,
    user_id,
    doc_type,
    content,
    updated_by,
    updated_at
) VALUES (
    sqlc.arg(file_id),
    sqlc.arg(user_id),
    sqlc.arg(doc_type),
    sqlc.arg(content),
    sqlc.narg(updated_by),
    now()
)
ON CONFLICT (file_id) DO UPDATE
SET content = EXCLUDED.content,
    updated_by = EXCLUDED.updated_by,
    updated_at = now()
RETURNING *;

-- name: UpdateWorkspaceFileSizeAndName :one
UPDATE /* TEMPLATE: schema */files
SET name = COALESCE(sqlc.narg(name)::text, name),
    size = sqlc.arg(size),
    mod_time = now(),
    generation = generation + 1,
    updated_at = now()
WHERE id = sqlc.arg(file_id)
  AND user_id = sqlc.arg(user_id)
  AND kind = 'file'
  AND status = 'active'
RETURNING *;

-- name: GetWorkspaceDocument :one
SELECT
    f.id AS file_id,
    f.user_id,
    f.parent_id,
    f.name,
    f.generation,
    COALESCE(f.size, 0)::bigint AS size,
    wd.doc_type,
    wd.content,
    wd.created_at,
    wd.updated_at
FROM /* TEMPLATE: schema */workspace_documents wd
JOIN /* TEMPLATE: schema */files f ON f.id = wd.file_id
WHERE wd.file_id = sqlc.arg(file_id)
  AND f.user_id = sqlc.arg(user_id)
  AND f.kind = 'file'
  AND f.status = 'active';

-- name: ListWorkspaceDocuments :many
SELECT
    f.id AS file_id,
    f.parent_id,
    f.name,
    COALESCE(f.size, 0)::bigint AS size,
    wd.doc_type,
    wd.created_at,
    wd.updated_at
FROM /* TEMPLATE: schema */workspace_documents wd
JOIN /* TEMPLATE: schema */files f ON f.id = wd.file_id
WHERE f.user_id = sqlc.arg(user_id)
  AND f.kind = 'file'
  AND f.status = 'active'
  AND (sqlc.narg(doc_type)::text IS NULL OR wd.doc_type = sqlc.narg(doc_type)::text)
  AND (
    sqlc.narg(search)::text IS NULL
    OR f.name ILIKE '%' || sqlc.narg(search)::text || '%'
    OR wd.content ILIKE '%' || sqlc.narg(search)::text || '%'
  )
ORDER BY wd.updated_at DESC, f.id DESC
LIMIT sqlc.arg(page_size);
