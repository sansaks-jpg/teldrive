-- name: AcquireUserBootstrapLock :exec
SELECT pg_advisory_xact_lock(846742351);

-- name: UpsertUser :one
INSERT INTO /* TEMPLATE: schema */users (
    user_id,
    display_name,
    username,
    premium,
    role
) VALUES (
    sqlc.arg(user_id),
    sqlc.narg(display_name),
    sqlc.narg(username),
    sqlc.arg(premium),
    CASE
        WHEN EXISTS (SELECT 1 FROM /* TEMPLATE: schema */users) THEN 'user'::/* TEMPLATE: schema */user_role
        ELSE 'owner'::/* TEMPLATE: schema */user_role
    END
)
ON CONFLICT (user_id) DO UPDATE
SET display_name = EXCLUDED.display_name,
    username = EXCLUDED.username,
    premium = EXCLUDED.premium,
    updated_at = now()
RETURNING *;

-- name: GetUser :one
SELECT *
FROM /* TEMPLATE: schema */users
WHERE user_id = sqlc.arg(user_id);

-- name: ListUsers :many
SELECT *
FROM /* TEMPLATE: schema */users
WHERE (
    sqlc.narg(search)::text IS NULL
    OR display_name ILIKE '%' || sqlc.narg(search)::text || '%'
    OR email ILIKE '%' || sqlc.narg(search)::text || '%'
    OR username ILIKE '%' || sqlc.narg(search)::text || '%'
    OR user_id::text = sqlc.narg(search)::text
)
ORDER BY created_at ASC, user_id ASC
LIMIT sqlc.arg(page_size);

-- name: UpdateUserRole :one
UPDATE /* TEMPLATE: schema */users
SET role = sqlc.arg(role), updated_at = now()
WHERE user_id = sqlc.arg(user_id)
  AND role <> 'owner'
  AND sqlc.arg(role)::/* TEMPLATE: schema */user_role IN ('admin', 'user')
RETURNING *;

-- name: SetUserDisabled :one
UPDATE /* TEMPLATE: schema */users
SET disabled_at = CASE WHEN sqlc.arg(disabled)::boolean THEN COALESCE(disabled_at, now()) ELSE NULL END,
    updated_at = now()
WHERE user_id = sqlc.arg(user_id)
  AND role <> 'owner'
RETURNING *;

-- name: UpdateUserStorageQuota :one
UPDATE /* TEMPLATE: schema */users
SET storage_quota_bytes = sqlc.narg(storage_quota_bytes)::bigint,
    updated_at = now()
WHERE user_id = sqlc.arg(user_id)
RETURNING *;

-- name: GetUserStorageUsage :one
SELECT
    u.storage_quota_bytes,
    COALESCE((
        SELECT sum(f.size)
        FROM /* TEMPLATE: schema */files f
        WHERE f.user_id = u.user_id
          AND f.kind = 'file'
          AND f.status IN ('active', 'trashed')
    ), 0)::bigint AS used_bytes
FROM /* TEMPLATE: schema */users u
WHERE u.user_id = sqlc.arg(user_id);

-- name: RevokeAllSessionsForUser :execrows
UPDATE /* TEMPLATE: schema */sessions
SET revoked_at = COALESCE(revoked_at, now())
WHERE user_id = sqlc.arg(user_id)
  AND revoked_at IS NULL;

-- name: RevokeAllAPIKeysForUser :execrows
UPDATE /* TEMPLATE: schema */api_keys
SET revoked_at = COALESCE(revoked_at, now())
WHERE user_id = sqlc.arg(user_id)
  AND revoked_at IS NULL;

-- name: CreateTelegramLoginFlow :one
INSERT INTO /* TEMPLATE: schema */telegram_login_flows (
    id,
    method,
    phone_number_ciphertext,
    telegram_state_ciphertext,
    password_required,
    expires_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(method),
    sqlc.narg(phone_number_ciphertext),
    sqlc.arg(telegram_state_ciphertext),
    sqlc.arg(password_required),
    sqlc.arg(expires_at)
)
RETURNING *;

-- name: GetTelegramLoginFlowForUpdate :one
SELECT *
FROM /* TEMPLATE: schema */telegram_login_flows
WHERE id = sqlc.arg(id)
  AND completed_at IS NULL
  AND expires_at > now()
FOR UPDATE;

-- name: UpdateTelegramLoginFlowState :one
UPDATE /* TEMPLATE: schema */telegram_login_flows
SET telegram_state_ciphertext = sqlc.arg(telegram_state_ciphertext),
    password_required = sqlc.arg(password_required)
