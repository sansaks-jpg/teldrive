package catalog

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/tgdrive/teldrive/v2/internal/db/sqlcgen"
	"github.com/tgdrive/teldrive/v2/internal/dbtypes"
)

func (s *Service) ListVersions(ctx context.Context, userID int64, fileID uuid.UUID) ([]*sqlcgen.FileVersion, error) {
	if userID <= 0 || fileID == uuid.Nil {
		return nil, ErrInvalidOwner
	}
	if _, err := s.queries.GetActiveFileForUser(ctx, sqlcgen.GetActiveFileForUserParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("check file for versions: %w", err)
	}
	rows, err := s.queries.ListFileVersions(ctx, sqlcgen.ListFileVersionsParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	})
	if err != nil {
		return nil, fmt.Errorf("list file versions: %w", err)
	}
	return rows, nil
}

func (s *Service) CreateVersionSnapshot(ctx context.Context, userID, actorID int64, fileID uuid.UUID) (*sqlcgen.FileVersion, error) {
	if userID <= 0 || fileID == uuid.Nil {
		return nil, ErrInvalidOwner
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin create version tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	version, err := snapshotFileInTx(ctx, sqlcgen.New(tx), userID, actorID, fileID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit create version tx: %w", err)
	}
	return version, nil
}

func (s *Service) RestoreVersion(ctx context.Context, userID, actorID int64, fileID, versionID uuid.UUID) (*sqlcgen.File, error) {
	if userID <= 0 || fileID == uuid.Nil || versionID == uuid.Nil {
		return nil, ErrInvalidOwner
	}
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin restore version tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	q := sqlcgen.New(tx)
	version, err := q.GetFileVersion(ctx, sqlcgen.GetFileVersionParams{
		VersionID: dbtypes.UUID(versionID),
		FileID:    dbtypes.UUID(fileID),
		UserID:    userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get file version: %w", err)
	}

	// Snapshot the current file state before overwriting it with the target version.
	if _, err := snapshotFileInTx(ctx, q, userID, actorID, fileID); err != nil {
		return nil, err
	}

	if err := q.DeleteFilePartsForRestore(ctx, dbtypes.UUID(fileID)); err != nil {
		return nil, fmt.Errorf("clear current file parts: %w", err)
	}

	normalized, err := normalizeName(version.Name)
	if err != nil {
		return nil, err
	}

	restored, err := q.RestoreFileFromVersion(ctx, sqlcgen.RestoreFileFromVersionParams{
		Name:                 version.Name,
		NormalizedName:       normalized,
		MimeType:             version.MimeType,
		Size:                 dbtypes.Int8(version.Size),
		HashAlgorithm:        version.HashAlgorithm,
		HashValue:            version.HashValue,
		Encryption:           version.Encryption,
		EncryptionKeyVersion: version.EncryptionKeyVersion,
		FileID:               dbtypes.UUID(fileID),
		UserID:               userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrConflict
		}
		return nil, fmt.Errorf("restore file metadata from version: %w", err)
	}

	if _, err := q.CopyVersionPartsToFile(ctx, sqlcgen.CopyVersionPartsToFileParams{
		FileID:    dbtypes.UUID(fileID),
		VersionID: dbtypes.UUID(versionID),
	}); err != nil {
		return nil, fmt.Errorf("restore file parts from version: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit restore version tx: %w", err)
	}
	s.InvalidateFiles(ctx, userID, fileID)
	return restored, nil
}

func snapshotFileInTx(ctx context.Context, q *sqlcgen.Queries, userID, actorID int64, fileID uuid.UUID) (*sqlcgen.FileVersion, error) {
	file, err := q.GetActiveFileForUser(ctx, sqlcgen.GetActiveFileForUserParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get active file for snapshot: %w", err)
	}
	if file.Kind != sqlcgen.FileKindFile {
		return nil, ErrNotAFile
	}
	nextVersion, err := q.GetNextFileVersionNumber(ctx, dbtypes.UUID(fileID))
	if err != nil {
		return nil, fmt.Errorf("get next file version number: %w", err)
	}
	versionID := uuid.New()
	var createdBy *int64
	if actorID > 0 {
		createdBy = &actorID
	}
	version, err := q.InsertFileVersion(ctx, sqlcgen.InsertFileVersionParams{
		ID:                   dbtypes.UUID(versionID),
		FileID:               dbtypes.UUID(fileID),
		UserID:               userID,
		VersionNumber:        nextVersion,
		Name:                 file.Name,
		MimeType:             file.MimeType,
		Size:                 file.Size.Int64,
		HashAlgorithm:        file.HashAlgorithm,
		HashValue:            file.HashValue,
		Encryption:           file.Encryption,
		EncryptionKeyVersion: file.EncryptionKeyVersion,
		CreatedBy:            dbtypes.OptionalInt8(createdBy),
	})
	if err != nil {
		return nil, fmt.Errorf("insert file version: %w", err)
	}
	if _, err := q.CopyFilePartsToVersion(ctx, sqlcgen.CopyFilePartsToVersionParams{
		VersionID: dbtypes.UUID(versionID),
		FileID:    dbtypes.UUID(fileID),
	}); err != nil {
		return nil, fmt.Errorf("copy file parts to version: %w", err)
	}
	return version, nil
}
