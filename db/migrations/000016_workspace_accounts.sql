-- +goose Up

CREATE SEQUENCE IF NOT EXISTS /* TEMPLATE: schema */workspace_user_id_seq
    START WITH 1000000000000
    INCREMENT BY 1
    MINVALUE 1000000000000;

ALTER TABLE /* TEMPLATE: schema */users
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx
    ON /* TEMPLATE: schema */users (lower(email))
    WHERE email IS NOT NULL;

ALTER TABLE /* TEMPLATE: schema */sessions
    ALTER COLUMN telegram_session DROP NOT NULL;

CREATE TABLE IF NOT EXISTS /* TEMPLATE: schema */workspace_telegram (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    owner_user_id BIGINT NOT NULL REFERENCES /* TEMPLATE: schema */users(user_id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    phone_number_ciphertext BYTEA,
    telegram_username TEXT,
    telegram_session BYTEA NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT workspace_telegram_singleton CHECK (id = 1)
);

INSERT INTO /* TEMPLATE: schema */workspace_telegram (
    id,
    owner_user_id,
    telegram_user_id,
    telegram_username,
    telegram_session
)
SELECT
    1,
    u.user_id,
    u.user_id,
    u.username,
    s.telegram_session
FROM /* TEMPLATE: schema */users u
JOIN /* TEMPLATE: schema */sessions s ON s.user_id = u.user_id
WHERE u.role = 'owner'
  AND s.telegram_session IS NOT NULL
  AND length(s.telegram_session) > 0
ORDER BY s.revoked_at NULLS FIRST, s.last_used_at DESC NULLS LAST, s.created_at DESC
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- +goose Down

DROP TABLE IF EXISTS /* TEMPLATE: schema */workspace_telegram;

UPDATE /* TEMPLATE: schema */sessions
SET telegram_session = ''::bytea
WHERE telegram_session IS NULL;

ALTER TABLE /* TEMPLATE: schema */sessions
    ALTER COLUMN telegram_session SET NOT NULL;

DROP INDEX IF EXISTS /* TEMPLATE: schema */users_email_lower_uidx;

ALTER TABLE /* TEMPLATE: schema */users
    DROP COLUMN IF EXISTS password_hash,
    DROP COLUMN IF EXISTS email;

DROP SEQUENCE IF EXISTS /* TEMPLATE: schema */workspace_user_id_seq;