WHERE id = sqlc.arg(id)
  AND completed_at IS NULL
  AND expires_at > now()
RETURNING *;

-- name: CompleteTelegramLoginFlow :one
UPDATE /* TEMPLATE: schema */telegram_login_flows
SET completed_at = now()
WHERE id = sqlc.arg(id)
  AND completed_at IS NULL
RETURNING *;

-- name: DeleteExpiredTelegramLoginFlows :execrows
DELETE FROM /* TEMPLATE: schema */telegram_login_flows
WHERE expires_at <= now();

-- name: CreateSession :one
INSERT INTO /* TEMPLATE: schema */sessions (
    id,
    user_id,
    telegram_session,
    refresh_token_hash,
    expires_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(user_id),
    sqlc.arg(telegram_session),
    sqlc.arg(refresh_token_hash),
    sqlc.arg(expires_at)
)
RETURNING *;

-- name: GetSessionByRefreshTokenHash :one
SELECT *
FROM /* TEMPLATE: schema */sessions
WHERE refresh_token_hash = sqlc.arg(refresh_token_hash)
  AND revoked_at IS NULL
  AND expires_at > now();

-- name: RotateSessionRefreshToken :one
UPDATE /* TEMPLATE: schema */sessions
SET refresh_token_hash = sqlc.arg(new_refresh_token_hash),
    last_used_at = now()
WHERE id = sqlc.arg(session_id)
  AND refresh_token_hash = sqlc.arg(old_refresh_token_hash)
  AND revoked_at IS NULL
  AND expires_at > now()
RETURNING *;

-- name: RevokeSession :execrows
UPDATE /* TEMPLATE: schema */sessions
SET revoked_at = COALESCE(revoked_at, now())
WHERE id = sqlc.arg(session_id)
  AND user_id = sqlc.arg(user_id);

-- name: ListSessions :many
SELECT *
FROM /* TEMPLATE: schema */sessions
WHERE user_id = sqlc.arg(user_id)
  AND revoked_at IS NULL
  AND expires_at > now()
  AND (
    sqlc.narg(after_created_at)::timestamptz IS NULL
    OR (created_at, id) < (
      sqlc.narg(after_created_at)::timestamptz,
      sqlc.narg(after_id)::uuid
    )
  )
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size);
-- name: CreateAPIKey :one
INSERT INTO /* TEMPLATE: schema */api_keys (
    id,
    user_id,
    name,
    key_prefix,
    secret_hash,
    expires_at
) VALUES (
    sqlc.arg(id),
    sqlc.arg(user_id),
    sqlc.arg(name),
    sqlc.arg(key_prefix),
    sqlc.arg(secret_hash),
    sqlc.narg(expires_at)
)
RETURNING *;

-- name: ListAPIKeys :many
SELECT *
FROM /* TEMPLATE: schema */api_keys
WHERE user_id = sqlc.arg(user_id)
  AND revoked_at IS NULL
  AND (
    sqlc.narg(after_created_at)::timestamptz IS NULL
    OR (created_at, id) < (
      sqlc.narg(after_created_at)::timestamptz,
      sqlc.narg(after_id)::uuid
    )
  )
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size);

-- name: GetActiveAPIKeyByHash :one
SELECT *
FROM /* TEMPLATE: schema */api_keys
WHERE secret_hash = sqlc.arg(secret_hash)
  AND revoked_at IS NULL
  AND (expires_at IS NULL OR expires_at > now());

-- name: TouchAPIKey :exec
UPDATE /* TEMPLATE: schema */api_keys
SET last_used_at = now()
WHERE id = sqlc.arg(id);

-- name: RevokeAPIKey :execrows
UPDATE /* TEMPLATE: schema */api_keys
SET revoked_at = now()
WHERE id = sqlc.arg(id)
  AND user_id = sqlc.arg(user_id)
  AND revoked_at IS NULL;

-- name: GetTelegramLoginFlow :one
SELECT *
FROM /* TEMPLATE: schema */telegram_login_flows
WHERE id = sqlc.arg(id)
  AND completed_at IS NULL
  AND expires_at > now();

-- name: GetActiveSession :one
SELECT *
FROM /* TEMPLATE: schema */sessions
WHERE id = sqlc.arg(session_id)
  AND user_id = sqlc.arg(user_id)
  AND revoked_at IS NULL
  AND expires_at > now();

