package api

import (
	"context"
	"time"

	"github.com/google/uuid"

	"github.com/tgdrive/teldrive/v2/internal/api/gen"
	"github.com/tgdrive/teldrive/v2/internal/catalog"
	"github.com/tgdrive/teldrive/v2/internal/db/sqlcgen"
	"github.com/tgdrive/teldrive/v2/internal/dbtypes"
)

func (h *Handler) ListFileVersions(ctx context.Context, params gen.ListFileVersionsParams) (gen.ListFileVersionsRes, error) {
	access, err := h.resolveAuthenticatedFileAccess(ctx, googleUUID(params.FileId), false)
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
	access, err := h.resolveAuthenticatedFileAccess(ctx, googleUUID(params.FileId), true)
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
	access, err := h.resolveAuthenticatedFileAccess(ctx, googleUUID(params.FileId), true)
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

func (h *Handler) ListPhotoTimeline(ctx context.Context, params gen.ListPhotoTimelineParams) (gen.ListPhotoTimelineRes, error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	var albumID *uuid.UUID
	if v, ok := params.AlbumId.Get(); ok {
		id := googleUUID(v)
		albumID = &id
	}
	rows, err := h.Catalog.ListPhotoTimeline(ctx, userID, params.FavoritesOnly.Or(false), albumID, params.Limit.Or(200))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make(gen.ListPhotoTimelineOKApplicationJSON, 0, len(rows))
	for _, r := range rows {
		item, err := photoTimelineItem(r)
		if err != nil {
			return nil, mapServiceError(err)
		}
		out = append(out, item)
	}
	return &out, nil
}

func (h *Handler) UpdateMediaMetadata(ctx context.Context, req *gen.MediaMetadataUpdateRequest, params gen.UpdateMediaMetadataParams) (gen.UpdateMediaMetadataRes, error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil || req == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	in := catalog.MediaMetadataUpdateInput{}
	if v, ok := req.Favorite.Get(); ok {
		in.Favorite = &v
	}
	if v, ok := req.TakenAt.Get(); ok {
		t := v.UTC()
		in.TakenAt = &t
	}
	if v, ok := req.Width.Get(); ok {
		in.Width = &v
	}
	if v, ok := req.Height.Get(); ok {
		in.Height = &v
	}
	if v, ok := req.CameraMake.Get(); ok {
		in.CameraMake = &v
	}
	if v, ok := req.CameraModel.Get(); ok {
		in.CameraModel = &v
	}
	rec, err := h.Catalog.UpdateMediaMetadata(ctx, userID, googleUUID(params.FileId), in)
	if err != nil {
		return nil, mapServiceError(err)
	}
	item, err := photoTimelineItem(*rec)
	if err != nil {
		return nil, mapServiceError(err)
	}
	return &item, nil
}

func (h *Handler) ListPhotoAlbums(ctx context.Context) (gen.ListPhotoAlbumsRes, error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	rows, err := h.Catalog.ListPhotoAlbums(ctx, userID)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make(gen.ListPhotoAlbumsOKApplicationJSON, 0, len(rows))
	for _, r := range rows {
		id, _ := dbtypes.GoogleUUID(r.ID)
		item := gen.PhotoAlbumSummary{
			ID:        apiUUID(id),
			Name:      r.Name,
			ItemCount: r.ItemCount,
			CreatedAt: r.CreatedAt.Time,
			UpdatedAt: r.UpdatedAt.Time,
		}
		if r.Description.Valid {
			item.Description = gen.NewOptString(r.Description.String)
		}
		if coverID, ok := dbtypes.GoogleUUID(r.CoverFileID); ok {
			item.CoverFileId = gen.NewOptUUID(apiUUID(coverID))
		}
		out = append(out, item)
	}
	return &out, nil
}

func (h *Handler) CreatePhotoAlbum(ctx context.Context, req *gen.PhotoAlbumCreateRequest) (gen.CreatePhotoAlbumRes, error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil || req == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	var desc *string
	if v, ok := req.Description.Get(); ok {
		desc = &v
	}
	row, err := h.Catalog.CreatePhotoAlbum(ctx, userID, req.Name, desc)
	if err != nil {
		return nil, mapServiceError(err)
	}
	id, _ := dbtypes.GoogleUUID(row.ID)
	out := gen.PhotoAlbumSummary{
		ID:        apiUUID(id),
		Name:      row.Name,
		ItemCount: 0,
		CreatedAt: row.CreatedAt.Time,
		UpdatedAt: row.UpdatedAt.Time,
	}
	if row.Description.Valid {
		out.Description = gen.NewOptString(row.Description.String)
	}
	return &out, nil
}

func (h *Handler) DeletePhotoAlbum(ctx context.Context, params gen.DeletePhotoAlbumParams) (gen.DeletePhotoAlbumRes, error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	if err := h.Catalog.DeletePhotoAlbum(ctx, userID, googleUUID(params.AlbumId)); err != nil {
		return nil, mapServiceError(err)
	}
	return &gen.DeletePhotoAlbumNoContent{}, nil
}

func (h *Handler) AddPhotoAlbumItem(ctx context.Context, req *gen.PhotoAlbumItemRequest, params gen.AddPhotoAlbumItemParams) (gen.AddPhotoAlbumItemRes, error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil || req == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	if err := h.Catalog.AddPhotoAlbumItem(ctx, userID, googleUUID(params.AlbumId), googleUUID(req.FileId)); err != nil {
		return nil, mapServiceError(err)
	}
	return &gen.AddPhotoAlbumItemNoContent{}, nil
}

func (h *Handler) RemovePhotoAlbumItem(ctx context.Context, params gen.RemovePhotoAlbumItemParams) (gen.RemovePhotoAlbumItemRes, error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	if err := h.Catalog.RemovePhotoAlbumItem(ctx, userID, googleUUID(params.AlbumId), googleUUID(params.FileId)); err != nil {
		return nil, mapServiceError(err)
	}
	return &gen.RemovePhotoAlbumItemNoContent{}, nil
}

func (h *Handler) ListWorkspaceDocuments(ctx context.Context, params gen.ListWorkspaceDocumentsParams) (gen.ListWorkspaceDocumentsRes, error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	var docType *catalog.WorkspaceDocType
	if v, ok := params.DocType.Get(); ok {
		dt := catalog.WorkspaceDocType(v)
		docType = &dt
	}
	rows, err := h.Catalog.ListWorkspaceDocuments(ctx, userID, docType, params.Search.Or(""), params.Limit.Or(200))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := make(gen.ListWorkspaceDocumentsOKApplicationJSON, 0, len(rows))
	for _, r := range rows {
		fileID, _ := dbtypes.GoogleUUID(r.FileID)
		item := gen.WorkspaceDocumentSummary{
			FileId:    apiUUID(fileID),
			Name:      r.Name,
			DocType:   gen.WorkspaceDocType(r.DocType),
			Size:      r.Size,
			UpdatedAt: r.UpdatedAt.Time,
			CreatedAt: r.CreatedAt.Time,
		}
		if parentID, ok := dbtypes.GoogleUUID(r.ParentID); ok {
			item.ParentId = gen.NewOptUUID(apiUUID(parentID))
		}
		out = append(out, item)
	}
	return &out, nil
}

func (h *Handler) CreateWorkspaceDocument(ctx context.Context, req *gen.WorkspaceDocumentCreateRequest) (gen.CreateWorkspaceDocumentRes, error) {
	actorID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil || req == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	var parentID *uuid.UUID
	if v, ok := req.ParentId.Get(); ok {
		id := googleUUID(v)
		parentID = &id
	}
	doc, err := h.Catalog.CreateWorkspaceDocument(ctx, actorID, actorID, req.Name, catalog.WorkspaceDocType(req.DocType), parentID, req.Content.Or(""))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := workspaceDocumentDetail(doc)
	return &out, nil
}

func (h *Handler) GetWorkspaceDocument(ctx context.Context, params gen.GetWorkspaceDocumentParams) (gen.GetWorkspaceDocumentRes, error) {
	access, err := h.resolveAuthenticatedFileAccess(ctx, googleUUID(params.FileId), false)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	doc, err := h.Catalog.GetWorkspaceDocument(ctx, access.OwnerID, googleUUID(params.FileId))
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := workspaceDocumentDetail(doc)
	return &out, nil
}

func (h *Handler) UpdateWorkspaceDocument(ctx context.Context, req *gen.WorkspaceDocumentUpdateRequest, params gen.UpdateWorkspaceDocumentParams) (gen.UpdateWorkspaceDocumentRes, error) {
	actorID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, mapServiceError(err)
	}
	access, err := h.resolveAuthenticatedFileAccess(ctx, googleUUID(params.FileId), true)
	if err != nil {
		return nil, mapServiceError(err)
	}
	if h.Catalog == nil || req == nil {
		return nil, mapServiceError(ErrOperationUnavailable)
	}
	var name *string
	if v, ok := req.Name.Get(); ok {
		name = &v
	}
	doc, err := h.Catalog.UpdateWorkspaceDocument(ctx, access.OwnerID, actorID, googleUUID(params.FileId), name, req.Content)
	if err != nil {
		return nil, mapServiceError(err)
	}
	out := workspaceDocumentDetail(doc)
	return &out, nil
}

