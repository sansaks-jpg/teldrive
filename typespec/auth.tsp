using TypeSpec.Http;
using TypeSpec.OpenAPI;

namespace TelDrive;

model TelegramLoginStartRequest {
  /** Phone number in E.164 format. */
  @pattern("^\\+[1-9][0-9]{7,14}$")
  phoneNumber: string;
}

model TelegramLoginStartResponse {
  flowId: Uuid;
  expiresAt: utcDateTime;
  passwordRequired: boolean;
}

enum TelegramQRLoginState {
  pending: "pending",
  passwordRequired: "password_required",
}

model TelegramQRLoginResponse {
  flowId: Uuid;
  expiresAt: utcDateTime;
  state: TelegramQRLoginState;
  qrUrl?: string;
  qrExpiresAt?: utcDateTime;
}

model TelegramQRLoginPollRequest {
  flowId: Uuid;
}
model TelegramCodeVerifyRequest {
  flowId: Uuid;

  @minLength(1)
  @maxLength(16)
  code: string;
}

model TelegramPasswordVerifyRequest {
  flowId: Uuid;

  @minLength(1)
  password: string;
}

model RefreshTokenRequest {
  refreshToken: string;
}

model RefreshCookie {
  @cookie("teldrive_refresh")
  refreshToken: string;
}

model TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: int32;
}

model CookieSession {
  authenticated: true;
  expiresAt: utcDateTime;
}

model CookieSessionResponse<Status extends int32> {
  @statusCode
  statusCode: Status;

  @header("Set-Cookie")
  setCookie: string[];

  @body
  body: CookieSession;
}

model CookieSessionNoContent<Status extends int32> {
  @statusCode
  statusCode: Status;

  @header("Set-Cookie")
  setCookie: string[];
}

enum UserRole {
  owner: "owner",
  admin: "admin",
  user: "user",
}

model BootstrapStatus {
  telegramLinked: boolean;
  emailAuthReady: boolean;
}

model PasswordLoginRequest {
  @minLength(3)
  @maxLength(254)
  email: string;

  @minLength(1)
  @maxLength(256)
  password: string;
}

model ChangePasswordRequest {
  @minLength(1)
  @maxLength(256)
  currentPassword: string;

  @minLength(6)
  @maxLength(256)
  newPassword: string;
}

model SetupCredentialsRequest {
  @minLength(3)
  @maxLength(254)
  email: string;

  @minLength(6)
  @maxLength(256)
  password: string;
}

model AdminUserCreateRequest {
  @minLength(3)
  @maxLength(254)
  email: string;

  @maxLength(120)
  displayName?: string;

  @minLength(6)
  @maxLength(256)
  password: string;

  role?: UserRole;

  @minValue(0)
  storageQuotaBytes?: int64;
}

model WorkspaceTelegramStatus {
  linked: boolean;
  telegramUserId?: int64;
  telegramUsername?: string;
  updatedAt?: utcDateTime;
}

model AdminTelegramRelinkVerifyResponse {
  linked: boolean;
  passwordRequired: boolean;
  flowId?: Uuid;
  expiresAt?: utcDateTime;
  status?: WorkspaceTelegramStatus;
}

model UserAdminUpdateRequest {
  email?: string;
  displayName?: string;
  @minLength(6)
  @maxLength(256)
  password?: string;
  role?: UserRole;
  disabled?: boolean;

  @minValue(0)
  storageQuotaBytes?: int64;

  clearStorageQuota?: boolean;
}

model AdminUserSummary {
  userId: int64;
  email?: string;
  displayName?: string;
  username?: string;
  hasPassword: boolean;
  premium: boolean;
  role: UserRole;
  disabled: boolean;
  storageUsedBytes: int64;
  activeFiles: int64;
  activeBytes: int64;
  trashBytes: int64;
  storageQuotaBytes?: int64;
  createdAt: utcDateTime;
  updatedAt: utcDateTime;
}

