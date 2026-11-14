package api

import (
	"context"

	"github.com/tgdrive/teldrive/v2/internal/api/gen"
	"github.com/tgdrive/teldrive/v2/internal/db/sqlcgen"
	"github.com/tgdrive/teldrive/v2/internal/dbtypes"
)

func (h *Handler) ListFileVersions(ctx context.Context, params gen.ListFileVersionsParams) (gen.ListFileVersionsRes, error) {
	access, err := h.resolveFileAccess(ctx, googleUUID(params.FileId), false)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	rows, err := h.Catalog.ListVersions(ctx, access.OwnerID, googleUUID(params.FileId))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make(gen.ListFileVersionsOKApplicationJSON, 0, len(rows))
	for _, row := range rows {
		out = append(out, fileVersionSummary(row))
	}
	return &out, nil
}

func (h *Handler) CreateFileVersion(ctx context.Context, params gen.CreateFileVersionParams) (gen.CreateFileVersionRes, error) {
	actorID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	access, err := h.resolveFileAccess(ctx, googleUUID(params.FileId), true)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	row, err := h.Catalog.CreateVersionSnapshot(ctx, access.OwnerID, actorID, googleUUID(params.FileId))
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Auth != nil {
		fileIDStr := googleUUID(params.FileId).String()
		h.Auth.RecordAuditEvent(ctx, &actorID, "file.version.created", "file", &fileIDStr, nil)
	}
	out := fileVersionSummary(row)
	return &out, nil
}

func (h *Handler) RestoreFileVersion(ctx context.Context, params gen.RestoreFileVersionParams) (gen.RestoreFileVersionRes, error) {
	actorID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	access, err := h.resolveFileAccess(ctx, googleUUID(params.FileId), true)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	file, err := h.Catalog.RestoreVersion(ctx, access.OwnerID, actorID, googleUUID(params.FileId), googleUUID(params.VersionId))
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Auth != nil {
		fileIDStr := googleUUID(params.FileId).String()
		h.Auth.RecordAuditEvent(ctx, &actorID, "file.version.restored", "file", &fileIDStr, nil)
	}
	entry, err := fileEntry(file)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &gen.FileEntryHeaders{Etag: generationETag(file.Generation), Response: entry}, nil
}

func fileVersionSummary(row *sqlcgen.FileVersion) gen.FileVersionSummary {
	id, _ := dbtypes.GoogleUUID(row.ID)
	fileID, _ := dbtypes.GoogleUUID(row.FileID)
	out := gen.FileVersionSummary{
		ID:            apiUUID(id),
		FileId:        apiUUID(fileID),
		VersionNumber: row.VersionNumber,
		Name:          row.Name,
		Size:          row.Size,
		Encryption:    row.Encryption,
		CreatedAt:     row.CreatedAt.Time,
	}
	if row.MimeType.Valid {
		out.MimeType = gen.NewOptString(row.MimeType.String)
	}
	if row.CreatedBy.Valid {
		out.CreatedBy = gen.NewOptInt64(row.CreatedBy.Int64)
	}
	return out
}
