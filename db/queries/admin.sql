-- name: GetAdminOverview :one
SELECT
    (SELECT count(*) FROM /* TEMPLATE: schema */users)::bigint AS total_users,
    (SELECT count(*) FROM /* TEMPLATE: schema */users WHERE disabled_at IS NOT NULL)::bigint AS disabled_users,
    (SELECT count(*) FROM /* TEMPLATE: schema */files WHERE kind = 'file' AND status = 'active')::bigint AS total_active_files,
    COALESCE((SELECT sum(size) FROM /* TEMPLATE: schema */files WHERE kind = 'file' AND status = 'active'), 0)::bigint AS total_active_bytes,
    (SELECT count(*) FROM /* TEMPLATE: schema */files WHERE kind = 'file' AND status = 'trashed')::bigint AS total_trashed_files,
    COALESCE((SELECT sum(size) FROM /* TEMPLATE: schema */files WHERE kind = 'file' AND status = 'trashed'), 0)::bigint AS total_trash_bytes,
    (SELECT count(*) FROM /* TEMPLATE: schema */channels)::bigint AS total_channels,
    (SELECT count(*) FROM /* TEMPLATE: schema */channels WHERE health = 'healthy')::bigint AS healthy_channels,
    (SELECT count(*) FROM /* TEMPLATE: schema */bots)::bigint AS total_bots,
    (SELECT count(*) FROM /* TEMPLATE: schema */file_shares WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()))::bigint AS active_shares;

-- name: ListAdminUserStorageUsage :many
SELECT
    f.user_id,
    count(*) FILTER (WHERE f.kind = 'file' AND f.status = 'active')::bigint AS active_files,
    COALESCE(sum(f.size) FILTER (WHERE f.kind = 'file' AND f.status = 'active'), 0)::bigint AS logical_bytes,
    COALESCE(sum(f.size) FILTER (WHERE f.kind = 'file' AND f.status = 'trashed'), 0)::bigint AS trash_bytes
FROM /* TEMPLATE: schema */files f
GROUP BY f.user_id;

-- name: ListAdminAuditEvents :many
SELECT
    a.id,
    a.user_id,
    u.username,
    u.display_name,
    a.action,
    a.resource_type,
    a.resource_id,
    a.metadata,
    a.request_id,
    a.created_at
FROM /* TEMPLATE: schema */audit_events a
LEFT JOIN /* TEMPLATE: schema */users u ON u.user_id = a.user_id
WHERE (sqlc.narg(user_id)::bigint IS NULL OR a.user_id = sqlc.narg(user_id)::bigint)
  AND (sqlc.narg(action)::text IS NULL OR a.action ILIKE '%' || sqlc.narg(action)::text || '%')
  AND (
    sqlc.narg(after_created_at)::timestamptz IS NULL
    OR (a.created_at, a.id) < (
      sqlc.narg(after_created_at)::timestamptz,
      sqlc.narg(after_id)::uuid
    )
  )
ORDER BY a.created_at DESC, a.id DESC
LIMIT sqlc.arg(page_size);