model AdminOverview {
  totalUsers: int64;
  disabledUsers: int64;
  totalActiveFiles: int64;
  totalActiveBytes: int64;
  totalTrashedFiles: int64;
  totalTrashBytes: int64;
  totalChannels: int64;
  healthyChannels: int64;
  totalBots: int64;
  activeShares: int64;
}

model AdminAuditEvent {
  id: Uuid;
  userId?: int64;
  username?: string;
  displayName?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId?: string;
  createdAt: utcDateTime;
}

model UserSearchResult {
  userId: int64;
  displayName?: string;
  username?: string;
}

model UserProfile {
  userId: int64;
  email?: string;
  displayName?: string;
  username?: string;
  hasPassword: boolean;
  premium: boolean;
  role: UserRole;
  capabilities: string[];
  storageUsedBytes: int64;
  storageQuotaBytes?: int64;
  createdAt: utcDateTime;
}

enum ThemePreference {
  system: "system",
  light: "light",
  dark: "dark",
}

enum InterfaceLocale {
  en: "en",
  es: "es",
  ptBR: "pt-BR",
  ru: "ru",
  fr: "fr",
  de: "de",
  zhCN: "zh-CN",
}

model UploadPreferences {
  /** Encrypt new browser uploads and URL imports by default. */
  encryption: boolean;

  conflictPolicy: NameConflictPolicy;

  /** Number of browser uploads that run at the same time. */
  @minValue(1)
  @maxValue(12)
  concurrency: int32;

  /** Preferred part size in bytes; a multiple of 16 MiB between 16 MiB and 2 GiB. */
  @minValue(16777216)
  @maxValue(2147483648)
  preferredPartSize: int64;
}

model UploadPreferencesUpdate {
  encryption?: boolean;
  conflictPolicy?: NameConflictPolicy;

  @minValue(1)
  @maxValue(12)
  concurrency?: int32;

  /** Preferred part size in bytes; a multiple of 16 MiB between 16 MiB and 2 GiB. */
  @minValue(16777216)
  @maxValue(2147483648)
  preferredPartSize?: int64;
}

/** Sort keys offered by the web file browser; a subset of FileSort. */
enum FileBrowserSort {
  name: "name",
  updatedAt: "updatedAt",
  size: "size",
}

model FileBrowserPreferences {
  sort: FileBrowserSort;
  order: SortOrder;
}

model FileBrowserPreferencesUpdate {
  sort?: FileBrowserSort;
  order?: SortOrder;
}

model AppearancePreferences {
  theme: ThemePreference;

  /** Interface language; absent until the user picks one, so clients fall back to browser detection. */
  locale?: InterfaceLocale;

  /**
   * Whether the video player reads the audio tracks and subtitles stored inside .mkv and .webm
   * files. Off by default; while it is off nothing extra is loaded.
   */
  embeddedTracks: boolean;

  /**
   * Whether the video player on this account's public share links does that too. Visitors have no
   * settings of their own, so the owner decides. Needs `embeddedTracks`: it is always off while that
   * is off.
   */
  embeddedTracksOnShares: boolean;
}

model AppearancePreferencesUpdate {
  theme?: ThemePreference;
  locale?: InterfaceLocale;
  embeddedTracks?: boolean;
  embeddedTracksOnShares?: boolean;
}

/** Account-wide subtitle styling and timing, independent of the browser player's local storage. */
model CaptionPreferences {
  fontSize: "small" | "medium" | "large";
  @minValue(50) @maxValue(200) fontScale: float64;
  fontFamily: "sans" | "serif" | "monospace";
  @pattern("^#[0-9a-fA-F]{6}$") textColor: string;
  @minValue(0) @maxValue(1) textOpacity: float64;
  @pattern("^#[0-9a-fA-F]{6}$") backgroundColor: string;
  @minValue(0) @maxValue(1) backgroundOpacity: float64;
  edgeStyle: "none" | "shadow" | "outline";
  @pattern("^#[0-9a-fA-F]{6}$") edgeColor: string;
  @minValue(-20) @maxValue(30) position: float64;
  @minValue(1) @maxValue(2) lineHeight: float64;
  @minValue(-10) @maxValue(10) delay: float64;
}