func workspaceDocumentDetail(doc *sqlcgen.GetWorkspaceDocumentRow) gen.WorkspaceDocumentDetail {
	fileID, _ := dbtypes.GoogleUUID(doc.FileID)
	out := gen.WorkspaceDocumentDetail{
		FileId:     apiUUID(fileID),
		Name:       doc.Name,
		DocType:    gen.WorkspaceDocType(doc.DocType),
		Content:    doc.Content,
		Size:       doc.Size,
		Generation: doc.Generation,
		UpdatedAt:  doc.UpdatedAt.Time,
		CreatedAt:  doc.CreatedAt.Time,
	}
	if parentID, ok := dbtypes.GoogleUUID(doc.ParentID); ok {
		out.ParentId = gen.NewOptUUID(apiUUID(parentID))
	}
	return out
}

func photoTimelineItem(r catalog.PhotoTimelineRecord) (gen.PhotoTimelineItem, error) {
	entry, err := fileEntry(r.File)
	if err != nil {
		return gen.PhotoTimelineItem{}, err
	}
	out := gen.PhotoTimelineItem{
		File:     entry,
		Favorite: r.Favorite,
	}
	if r.TakenAt.Valid {
		out.TakenAt = gen.NewOptDateTime(r.TakenAt.Time.UTC())
	}
	if r.Width.Valid {
		out.Width = gen.NewOptInt32(r.Width.Int32)
	}
	if r.Height.Valid {
		out.Height = gen.NewOptInt32(r.Height.Int32)
	}
	if r.CameraMake.Valid {
		out.CameraMake = gen.NewOptString(r.CameraMake.String)
	}
	if r.CameraModel.Valid {
		out.CameraModel = gen.NewOptString(r.CameraModel.String)
	}
	return out, nil
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

var _ = time.UTC
