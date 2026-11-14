-- +goose NO TRANSACTION
-- +goose Up

ALTER TYPE /* TEMPLATE: schema */share_permission ADD VALUE IF NOT EXISTS 'comment';
ALTER TYPE /* TEMPLATE: schema */share_permission ADD VALUE IF NOT EXISTS 'upload';

ALTER TABLE /* TEMPLATE: schema */users
    ADD COLUMN IF NOT EXISTS storage_quota_bytes BIGINT;

ALTER TABLE /* TEMPLATE: schema */users
    DROP CONSTRAINT IF EXISTS users_storage_quota_nonnegative;

ALTER TABLE /* TEMPLATE: schema */users
    ADD CONSTRAINT users_storage_quota_nonnegative CHECK (
        storage_quota_bytes IS NULL OR storage_quota_bytes >= 0
    );

CREATE TABLE IF NOT EXISTS /* TEMPLATE: schema */file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES /* TEMPLATE: schema */files(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES /* TEMPLATE: schema */users(user_id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT,
    size BIGINT NOT NULL CHECK (size >= 0),
    hash_algorithm TEXT,
    hash_value TEXT,
    encryption BOOLEAN NOT NULL DEFAULT FALSE,
    encryption_key_version INTEGER,
    created_by BIGINT REFERENCES /* TEMPLATE: schema */users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (file_id, version_number),
    CONSTRAINT file_versions_encryption_key_check CHECK (
        (NOT encryption AND encryption_key_version IS NULL)
        OR
        (encryption AND encryption_key_version IS NOT NULL)
    ),
    CONSTRAINT file_versions_hash_pair_check CHECK (
        (hash_algorithm IS NULL AND hash_value IS NULL)
        OR
        (hash_algorithm IS NOT NULL AND hash_value IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS file_versions_file_created_idx
    ON /* TEMPLATE: schema */file_versions (file_id, version_number DESC, id);

CREATE TABLE IF NOT EXISTS /* TEMPLATE: schema */file_version_parts (
    version_id UUID NOT NULL REFERENCES /* TEMPLATE: schema */file_versions(id) ON DELETE CASCADE,
    part_no INTEGER NOT NULL,
    channel_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    plain_size BIGINT,
    stored_size BIGINT,
    checksum TEXT,
    salt TEXT,
    block_hashes BYTEA,
    PRIMARY KEY (version_id, part_no),
    CONSTRAINT file_version_parts_part_no_positive CHECK (part_no > 0),
    CONSTRAINT file_version_parts_plain_size_nonnegative CHECK (plain_size IS NULL OR plain_size >= 0),
    CONSTRAINT file_version_parts_stored_size_nonnegative CHECK (stored_size IS NULL OR stored_size >= 0)
);

CREATE TABLE IF NOT EXISTS /* TEMPLATE: schema */media_metadata (
    file_id UUID PRIMARY KEY REFERENCES /* TEMPLATE: schema */files(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES /* TEMPLATE: schema */users(user_id) ON DELETE CASCADE,
    taken_at TIMESTAMPTZ,
    width INTEGER,
    height INTEGER,
    duration_seconds DOUBLE PRECISION,
    camera_make TEXT,
    camera_model TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    favorite BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_metadata_user_taken_idx
    ON /* TEMPLATE: schema */media_metadata (user_id, taken_at DESC, file_id);

CREATE TABLE IF NOT EXISTS /* TEMPLATE: schema */photo_albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL REFERENCES /* TEMPLATE: schema */users(user_id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    cover_file_id UUID REFERENCES /* TEMPLATE: schema */files(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT photo_albums_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS photo_albums_user_created_idx
    ON /* TEMPLATE: schema */photo_albums (user_id, created_at DESC, id);

CREATE TABLE IF NOT EXISTS /* TEMPLATE: schema */photo_album_items (
    album_id UUID NOT NULL REFERENCES /* TEMPLATE: schema */photo_albums(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES /* TEMPLATE: schema */files(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (album_id, file_id)
);

CREATE TABLE IF NOT EXISTS /* TEMPLATE: schema */workspace_documents (
    file_id UUID PRIMARY KEY REFERENCES /* TEMPLATE: schema */files(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES /* TEMPLATE: schema */users(user_id) ON DELETE CASCADE,
    doc_type TEXT NOT NULL CHECK (doc_type IN ('doc', 'sheet')),
    content TEXT NOT NULL DEFAULT '',
    updated_by BIGINT REFERENCES /* TEMPLATE: schema */users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_documents_user_updated_idx
    ON /* TEMPLATE: schema */workspace_documents (user_id, updated_at DESC, file_id);

-- +goose Down

DROP TABLE IF EXISTS /* TEMPLATE: schema */workspace_documents;
DROP INDEX IF EXISTS /* TEMPLATE: schema */workspace_documents_user_updated_idx;
DROP TABLE IF EXISTS /* TEMPLATE: schema */photo_album_items;
DROP INDEX IF EXISTS /* TEMPLATE: schema */photo_albums_user_created_idx;
DROP TABLE IF EXISTS /* TEMPLATE: schema */photo_albums;
DROP INDEX IF EXISTS /* TEMPLATE: schema */media_metadata_user_taken_idx;
DROP TABLE IF EXISTS /* TEMPLATE: schema */media_metadata;

DROP TABLE IF EXISTS /* TEMPLATE: schema */file_version_parts;
DROP INDEX IF EXISTS /* TEMPLATE: schema */file_versions_file_created_idx;
DROP TABLE IF EXISTS /* TEMPLATE: schema */file_versions;

ALTER TABLE /* TEMPLATE: schema */users
    DROP CONSTRAINT IF EXISTS users_storage_quota_nonnegative;

ALTER TABLE /* TEMPLATE: schema */users
    DROP COLUMN IF EXISTS storage_quota_bytes;