model CaptionPreferencesUpdate {
  fontSize?: "small" | "medium" | "large";
  @minValue(50) @maxValue(200) fontScale?: float64;
  fontFamily?: "sans" | "serif" | "monospace";
  @pattern("^#[0-9a-fA-F]{6}$") textColor?: string;
  @minValue(0) @maxValue(1) textOpacity?: float64;
  @pattern("^#[0-9a-fA-F]{6}$") backgroundColor?: string;
  @minValue(0) @maxValue(1) backgroundOpacity?: float64;
  edgeStyle?: "none" | "shadow" | "outline";
  @pattern("^#[0-9a-fA-F]{6}$") edgeColor?: string;
  @minValue(-20) @maxValue(30) position?: float64;
  @minValue(1) @maxValue(2) lineHeight?: float64;
  @minValue(-10) @maxValue(10) delay?: float64;
}

/** Per-user web UI preferences shared by every browser and device. */
model UserPreferences {
  uploads: UploadPreferences;
  files: FileBrowserPreferences;
  appearance: AppearancePreferences;
  captions: CaptionPreferences;

  /** Last explicit change; absent while every value is still the server default. */
  updatedAt?: utcDateTime;
}

/** Partial update; omitted groups and fields keep their stored values. */
model UserPreferencesUpdate {
  uploads?: UploadPreferencesUpdate;
  files?: FileBrowserPreferencesUpdate;
  appearance?: AppearancePreferencesUpdate;
  captions?: CaptionPreferencesUpdate;
}

model ProfilePhotoResponse {
  @statusCode
  statusCode: 200;

  @header("Content-Length")
  contentLength: int64;

  @header("Cache-Control")
  cacheControl: string;

  @header("Etag")
  ETag: ETag;

  @header("Content-Disposition")
  contentDisposition: string;

  @body
  body: bytes;
}
model ApiKeyCreateRequest {
  @minLength(1)
  @maxLength(120)
  name: string;

  expiresAt?: utcDateTime;
}

model ApiKeyCreated {
  id: Uuid;
  name: string;

  /** Returned once. The server stores only a hash. */
  secret: string;

  createdAt: utcDateTime;
  expiresAt?: utcDateTime;
}

model ApiKeySummary {
  id: Uuid;
  name: string;
  createdAt: utcDateTime;
  lastUsedAt?: utcDateTime;
  expiresAt?: utcDateTime;
  revokedAt?: utcDateTime;
}

model SessionSummary {
  id: Uuid;
  current: boolean;
  createdAt: utcDateTime;
  lastUsedAt?: utcDateTime;
  expiresAt: utcDateTime;
  revokedAt?: utcDateTime;
}

@tag("Authentication")
@route("/v1/auth")
@useAuth(NoAuth)
namespace Authentication {
  /** Check whether Workspace Telegram storage and admin email login are configured. */
  @get
  @route("/bootstrap-status")
  @operationId("getBootstrapStatus")
  op bootstrapStatus(): JsonResponse<200, BootstrapStatus>;

