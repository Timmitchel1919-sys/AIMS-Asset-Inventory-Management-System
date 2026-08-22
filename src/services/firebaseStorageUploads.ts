import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { requireFirebase } from "../lib/firebase";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export function safeUploadName(name: string) {
  const sanitized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
  return sanitized.replace(/^[.-]+|[.-]+$/g, "").slice(0, 120) || "file";
}

export function validateUpload(file: Pick<File, "size" | "type" | "name">) {
  if (file.size <= 0)
    throw new Error(`${file.name}: empty files are not allowed.`);
  if (file.size >= MAX_UPLOAD_BYTES)
    throw new Error(`${file.name}: maximum file size is 10 MB.`);
  if (!ALLOWED_UPLOAD_TYPES.has(file.type))
    throw new Error(`${file.name}: this file type is not allowed.`);
}

export async function uploadAimsFiles(
  files: File[],
  area: "repairs" | "disposals" | "assets" | "movements" | "assignments" | "borrows",
  recordId: string,
) {
  if (!files.length) return [];
  const { auth, storage } = requireFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in before uploading files.");

  return Promise.all(
    files.map(async (file) => {
      validateUpload(file);
      const objectRef = ref(
        storage,
        `aims/${uid}/${area}/${recordId}/${crypto.randomUUID()}-${safeUploadName(file.name)}`,
      );
      await uploadBytes(objectRef, file, { contentType: file.type });
      return getDownloadURL(objectRef);
    }),
  );
}
