import {
  Button,
  Card,
  Chip,
  Dropdown,
  Input,
  InputGroup,
  Label,
  Spinner,
  TextField,
} from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { $api } from "@/api/client";
import { userMessage } from "@/api/errors";
import type { FileEntry } from "@/api/types";
import { AppDialog } from "@/components/dialogs/app-dialog";
import { FilePreviewDialog } from "@/components/file-preview-dialog";
import { LinkButton } from "@/components/link-button";
import { fileContentUrl } from "@/features/files/download";
import { useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import { getQueryClient } from "@/lib/queryClient";
import FolderPlusIcon from "~icons/gravity-ui/folder-plus";
import HeartIcon from "~icons/gravity-ui/heart";
import SearchIcon from "~icons/gravity-ui/magnifier";
import PlayIcon from "~icons/gravity-ui/play";
import PlusIcon from "~icons/gravity-ui/plus";
import TrashIcon from "~icons/gravity-ui/trash-bin";
import PictureIcon from "~icons/icon-park-outline/picture-one";
import VideoFileIcon from "~icons/icon-park-outline/video-file";

export const Route = createFileRoute("/photos")({
  component: PhotosWorkspacePage,
});

type PhotosMode = "timeline" | "favorites" | "videos" | "albums";

function PhotosWorkspacePage() {
  const { t, locale } = useAppLocale();
  const formatBytes = useFormatBytes();
  const queryClient = getQueryClient();
  const [mode, setMode] = useState<PhotosMode>("timeline");
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>();
  const [searchQuery, setSearchQuery] = useState("");
  const [previewFile, setPreviewFile] = useState<FileEntry>();
  const [albumDialogOpen, setAlbumDialogOpen] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [albumDesc, setAlbumDesc] = useState("");

  const activeAlbumId = mode === "albums" ? selectedAlbumId : undefined;

  const timelineQuery = $api.useQuery(
    "get",
    "/v1/photos/timeline",
    {
      params: {
        query: {
          favoritesOnly: mode === "favorites" ? true : undefined,
          albumId: activeAlbumId,
          limit: 250,
        },
      },
    },
    { staleTime: 10_000 },
  );

  const albumsQuery = $api.useQuery("get", "/v1/photos/albums", {}, { staleTime: 10_000 });

  const updateMetadata = $api.useMutation("patch", "/v1/photos/files/{fileId}/metadata");
  const createAlbum = $api.useMutation("post", "/v1/photos/albums");
  const deleteAlbum = $api.useMutation("delete", "/v1/photos/albums/{albumId}");
  const addAlbumItem = $api.useMutation("post", "/v1/photos/albums/{albumId}/items");
  const removeAlbumItem = $api.useMutation("delete", "/v1/photos/albums/{albumId}/items/{fileId}");

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "long",
      }),
    [locale],
  );

  const refreshPhotos = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/photos/timeline"] }),
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/photos/albums"] }),
    ]);
  };

  const items = timelineQuery.data ?? [];
  const albums = albumsQuery.data ?? [];
  const trimmedSearch = searchQuery.trim().toLowerCase();

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (mode === "videos" && !item.file.mimeType?.startsWith("video/")) {
        return false;
      }
      if (!trimmedSearch) return true;
      const haystack = [item.file.name, item.cameraMake ?? "", item.cameraModel ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmedSearch);
    });
  }, [items, mode, trimmedSearch]);

  const filteredAlbums = useMemo(() => {
    if (!trimmedSearch) return albums;
    return albums.filter((album) =>
      `${album.name} ${album.description ?? ""}`.toLowerCase().includes(trimmedSearch),
    );
  }, [albums, trimmedSearch]);

  const highlightCards = useMemo(() => {
    const firstImage = items.find((item) => item.file.mimeType?.startsWith("image/"));
    const favoriteItem =
      items.find((item) => item.favorite && item.file.mimeType?.startsWith("image/")) ??
      items.find((item) => item.favorite);
    const videoItem = items.find((item) => item.file.mimeType?.startsWith("video/"));
    const cards: {
      id: string;
      title: string;
      coverFile?: FileEntry;
      icon: "photo" | "heart" | "video" | "album";
      onPress: () => void;
    }[] = [];

    if (items.length > 0) {
      const target = firstImage ?? items[0];
      cards.push({
        id: "recent",
        title: t("photos.memoryRecent"),
        coverFile: target.file.mimeType?.startsWith("image/") ? target.file : undefined,
        icon: "photo",
        onPress: () => setPreviewFile(target.file),
      });
    }
    if (favoriteItem) {
      cards.push({
        id: "favorites",
        title: t("photos.memoryFavorites"),
        coverFile: favoriteItem.file.mimeType?.startsWith("image/")
          ? favoriteItem.file
          : firstImage?.file,
        icon: "heart",
        onPress: () => {
          setMode("favorites");
          setSelectedAlbumId(undefined);
        },
      });
    }
    if (videoItem) {
      cards.push({
        id: "videos",
        title: t("photos.memoryVideos"),
        coverFile: firstImage?.file,
        icon: "video",
        onPress: () => {
          setMode("videos");
          setSelectedAlbumId(undefined);
        },
      });
    }
    if (albums.length > 0) {
      cards.push({
        id: "albums",
        title: t("photos.memoryAlbums"),
        coverFile: firstImage?.file,
        icon: "album",
        onPress: () => {
          setMode("albums");
          setSelectedAlbumId(undefined);
        },
      });
    }
    return cards;
  }, [albums.length, items, t]);

  const groupedByDate = useMemo(() => {
    const groups = new Map<string, typeof filteredItems>();
    for (const item of filteredItems) {
      const rawDate = item.takenAt ?? item.file.modTime ?? item.file.createdAt;
      const dayLabel = dateFormatter.format(new Date(rawDate));
      const existing = groups.get(dayLabel);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(dayLabel, [item]);
      }
    }
    return Array.from(groups.entries());
  }, [filteredItems, dateFormatter]);

  const handleToggleFavorite = async (fileId: string, current: boolean) => {
    try {
      await updateMetadata.mutateAsync({
        params: { path: { fileId } },
        body: { favorite: !current },
      });
      await refreshPhotos();
    } catch (error) {
      toast.error(t("photos.actionFailed"), { description: userMessage(error) });
    }
  };

  const handleCreateAlbum = async () => {
    const trimmed = albumName.trim();
    if (!trimmed) return;
    try {
      const created = await createAlbum.mutateAsync({
        body: {
          name: trimmed,
          description: albumDesc.trim() || undefined,
        },
      });
      setAlbumName("");
      setAlbumDesc("");
      setAlbumDialogOpen(false);
      setMode("albums");
      setSelectedAlbumId(created.id);
      await refreshPhotos();
      toast.success(t("photos.albumCreated"));
    } catch (error) {
      toast.error(t("photos.actionFailed"), { description: userMessage(error) });
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    try {
      await deleteAlbum.mutateAsync({ params: { path: { albumId } } });
      if (selectedAlbumId === albumId) setSelectedAlbumId(undefined);
      await refreshPhotos();
      toast.success(t("photos.albumDeleted"));
    } catch (error) {
      toast.error(t("photos.actionFailed"), { description: userMessage(error) });
    }
  };

  const handleAddToAlbum = async (albumId: string, fileId: string) => {
    try {
      await addAlbumItem.mutateAsync({
        params: { path: { albumId } },
        body: { fileId },
      });
      await refreshPhotos();
      toast.success(t("photos.addedToAlbum"));
    } catch (error) {
      toast.error(t("photos.actionFailed"), { description: userMessage(error) });
    }
  };

  const handleRemoveFromAlbum = async (albumId: string, fileId: string) => {
    try {
      await removeAlbumItem.mutateAsync({
        params: { path: { albumId, fileId } },
      });
      await refreshPhotos();
      toast.success(t("photos.removedFromAlbum"));
    } catch (error) {
      toast.error(t("photos.actionFailed"), { description: userMessage(error) });
    }
  };

  const selectedAlbum = albums.find((a) => a.id === selectedAlbumId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("apps.photos")}</h1>
          <p className="text-sm text-muted">{t("photos.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:w-64" variant="secondary">
            <InputGroup.Prefix>
              <SearchIcon className="size-4 text-muted" />
            </InputGroup.Prefix>
            <InputGroup.Input
              aria-label={t("photos.searchPlaceholder")}
              placeholder={t("photos.searchPlaceholder")}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </InputGroup>
          <Button variant="primary" size="sm" onPress={() => setAlbumDialogOpen(true)}>
            <PlusIcon className="size-4" />
            {t("photos.newAlbum")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={mode === "timeline" ? "primary" : "secondary"}
          size="sm"
          className="rounded-full"
          onPress={() => {
            setMode("timeline");
            setSelectedAlbumId(undefined);
          }}
        >
          {t("photos.tabTimeline")}
        </Button>
        <Button
          variant={mode === "favorites" ? "primary" : "secondary"}
          size="sm"
          className="rounded-full"
          onPress={() => {
            setMode("favorites");
            setSelectedAlbumId(undefined);
          }}
        >
          {t("photos.tabFavorites")}
        </Button>
        <Button
          variant={mode === "videos" ? "primary" : "secondary"}
          size="sm"
          className="rounded-full"
          onPress={() => {
            setMode("videos");
            setSelectedAlbumId(undefined);
          }}
        >
          {t("photos.tabVideos")}
        </Button>
        <Button
          variant={mode === "albums" ? "primary" : "secondary"}
          size="sm"
          className="rounded-full"
          onPress={() => setMode("albums")}
        >
          {t("photos.tabAlbums")} ({albums.length})
        </Button>
      </div>

      {mode === "timeline" && !trimmedSearch && highlightCards.length > 0 ? (
        <section className="space-y-2.5">
          <h2 className="text-sm font-semibold text-foreground">{t("photos.memoriesTitle")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {highlightCards.map((card) => (
              <Button
                key={card.id}
                variant="ghost"
                onPress={card.onPress}
                className="group relative h-44 w-36 shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-surface-secondary p-0 sm:w-40"
              >
                {card.coverFile ? (
                  <img
                    src={fileContentUrl(card.coverFile)}
                    alt={card.title}
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-surface-secondary">
                    {card.icon === "video" ? (
                      <VideoFileIcon className="size-10 text-muted" />
                    ) : (
                      <PictureIcon className="size-10 text-muted" />
                    )}
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-left text-xs font-semibold leading-snug text-white">
                  {card.title}
                </span>
              </Button>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "albums" && !selectedAlbumId ? (
        albumsQuery.isPending ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : filteredAlbums.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted">{t("photos.albumsEmpty")}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAlbums.map((album) => (
              <Card key={album.id} className="flex flex-col justify-between gap-3 p-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="truncate text-base font-semibold">{album.name}</h2>
                    <Chip size="sm" variant="soft">
                      {t("photos.itemCount", { count: album.itemCount })}
                    </Chip>
                  </div>
                  {album.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">{album.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => setSelectedAlbumId(album.id)}
                  >
                    {t("photos.openAlbum")}
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={t("photos.deleteAlbum")}
                    onPress={() => void handleDeleteAlbum(album.id)}
                  >
                    <TrashIcon className="size-4 text-danger" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : (
        <>
          {mode === "albums" && selectedAlbum ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary/40 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{selectedAlbum.name}</p>
                {selectedAlbum.description ? (
                  <p className="text-xs text-muted">{selectedAlbum.description}</p>
                ) : null}
              </div>
              <Button size="sm" variant="secondary" onPress={() => setSelectedAlbumId(undefined)}>
                {t("photos.allAlbums")}
              </Button>
            </div>
          ) : null}

          {timelineQuery.isPending ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : groupedByDate.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-muted">{t("photos.empty")}</p>
              <LinkButton
                to="/files"
                search={{ path: "/", query: "", view: "list" }}
                variant="primary"
                size="sm"
              >
                {t("apps.openDrive")}
              </LinkButton>
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedByDate.map(([dayLabel, dayItems]) => (
                <section key={dayLabel} className="space-y-2.5">
                  <h2 className="text-sm font-semibold text-foreground">{dayLabel}</h2>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {dayItems.map((item) => {
                      const isImage = item.file.mimeType?.startsWith("image/");
                      return (
                        <div
                          key={item.file.id}
                          className="group relative aspect-square overflow-hidden rounded-lg bg-surface-secondary"
                        >
                          <Button
                            variant="ghost"
                            aria-label={item.file.name}
                            className="block size-full rounded-none p-0"
                            onPress={() => setPreviewFile(item.file)}
                          >
                            {isImage ? (
                              <img
                                src={fileContentUrl(item.file)}
                                alt={item.file.name}
                                loading="lazy"
                                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex size-full flex-col items-center justify-center gap-2 bg-surface-secondary/80 p-3">
                                <VideoFileIcon className="size-8 text-muted" />
                                <span className="line-clamp-2 text-center text-xs font-medium text-foreground">
                                  {item.file.name}
                                </span>
                              </div>
                            )}
                          </Button>
                          {!isImage ? (
                            <span className="pointer-events-none absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                              <PlayIcon className="size-3" />
                              Video
                            </span>
                          ) : null}
                          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 pr-16 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <p className="truncate text-xs font-medium text-white">
                              {item.file.name}
                            </p>
                            {item.file.size !== undefined ? (
                              <p className="text-[11px] text-white/75">
                                {formatBytes(item.file.size)}
                              </p>
                            ) : null}
                          </div>
                          <div
                            className={`absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 transition-opacity duration-200 ${
                              item.favorite
                                ? "opacity-100"
                                : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100"
                            }`}
                          >
                            <Button
                              isIconOnly
                              size="sm"
                              variant="secondary"
                              className="size-7 min-w-7 rounded-full bg-black/65 text-white backdrop-blur-sm hover:bg-black/85"
                              aria-label={t("photos.toggleFavorite")}
                              onPress={() =>
                                void handleToggleFavorite(item.file.id, item.favorite)
                              }
                            >
                              <HeartIcon
                                className={`size-3.5 ${item.favorite ? "text-danger" : "text-white"}`}
                              />
                            </Button>
                            {activeAlbumId ? (
                              <Button
                                isIconOnly
                                size="sm"
                                variant="secondary"
                                className="size-7 min-w-7 rounded-full bg-black/65 text-white backdrop-blur-sm hover:bg-black/85"
                                aria-label={t("photos.removeFromAlbum")}
                                onPress={() =>
                                  void handleRemoveFromAlbum(activeAlbumId, item.file.id)
                                }
                              >
                                <TrashIcon className="size-3.5 text-white" />
                              </Button>
                            ) : albums.length > 0 ? (
                              <Dropdown>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="secondary"
                                  className="size-7 min-w-7 rounded-full bg-black/65 text-white backdrop-blur-sm hover:bg-black/85"
                                  aria-label={t("photos.addToAlbum")}
                                >
                                  <FolderPlusIcon className="size-3.5 text-white" />
                                </Button>
                                <Dropdown.Popover className="min-w-44">
                                  <Dropdown.Menu
                                    aria-label={t("photos.addToAlbum")}
                                    onAction={(key) =>
                                      void handleAddToAlbum(String(key), item.file.id)
                                    }
                                  >
                                    {albums.map((album) => (
                                      <Dropdown.Item key={album.id} id={album.id} textValue={album.name}>
                                        <Label>{album.name}</Label>
                                      </Dropdown.Item>
                                    ))}
                                  </Dropdown.Menu>
                                </Dropdown.Popover>
                              </Dropdown>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <AppDialog
        open={albumDialogOpen}
        onOpenChange={setAlbumDialogOpen}
        title={t("photos.newAlbum")}
        size="md"
        footer={
          <>
            <Button variant="secondary" onPress={() => setAlbumDialogOpen(false)}>
              {t("dialog.cancel")}
            </Button>
            <Button
              variant="primary"
              isDisabled={!albumName.trim() || createAlbum.isPending}
              onPress={() => void handleCreateAlbum()}
            >
              {t("photos.createAlbum")}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField value={albumName} onChange={setAlbumName} autoFocus>
            <Label>{t("photos.albumName")}</Label>
            <Input placeholder={t("photos.albumNamePh")} />
          </TextField>
          <TextField value={albumDesc} onChange={setAlbumDesc}>
            <Label>{t("photos.albumDesc")}</Label>
            <Input placeholder={t("photos.albumDescPh")} />
          </TextField>
        </div>
      </AppDialog>

      <FilePreviewDialog
        file={previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(undefined);
        }}
      />
    </div>
  );
}