  /** Authenticate with Workspace email and password and return bearer tokens. */
  @post
  @route("/password/login")
  @operationId("passwordLogin")
  op passwordLogin(@body body: PasswordLoginRequest):
    | JsonResponse<200, TokenPair>
    | ErrorResponse<401>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  /** Authenticate with Workspace email and password and establish an HttpOnly cookie session. */
  @post
  @route("/cookie/password/login")
  @operationId("cookiePasswordLogin")
  op cookiePasswordLogin(@body body: PasswordLoginRequest):
    | CookieSessionResponse<200>
    | ErrorResponse<401>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  /** Begin Telegram authentication and send a login code. */
  @post
  @route("/telegram/start")
  @operationId("telegramLoginStart")
  op telegramStart(
    ...IdempotencyHeader,
    @body body: TelegramLoginStartRequest,
  ):
    | JsonResponse<201, TelegramLoginStartResponse>
    | ErrorResponse<400>
    | ErrorResponse<409>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  /** Begin a resumable Telegram QR login flow. */
  @post
  @route("/telegram/qr/start")
  @operationId("telegramQRLoginStart")
  op qrStart(...IdempotencyHeader):
    | JsonResponse<201, TelegramQRLoginResponse>
    | ErrorResponse<400>
    | ErrorResponse<409>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  /** Poll a Telegram QR login flow. Any API replica can resume the encrypted flow state. */
  @post
  @route("/telegram/qr/poll")
  @operationId("telegramQRLoginPoll")
  op qrPoll(...IdempotencyHeader, @body body: TelegramQRLoginPollRequest):
    | JsonResponse<200, TokenPair>
    | JsonResponse<202, TelegramQRLoginResponse>
    | ErrorResponse<400>
    | ErrorResponse<401>
    | ErrorResponse<410>
    | ErrorResponse<422>
    | ErrorResponse<429>;
  /** Verify the Telegram login code. */
  @post
  @route("/telegram/verify-code")
  @operationId("telegramLoginVerifyCode")
  op verifyCode(...IdempotencyHeader, @body body: TelegramCodeVerifyRequest):
    | JsonResponse<200, TokenPair>
    | JsonResponse<202, TelegramLoginStartResponse>
    | ErrorResponse<400>
    | ErrorResponse<401>
    | ErrorResponse<410>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  /** Complete Telegram two-step verification. */
  @post
  @route("/telegram/verify-password")
  @operationId("telegramLoginVerifyPassword")
  op verifyPassword(
    ...IdempotencyHeader,
    @body body: TelegramPasswordVerifyRequest,
  ):
    | JsonResponse<200, TokenPair>
    | ErrorResponse<400>
    | ErrorResponse<401>
    | ErrorResponse<410>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  /** Rotate an access/refresh token pair. */
  @post
  @route("/refresh")
  @operationId("refreshSession")
  op refresh(@body body: RefreshTokenRequest):
    | JsonResponse<200, TokenPair>
    | ErrorResponse<401>
    | ErrorResponse<429>;

  /** Complete Telegram code verification and establish an HttpOnly cookie session. */
  @post
  @route("/cookie/telegram/verify-code")
  @operationId("cookieTelegramLoginVerifyCode")
  op cookieVerifyCode(
    ...IdempotencyHeader,
    @body body: TelegramCodeVerifyRequest,
  ):
    | CookieSessionResponse<200>
    | JsonResponse<202, TelegramLoginStartResponse>
    | ErrorResponse<400>
    | ErrorResponse<401>
    | ErrorResponse<410>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  /** Complete Telegram password verification and establish an HttpOnly cookie session. */
  @post
  @route("/cookie/telegram/verify-password")
  @operationId("cookieTelegramLoginVerifyPassword")
  op cookieVerifyPassword(
    ...IdempotencyHeader,
    @body body: TelegramPasswordVerifyRequest,
  ):
    | CookieSessionResponse<200>
    | ErrorResponse<400>
    | ErrorResponse<401>
    | ErrorResponse<410>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  /** Poll Telegram QR login and establish an HttpOnly cookie session when authorized. */
  @post
  @route("/cookie/telegram/qr/poll")
  @operationId("cookieTelegramQRLoginPoll")
  op cookieQrPoll(
    ...IdempotencyHeader,
    @body body: TelegramQRLoginPollRequest,
  ):
    | CookieSessionResponse<200>
    | JsonResponse<202, TelegramQRLoginResponse>
    | ErrorResponse<400>
    | ErrorResponse<401>
    | ErrorResponse<410>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  /** Rotate session cookies using the HttpOnly refresh cookie. */
  @post
  @route("/cookie/refresh")
  @operationId("refreshCookieSession")
  op cookieRefresh(...RefreshCookie):
    | CookieSessionResponse<200>
    | ErrorResponse<401>
    | ErrorResponse<429>;

