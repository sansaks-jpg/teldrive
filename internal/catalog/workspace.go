package catalog

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/tgdrive/teldrive/v2/internal/db/sqlcgen"
	"github.com/tgdrive/teldrive/v2/internal/dbtypes"
)

type PhotoTimelineRecord struct {
	File        *sqlcgen.File
	Favorite    bool
	TakenAt     pgtype.Timestamptz
	Width       pgtype.Int4
	Height      pgtype.Int4
	CameraMake  pgtype.Text
	CameraModel pgtype.Text
}

type MediaMetadataUpdateInput struct {
	Favorite    *bool
	TakenAt     *time.Time
	Width       *int32
	Height      *int32
	CameraMake  *string
	CameraModel *string
}

type WorkspaceDocType string

const (
	WorkspaceDocTypeDoc   WorkspaceDocType = "doc"
	WorkspaceDocTypeSheet WorkspaceDocType = "sheet"
)

func (s *Service) ListPhotoTimeline(ctx context.Context, userID int64, favoritesOnly bool, albumID *uuid.UUID, limit int32) ([]PhotoTimelineRecord, error) {
	if userID <= 0 {
		return nil, ErrInvalidOwner
	}
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	rows, err := s.queries.ListPhotoTimeline(ctx, sqlcgen.ListPhotoTimelineParams{
		UserID:        userID,
		FavoritesOnly: favoritesOnly,
		AlbumID:       dbtypes.OptionalUUID(albumID),
		PageSize:      limit,
	})
	if err != nil {
		return nil, fmt.Errorf("list photo timeline: %w", err)
	}
	out := make([]PhotoTimelineRecord, 0, len(rows))
	for _, r := range rows {
		out = append(out, PhotoTimelineRecord{
			File: &sqlcgen.File{
				ID:                   r.ID,
				UserID:               r.UserID,
				ParentID:             r.ParentID,
				Name:                 r.Name,
				Kind:                 r.Kind,
				MimeType:             r.MimeType,
				Size:                 r.Size,
				HashAlgorithm:        r.HashAlgorithm,
				HashValue:            r.HashValue,
				Encryption:           r.Encryption,
				EncryptionKeyVersion: r.EncryptionKeyVersion,
				Status:               r.Status,
				ModTime:              r.ModTime,
				Generation:           r.Generation,
				CreatedAt:            r.CreatedAt,
				UpdatedAt:            r.UpdatedAt,
				DeletedAt:            r.DeletedAt,
			},
			Favorite:    r.Favorite,
			TakenAt:     r.TakenAt,
			Width:       r.Width,
			Height:      r.Height,
			CameraMake:  r.CameraMake,
			CameraModel: r.CameraModel,
		})
	}
	return out, nil
}

func (s *Service) UpdateMediaMetadata(ctx context.Context, userID int64, fileID uuid.UUID, in MediaMetadataUpdateInput) (*PhotoTimelineRecord, error) {
	if userID <= 0 || fileID == uuid.Nil {
		return nil, ErrInvalidOwner
	}
	file, err := s.queries.GetActiveFileForUser(ctx, sqlcgen.GetActiveFileForUserParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("check media file: %w", err)
	}
	if file.Kind != sqlcgen.FileKindFile {
		return nil, ErrNotAFile
	}
	var fav pgtype.Bool
	if in.Favorite != nil {
		fav = pgtype.Bool{Bool: *in.Favorite, Valid: true}
	}
	if _, err := s.queries.UpsertMediaMetadata(ctx, sqlcgen.UpsertMediaMetadataParams{
		FileID:      dbtypes.UUID(fileID),
		UserID:      userID,
		TakenAt:     dbtypes.OptionalTime(in.TakenAt),
		Width:       dbtypes.OptionalInt4(in.Width),
		Height:      dbtypes.OptionalInt4(in.Height),
		CameraMake:  dbtypes.OptionalText(in.CameraMake),
		CameraModel: dbtypes.OptionalText(in.CameraModel),
		Favorite:    fav,
	}); err != nil {
		return nil, fmt.Errorf("upsert media metadata: %w", err)
	}
	r, err := s.queries.GetPhotoTimelineItem(ctx, sqlcgen.GetPhotoTimelineItemParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("reload photo timeline item: %w", err)
	}
	return &PhotoTimelineRecord{
		File: &sqlcgen.File{
			ID:                   r.ID,
			UserID:               r.UserID,
			ParentID:             r.ParentID,
			Name:                 r.Name,
			Kind:                 r.Kind,
			MimeType:             r.MimeType,
			Size:                 r.Size,
			HashAlgorithm:        r.HashAlgorithm,
			HashValue:            r.HashValue,
			Encryption:           r.Encryption,
			EncryptionKeyVersion: r.EncryptionKeyVersion,
			Status:               r.Status,
			ModTime:              r.ModTime,
			Generation:           r.Generation,
			CreatedAt:            r.CreatedAt,
			UpdatedAt:            r.UpdatedAt,
			DeletedAt:            r.DeletedAt,
		},
		Favorite:    r.Favorite,
		TakenAt:     r.TakenAt,
		Width:       r.Width,
		Height:      r.Height,
		CameraMake:  r.CameraMake,
		CameraModel: r.CameraModel,
	}, nil
}

