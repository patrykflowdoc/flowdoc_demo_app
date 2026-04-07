import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import multer from "multer";
import sharp from "sharp";

export const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2048;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const KIND_TO_SUBDIR = {
  company: "company",
  dish: "dishes",
  bundle: "bundles",
  configurableSet: "configurable-sets",
  extra: "extras",
  extraBundle: "extra-bundles",
};

export function getUploadSubdirByKind(kind) {
  return KIND_TO_SUBDIR[kind] ?? null;
}

export async function ensureUploadRoot() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function makeAbsSubdir(subdir) {
  return path.join(UPLOAD_DIR, subdir);
}

export async function ensureUploadSubdir(subdir) {
  await fs.mkdir(makeAbsSubdir(subdir), { recursive: true });
}

function createStorage(subdir) {
  return multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureUploadSubdir(subdir);
        cb(null, makeAbsSubdir(subdir));
      } catch (err) {
        cb(err);
      }
    },
    filename: (_req, _file, cb) => {
      cb(null, `${randomUUID()}.upload`);
    },
  });
}

export function createImageMulter(subdir) {
  return multer({
    storage: createStorage(subdir),
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(new Error("Nieobsługiwany format obrazu."));
        return;
      }
      cb(null, true);
    },
  });
}

export async function normalizeUploadedImage(filePath, subdir) {
  const outputDir = makeAbsSubdir(subdir);
  const outputPath = path.join(outputDir, `${randomUUID()}.webp`);
  try {
    const image = sharp(filePath, { failOn: "error" }).rotate();
    await image
      .resize(MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toFile(outputPath);
    await fs.unlink(filePath).catch(() => {});
    return outputPath;
  } catch (err) {
    await fs.unlink(filePath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    throw err;
  }
}

export function toUploadUrl(absPath) {
  const rel = path.relative(UPLOAD_DIR, absPath).split(path.sep).join("/");
  return `/uploads/${rel}`;
}

function getUploadAbsPathFromUrl(urlValue) {
  if (typeof urlValue !== "string" || urlValue.length === 0) return null;
  const parsed = new URL(urlValue, "http://localhost");
  if (!parsed.pathname.startsWith("/uploads/")) return null;
  const rel = parsed.pathname.slice("/uploads/".length);
  const abs = path.resolve(UPLOAD_DIR, rel);
  const uploadRootWithSep = `${UPLOAD_DIR}${path.sep}`;
  if (!abs.startsWith(uploadRootWithSep)) return null;
  return abs;
}

export function isUploadPathUrl(urlValue) {
  return getUploadAbsPathFromUrl(urlValue) != null;
}

export async function deleteStoredUploadIfAppOwned(urlValue) {
  const abs = getUploadAbsPathFromUrl(urlValue);
  if (!abs) return false;
  try {
    await fs.unlink(abs);
    return true;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return false;
    }
    throw err;
  }
}