  /** Revoke the cookie session and clear its HttpOnly cookies. */
  @post
  @route("/cookie/logout")
  @operationId("logoutCookieSession")
  @useAuth(CookieAuth)
  op cookieLogout(): CookieSessionNoContent<204> | ErrorResponse<401>;
}

@tag("Account")
@route("/v1")
@useAuth(TelDriveAuth)
namespace Account {
  /** Return the authenticated user profile. */
  @get
  @route("/me")
  @operationId("getCurrentUser")
  op getCurrentUser(): JsonResponse<200, UserProfile> | ErrorResponse<401>;

  /** Return the authenticated Telegram user's small profile photo. */
  @get
  @route("/me/photo")
  @operationId("getProfilePhoto")
  op getProfilePhoto():
    | ProfilePhotoResponse
    | EmptyResponse<204>
    | ErrorResponse<401>
    | ErrorResponse<429>;

  /** Return the authenticated user's web UI preferences, with server defaults for unset values. */
  @get
  @route("/me/preferences")
  @operationId("getUserPreferences")
  op getPreferences(): JsonResponse<200, UserPreferences> | ErrorResponse<401>;

  /** Update a subset of the authenticated user's web UI preferences. */
  @patch
  @route("/me/preferences")
  @operationId("updateUserPreferences")
  op updatePreferences(@body body: UserPreferencesUpdate):
    | JsonResponse<200, UserPreferences>
    | ErrorResponse<401>
    | ErrorResponse<422>;
  /** Change the authenticated user's password. */
  @post
  @route("/me/password")
  @operationId("changePassword")
  op changePassword(@body body: ChangePasswordRequest):
    | EmptyResponse<204>
    | ErrorResponse<401>
    | ErrorResponse<422>;

  /** Bind initial email and password to an existing owner account migrated from Telegram login. */
  @post
  @route("/me/setup-credentials")
  @operationId("setupOwnerCredentials")
  op setupCredentials(@body body: SetupCredentialsRequest):
    | JsonResponse<200, UserProfile>
    | ErrorResponse<401>
    | ErrorResponse<403>
    | ErrorResponse<409>
    | ErrorResponse<422>;

  /** Revoke the current session. */
  @post
  @route("/auth/logout")
  @operationId("logoutSession")
  op logout(): EmptyResponse<204> | ErrorResponse<401>;
}

@tag("Users")
@route("/v1/users")
@useAuth(TelDriveAuth)
namespace Users {
  @get
  @route("/search")
  @operationId("searchUsers")
  op search(
    @query
    @minLength(1)
    @maxLength(128)
    search: string,
  ):
    | JsonResponse<200, UserSearchResult[]>
    | ErrorResponse<401>
    | ErrorResponse<422>;
}

@tag("Administration")
@route("/v1/admin")
@useAuth(TelDriveAuth)
namespace Administration {
  @get
  @route("/overview")
  @operationId("getAdminOverview")
  op overview():
    | JsonResponse<200, AdminOverview>
    | ErrorResponse<401>
    | ErrorResponse<403>;

  @get
  @route("/audit-events")
  @operationId("listAdminAuditEvents")
  op auditEvents(
    ...CursorQuery,
    @query userId?: int64,
    @query @maxLength(128) action?: string,
  ):
    | JsonResponse<200, CursorPage<AdminAuditEvent>>
    | ErrorResponse<401>
    | ErrorResponse<403>
    | ErrorResponse<422>;

  @get
  @route("/users")
  @operationId("listAdminUsers")
  op list(@query @maxLength(128) search?: string):
    | JsonResponse<200, AdminUserSummary[]>
    | ErrorResponse<401>
    | ErrorResponse<403>;