func (s *Service) ListPhotoAlbums(ctx context.Context, userID int64) ([]*sqlcgen.ListPhotoAlbumsRow, error) {
	if userID <= 0 {
		return nil, ErrInvalidOwner
	}
	rows, err := s.queries.ListPhotoAlbums(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("list photo albums: %w", err)
	}
	return rows, nil
}

func (s *Service) CreatePhotoAlbum(ctx context.Context, userID int64, name string, description *string) (*sqlcgen.PhotoAlbum, error) {
	if userID <= 0 {
		return nil, ErrInvalidOwner
	}
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, ErrInvalidName
	}
	row, err := s.queries.CreatePhotoAlbum(ctx, sqlcgen.CreatePhotoAlbumParams{
		ID:          dbtypes.UUID(uuid.New()),
		UserID:      userID,
		Name:        trimmed,
		Description: dbtypes.OptionalText(description),
	})
	if err != nil {
		return nil, fmt.Errorf("create photo album: %w", err)
	}
	return row, nil
}

func (s *Service) DeletePhotoAlbum(ctx context.Context, userID int64, albumID uuid.UUID) error {
	if userID <= 0 || albumID == uuid.Nil {
		return ErrInvalidOwner
	}
	n, err := s.queries.DeletePhotoAlbum(ctx, sqlcgen.DeletePhotoAlbumParams{
		AlbumID: dbtypes.UUID(albumID),
		UserID:  userID,
	})
	if err != nil {
		return fmt.Errorf("delete photo album: %w", err)
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Service) AddPhotoAlbumItem(ctx context.Context, userID int64, albumID, fileID uuid.UUID) error {
	if userID <= 0 || albumID == uuid.Nil || fileID == uuid.Nil {
		return ErrInvalidOwner
	}
	if _, err := s.queries.GetPhotoAlbumForUser(ctx, sqlcgen.GetPhotoAlbumForUserParams{
		AlbumID: dbtypes.UUID(albumID),
		UserID:  userID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("get photo album: %w", err)
	}
	file, err := s.queries.GetActiveFileForUser(ctx, sqlcgen.GetActiveFileForUserParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("get file for album item: %w", err)
	}
	if file.Kind != sqlcgen.FileKindFile {
		return ErrNotAFile
	}
	if err := s.queries.AddPhotoAlbumItem(ctx, sqlcgen.AddPhotoAlbumItemParams{
		AlbumID: dbtypes.UUID(albumID),
		FileID:  dbtypes.UUID(fileID),
	}); err != nil {
		return fmt.Errorf("add photo album item: %w", err)
	}
	return nil
}

func (s *Service) RemovePhotoAlbumItem(ctx context.Context, userID int64, albumID, fileID uuid.UUID) error {
	if userID <= 0 || albumID == uuid.Nil || fileID == uuid.Nil {
		return ErrInvalidOwner
	}
	if _, err := s.queries.GetPhotoAlbumForUser(ctx, sqlcgen.GetPhotoAlbumForUserParams{
		AlbumID: dbtypes.UUID(albumID),
		UserID:  userID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return fmt.Errorf("get photo album: %w", err)
	}
	if err := s.queries.RemovePhotoAlbumItem(ctx, sqlcgen.RemovePhotoAlbumItemParams{
		AlbumID: dbtypes.UUID(albumID),
		FileID:  dbtypes.UUID(fileID),
	}); err != nil {
		return fmt.Errorf("remove photo album item: %w", err)
	}
	return nil
}

func (s *Service) ListWorkspaceDocuments(ctx context.Context, userID int64, docType *WorkspaceDocType, search string, limit int32) ([]*sqlcgen.ListWorkspaceDocumentsRow, error) {
	if userID <= 0 {
		return nil, ErrInvalidOwner
	}
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	var dtPtr *string
	if docType != nil {
		v := string(*docType)
		dtPtr = &v
	}
	var searchPtr *string
	if trimmed := strings.TrimSpace(search); trimmed != "" {
		searchPtr = &trimmed
	}
	rows, err := s.queries.ListWorkspaceDocuments(ctx, sqlcgen.ListWorkspaceDocumentsParams{
		UserID:   userID,
		DocType:  dbtypes.OptionalText(dtPtr),
		Search:   dbtypes.OptionalText(searchPtr),
		PageSize: limit,
	})
	if err != nil {
		return nil, fmt.Errorf("list workspace documents: %w", err)
	}
	return rows, nil
}

func (s *Service) CreateWorkspaceDocument(ctx context.Context, userID, actorID int64, name string, docType WorkspaceDocType, parentID *uuid.UUID, content string) (*sqlcgen.GetWorkspaceDocumentRow, error) {
	if userID <= 0 {
		return nil, ErrInvalidOwner
	}
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, ErrInvalidName
	}
	mimeType := "text/markdown"
	if docType == WorkspaceDocTypeSheet {
		mimeType = "application/vnd.teldrive.sheet+json"
		if strings.TrimSpace(content) == "" {
			content = `{"cells":{}}`
		}
	}
	if parentID != nil {
		if _, err := s.queries.GetActiveFolderForUser(ctx, sqlcgen.GetActiveFolderForUserParams{
			FolderID: dbtypes.UUID(*parentID),
			UserID:   userID,
		}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrInvalidParent
			}
			return nil, fmt.Errorf("check document parent folder: %w", err)
		}
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin create workspace document tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	q := sqlcgen.New(tx)
	fileID := uuid.New()
	now := s.now().UTC()
	if _, err := q.CreateWorkspaceCatalogFile(ctx, sqlcgen.CreateWorkspaceCatalogFileParams{
		ID:       dbtypes.UUID(fileID),
		UserID:   userID,
		ParentID: dbtypes.OptionalUUID(parentID),
		Name:     trimmed,
		MimeType: dbtypes.Text(mimeType),
		Size:     dbtypes.Int8(int64(len(content))),
		ModTime:  dbtypes.Time(now),
	}); err != nil {
		return nil, classifyWriteError("create workspace catalog file", err)
	}

	var updatedBy *int64
	if actorID > 0 {
		updatedBy = &actorID
	}
	if _, err := q.UpsertWorkspaceDocument(ctx, sqlcgen.UpsertWorkspaceDocumentParams{
		FileID:    dbtypes.UUID(fileID),
		UserID:    userID,
		DocType:   string(docType),
		Content:   content,
		UpdatedBy: dbtypes.OptionalInt8(updatedBy),
	}); err != nil {
		return nil, fmt.Errorf("insert workspace document: %w", err)
	}

	doc, err := q.GetWorkspaceDocument(ctx, sqlcgen.GetWorkspaceDocumentParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	})
	if err != nil {
		return nil, fmt.Errorf("load created workspace document: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit create workspace document tx: %w", err)
	}
	return doc, nil
}

func (s *Service) GetWorkspaceDocument(ctx context.Context, userID int64, fileID uuid.UUID) (*sqlcgen.GetWorkspaceDocumentRow, error) {
	if userID <= 0 || fileID == uuid.Nil {
		return nil, ErrInvalidOwner
	}
	doc, err := s.queries.GetWorkspaceDocument(ctx, sqlcgen.GetWorkspaceDocumentParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get workspace document: %w", err)
	}
	return doc, nil
}

func (s *Service) UpdateWorkspaceDocument(ctx context.Context, userID, actorID int64, fileID uuid.UUID, name *string, content string) (*sqlcgen.GetWorkspaceDocumentRow, error) {
	if userID <= 0 || fileID == uuid.Nil {
		return nil, ErrInvalidOwner
	}
	var trimmedName *string
	if name != nil {
		t := strings.TrimSpace(*name)
		if t == "" {
			return nil, ErrInvalidName
		}
		trimmedName = &t
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin update workspace document tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	q := sqlcgen.New(tx)
	existing, err := q.GetWorkspaceDocument(ctx, sqlcgen.GetWorkspaceDocumentParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("load workspace document for update: %w", err)
	}

	if _, err := q.UpdateWorkspaceFileSizeAndName(ctx, sqlcgen.UpdateWorkspaceFileSizeAndNameParams{
		Name:   dbtypes.OptionalText(trimmedName),
		Size:   dbtypes.Int8(int64(len(content))),
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, classifyWriteError("update workspace file metadata", err)
	}

	var updatedBy *int64
	if actorID > 0 {
		updatedBy = &actorID
	}
	if _, err := q.UpsertWorkspaceDocument(ctx, sqlcgen.UpsertWorkspaceDocumentParams{
		FileID:    dbtypes.UUID(fileID),
		UserID:    userID,
		DocType:   existing.DocType,
		Content:   content,
		UpdatedBy: dbtypes.OptionalInt8(updatedBy),
	}); err != nil {
		return nil, fmt.Errorf("update workspace document content: %w", err)
	}

	doc, err := q.GetWorkspaceDocument(ctx, sqlcgen.GetWorkspaceDocumentParams{
		FileID: dbtypes.UUID(fileID),
		UserID: userID,
	})
	if err != nil {
		return nil, fmt.Errorf("reload workspace document: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit update workspace document tx: %w", err)
	}
	s.InvalidateFiles(ctx, userID, fileID)
	return doc, nil
}