-- name: GetLatestActiveSessionForUser :one
SELECT *
FROM /* TEMPLATE: schema */sessions
WHERE user_id = sqlc.arg(user_id)
  AND telegram_session IS NOT NULL
  AND length(telegram_session) > 0
  AND revoked_at IS NULL
  AND expires_at > now()
ORDER BY last_used_at DESC NULLS LAST, created_at DESC
LIMIT 1;

-- name: TouchSession :exec
UPDATE /* TEMPLATE: schema */sessions
SET last_used_at = now()
WHERE id = sqlc.arg(session_id)
  AND revoked_at IS NULL;

-- name: UpdateSessionTelegramSession :execrows
UPDATE /* TEMPLATE: schema */sessions
SET telegram_session = sqlc.arg(telegram_session),
    last_used_at = now()
WHERE id = sqlc.arg(session_id)
  AND revoked_at IS NULL
  AND expires_at > now();


-- name: SearchUsersForShare :many
SELECT *
FROM /* TEMPLATE: schema */users
WHERE user_id <> sqlc.arg(exclude_user_id)
  AND disabled_at IS NULL
  AND (
    display_name ILIKE '%' || sqlc.arg(search)::text || '%'
    OR email ILIKE '%' || sqlc.arg(search)::text || '%'
    OR username ILIKE '%' || sqlc.arg(search)::text || '%'
    OR user_id::text = sqlc.arg(search)::text
  )
ORDER BY email ASC NULLS LAST, username ASC NULLS LAST, display_name ASC NULLS LAST, user_id ASC
LIMIT sqlc.arg(page_size);

-- name: NextWorkspaceUserID :one
SELECT nextval('/* TEMPLATE: schema */workspace_user_id_seq')::bigint AS user_id;

-- name: CreatePasswordUser :one
INSERT INTO /* TEMPLATE: schema */users (
    user_id,
    email,
    password_hash,
    display_name,
    role,
    storage_quota_bytes
) VALUES (
    sqlc.arg(user_id),
    sqlc.arg(email),
    sqlc.arg(password_hash),
    sqlc.narg(display_name),
    sqlc.arg(role),
    sqlc.narg(storage_quota_bytes)
)
RETURNING *;

-- name: GetUserByEmail :one
SELECT *
FROM /* TEMPLATE: schema */users
WHERE lower(email) = lower(sqlc.arg(email))
LIMIT 1;

-- name: UpdateUserPassword :one
UPDATE /* TEMPLATE: schema */users
SET password_hash = sqlc.arg(password_hash),
    updated_at = now()
WHERE user_id = sqlc.arg(user_id)
RETURNING *;

-- name: UpdateUserAdminDetails :one
UPDATE /* TEMPLATE: schema */users
SET email = COALESCE(sqlc.narg(email)::text, email),
    display_name = COALESCE(sqlc.narg(display_name)::text, display_name),
    password_hash = COALESCE(sqlc.narg(password_hash)::text, password_hash),
    updated_at = now()
WHERE user_id = sqlc.arg(user_id)
RETURNING *;

-- name: GetWorkspaceOwner :one
SELECT *
FROM /* TEMPLATE: schema */users
WHERE role = 'owner'
ORDER BY created_at ASC, user_id ASC
LIMIT 1;

-- name: GetWorkspaceTelegram :one
SELECT *
FROM /* TEMPLATE: schema */workspace_telegram
WHERE id = 1;

-- name: UpsertWorkspaceTelegram :one
INSERT INTO /* TEMPLATE: schema */workspace_telegram (
    id,
    owner_user_id,
    telegram_user_id,
    phone_number_ciphertext,
    telegram_username,
    telegram_session,
    updated_at
) VALUES (
    1,
    sqlc.arg(owner_user_id),
    sqlc.arg(telegram_user_id),
    sqlc.narg(phone_number_ciphertext),
    sqlc.narg(telegram_username),
    sqlc.arg(telegram_session),
    now()
)
ON CONFLICT (id) DO UPDATE
SET owner_user_id = EXCLUDED.owner_user_id,
    telegram_user_id = EXCLUDED.telegram_user_id,
    phone_number_ciphertext = COALESCE(EXCLUDED.phone_number_ciphertext, /* TEMPLATE: schema */workspace_telegram.phone_number_ciphertext),
    telegram_username = EXCLUDED.telegram_username,
    telegram_session = EXCLUDED.telegram_session,
    updated_at = now()
RETURNING *;

-- name: UpdateWorkspaceTelegramSession :execrows
UPDATE /* TEMPLATE: schema */workspace_telegram
SET telegram_session = sqlc.arg(telegram_session),
    updated_at = now()
WHERE id = 1;