  @post
  @route("/users")
  @operationId("createAdminUser")
  op createUser(@body body: AdminUserCreateRequest):
    | JsonResponse<201, AdminUserSummary>
    | ErrorResponse<401>
    | ErrorResponse<403>
    | ErrorResponse<409>
    | ErrorResponse<422>;

  @get
  @route("/telegram")
  @operationId("getAdminTelegramStatus")
  op telegramStatus():
    | JsonResponse<200, WorkspaceTelegramStatus>
    | ErrorResponse<401>
    | ErrorResponse<403>;

  @post
  @route("/telegram/start")
  @operationId("adminTelegramRelinkStart")
  op telegramStart(
    ...IdempotencyHeader,
    @body body: TelegramLoginStartRequest,
  ):
    | JsonResponse<201, TelegramLoginStartResponse>
    | ErrorResponse<400>
    | ErrorResponse<401>
    | ErrorResponse<403>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  @post
  @route("/telegram/verify-code")
  @operationId("adminTelegramRelinkVerifyCode")
  op telegramVerifyCode(
    ...IdempotencyHeader,
    @body body: TelegramCodeVerifyRequest,
  ):
    | JsonResponse<200, AdminTelegramRelinkVerifyResponse>
    | ErrorResponse<400>
    | ErrorResponse<401>
    | ErrorResponse<403>
    | ErrorResponse<410>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  @post
  @route("/telegram/verify-password")
  @operationId("adminTelegramRelinkVerifyPassword")
  op telegramVerifyPassword(
    ...IdempotencyHeader,
    @body body: TelegramPasswordVerifyRequest,
  ):
    | JsonResponse<200, WorkspaceTelegramStatus>
    | ErrorResponse<400>
    | ErrorResponse<401>
    | ErrorResponse<403>
    | ErrorResponse<410>
    | ErrorResponse<422>
    | ErrorResponse<429>;

  @patch
  @route("/users/{userId}")
  @operationId("updateAdminUser")
  op update(@path userId: int64, @body body: UserAdminUpdateRequest):
    | JsonResponse<200, AdminUserSummary>
    | ErrorResponse<401>
    | ErrorResponse<403>
    | ErrorResponse<404>
    | ErrorResponse<422>;

  @post
  @route("/users/{userId}/revoke-access")
  @operationId("revokeAdminUserAccess")
  op revokeAccess(@path userId: int64):
    | EmptyResponse<204>
    | ErrorResponse<401>
    | ErrorResponse<403>
    | ErrorResponse<404>;
}

@tag("API keys")
@route("/v1/api-keys")
@useAuth(BearerOrCookieAuth)
namespace ApiKeys {
  @get
  @operationId("listApiKeys")
  op list(...CursorQuery):
    | JsonResponse<200, CursorPage<ApiKeySummary>>
    | ErrorResponse<401>;

  @post
  @operationId("createApiKey")
  op create(...IdempotencyHeader, @body body: ApiKeyCreateRequest):
    | JsonResponse<201, ApiKeyCreated>
    | ErrorResponse<401>
    | ErrorResponse<409>
    | ErrorResponse<422>;

  @delete
  @route("/{apiKeyId}")
  @operationId("revokeApiKey")
  op revoke(@path apiKeyId: Uuid):
    | EmptyResponse<204>
    | ErrorResponse<401>
    | ErrorResponse<404>;
}

@tag("Sessions")
@route("/v1/sessions")
@useAuth(BearerOrCookieAuth)
namespace Sessions {
  /** List all TelDrive sessions for the authenticated Telegram account. */
  @get
  @operationId("listSessions")
  op list(...CursorQuery):
    | JsonResponse<200, CursorPage<SessionSummary>>
    | ErrorResponse<401>;

  /** Revoke one TelDrive session. Revoking the current session invalidates its bearer token immediately. */
  @delete
  @route("/{sessionId}")
  @operationId("revokeSession")
  op revoke(@path sessionId: Uuid):
    | EmptyResponse<204>
    | ErrorResponse<401>
    | ErrorResponse<404>;
}
