package api

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/tgdrive/teldrive/v2/internal/api/gen"
	"github.com/tgdrive/teldrive/v2/internal/authn"
	"github.com/tgdrive/teldrive/v2/internal/principal"
)

func TestWorkspaceAdminOnlyEndpointsRejectNonAdmin(t *testing.T) {
	t.Parallel()
	h := &Handler{Auth: &authn.Service{}}
	userCtx := principal.WithIdentity(context.Background(), principal.Identity{
		UserID: 1000000000001,
		Roles:  []string{"user"},
	})

	assertForbidden := func(name string, err error) {
		t.Helper()
		if err == nil {
			t.Fatalf("%s unexpectedly succeeded for non-admin user", name)
		}
		var prob *Problem
		if !errors.As(err, &prob) || prob.Status != http.StatusForbidden {
			t.Fatalf("%s err = %v, want HTTP 403", name, err)
		}
	}

	_, err := h.ListChannels(userCtx, gen.ListChannelsParams{})
	assertForbidden("ListChannels", err)
	_, err = h.CreateChannel(userCtx, &gen.ChannelCreateRequest{}, gen.CreateChannelParams{})
	assertForbidden("CreateChannel", err)
	_, err = h.ListBots(userCtx, gen.ListBotsParams{})
	assertForbidden("ListBots", err)
	_, err = h.ListPeriodicJobs(userCtx)
	assertForbidden("ListPeriodicJobs", err)
	_, err = h.GetAdminTelegramStatus(userCtx)
	assertForbidden("GetAdminTelegramStatus", err)
	_, err = h.CreateAdminUser(userCtx, &gen.AdminUserCreateRequest{})
	assertForbidden("CreateAdminUser", err)
}
