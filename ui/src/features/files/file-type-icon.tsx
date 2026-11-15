import FileIcon from "~icons/gravity-ui/file";
import AudioFileIcon from "~icons/icon-park-outline/audio-file";
import BookIcon from "~icons/icon-park-outline/book-one";
import FileCodeIcon from "~icons/icon-park-outline/file-code";
import FileExcelIcon from "~icons/icon-park-outline/file-excel";
import FilePdfIcon from "~icons/icon-park-outline/file-pdf";
import FilePptIcon from "~icons/icon-park-outline/file-ppt";
import FileTextIcon from "~icons/icon-park-outline/file-text";
import FileWordIcon from "~icons/icon-park-outline/file-word";
import FileZipIcon from "~icons/icon-park-outline/file-zip";
import PictureIcon from "~icons/icon-park-outline/picture-one";
import VideoFileIcon from "~icons/icon-park-outline/video-file";

export type FileTypeLike = {
  name: string;
  mimeType?: string | null;
};

const ebookExtensions = [".epub", ".mobi", ".azw", ".azw3", ".fb2", ".fbz", ".cbz", ".cbr"];

const archiveExtensions = [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".bz2", ".xz"];

const wordExtensions = [".doc", ".docx", ".odt", ".rtf"];
const sheetExtensions = [".xls", ".xlsx", ".ods", ".csv"];
const slideExtensions = [".ppt", ".pptx", ".odp", ".key"];

const imageExtensions = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".bmp",
  ".ico",
  ".heic",
  ".heif",
];

const videoExtensions = [".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".ogv"];
const audioExtensions = [".mp3", ".wav", ".flac", ".ogg", ".oga", ".opus", ".m4a", ".aac"];

const codeExtensions = new Set([
  "bash",
  "c",
  "cc",
  "cpp",
  "cs",
  "css",
  "dockerfile",
  "go",
  "graphql",
  "h",
  "hpp",
  "html",
  "java",
  "js",
  "json",
  "jsx",
  "kt",
  "kts",
  "php",
  "py",
  "rb",
  "rs",
  "scss",
  "sh",
  "sql",
  "swift",
  "toml",
  "ts",
  "tsx",
  "vue",
  "xml",
  "yaml",
  "yml",
]);

const textExtensions = [".txt", ".md", ".mdx", ".log"];

function extensionOf(name: string) {
  const lower = name.toLowerCase();
  if (lower === "dockerfile") return "dockerfile";
  const dot = lower.lastIndexOf(".");
  return dot >= 0 ? lower.slice(dot + 1) : "";
}

function endsWithAny(name: string, extensions: string[]) {
  return extensions.some((extension) => name.endsWith(extension));
}

// Per-type file icons, following the same idea as OpenChamber's
// FileTypeIcon: resolve by mime type first, file extension second,
// with a generic file icon as fallback.
export function FileTypeIcon({ file, className }: { file: FileTypeLike; className?: string }) {
  const name = file.name.toLowerCase();
  const mime = (file.mimeType || "").toLowerCase();
  const extension = extensionOf(file.name);
  const base = className ?? "";

  if (mime === "application/pdf" || name.endsWith(".pdf"))
    return <FilePdfIcon className={`${base} text-[#ea4335] dark:text-[#f28b82]`} />;
  if (
    mime.includes("epub") ||
    mime.includes("mobipocket") ||
    mime.includes("fictionbook") ||
    mime.includes("comicbook") ||
    endsWithAny(name, ebookExtensions)
  )
    return <BookIcon className={`${base} text-[#f29900] dark:text-[#fdd663]`} />;
  if (mime.startsWith("image/") || endsWithAny(name, imageExtensions))
    return <PictureIcon className={`${base} text-[#d93025] dark:text-[#f28b82]`} />;
  if (mime.startsWith("video/") || endsWithAny(name, videoExtensions))
    return <VideoFileIcon className={`${base} text-[#ea4335] dark:text-[#f28b82]`} />;
  if (mime.startsWith("audio/") || endsWithAny(name, audioExtensions))
    return <AudioFileIcon className={`${base} text-[#9334e6] dark:text-[#c58af9]`} />;
  if (endsWithAny(name, archiveExtensions))
    return <FileZipIcon className={`${base} text-[#5f6368] dark:text-[#9aa0a6]`} />;
  if (
    mime.includes("wordprocessing") ||
    mime.includes("msword") ||
    mime.includes("wordprocessingml") ||
    endsWithAny(name, wordExtensions)
  )
    return <FileWordIcon className={`${base} text-[#1a73e8] dark:text-[#8ab4f8]`} />;
  if (mime.includes("spreadsheet") || mime === "text/csv" || endsWithAny(name, sheetExtensions))
    return <FileExcelIcon className={`${base} text-[#188038] dark:text-[#81c995]`} />;
  if (mime.includes("presentation") || endsWithAny(name, slideExtensions))
    return <FilePptIcon className={`${base} text-[#f29900] dark:text-[#fdd663]`} />;
  if (
    codeExtensions.has(extension) ||
    mime.includes("json") ||
    mime.includes("javascript") ||
    mime.includes("typescript") ||
    mime.includes("xml") ||
    mime.includes("yaml")
  )
    return <FileCodeIcon className={`${base} text-[#00897b] dark:text-[#4db6ac]`} />;
  if (mime.startsWith("text/") || endsWithAny(name, textExtensions))
    return <FileTextIcon className={`${base} text-[#1a73e8] dark:text-[#8ab4f8]`} />;
  return <FileIcon className={base} />;
}
