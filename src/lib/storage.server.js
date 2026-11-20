import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET = "product-images";
const allowed = new Map([
  ["image/jpeg","jpg"],
  ["image/png","png"],
  ["image/webp","webp"],
]);

export async function createProductUpload({ contentType, size }) {
  const extension = allowed.get(contentType);
  if (!extension) throw new Error("Format accepté : JPG, PNG ou WebP.");
  if (!Number.isFinite(size) || size < 1 || size > 5 * 1024 * 1024) {
    throw new Error("L'image doit peser 5 Mo maximum.");
  }
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.AWS_REGION || "us-east-2";
  if (!endpoint || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("Les identifiants Neon Object Storage ne sont pas configurés.");
  }
  const key = `products/${crypto.randomUUID()}.${extension}`;
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  return {
    key,
    uploadUrl,
    publicUrl: `${endpoint.replace(/\/$/,"")}/${BUCKET}/${key}`,
    headers: { "Content-Type": contentType },
  };
}


/** Admin-only helper: signed upload for the animated storefront cover. */
export async function createCoverUpload({ contentType, size }) {
  if (contentType !== "image/gif") {
    throw new Error("La couverture doit être un fichier GIF.");
  }
  if (!Number.isFinite(size) || size < 1 || size > 5 * 1024 * 1024) {
    throw new Error("Le GIF doit peser 5 Mo maximum.");
  }
  const endpoint = process.env.AWS_ENDPOINT_URL_S3;
  const region = process.env.AWS_REGION || "us-east-2";
  if (!endpoint || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("Les identifiants Neon Object Storage ne sont pas configurés.");
  }
  const key = `site/covers/lama-market-cover-${crypto.randomUUID()}.gif`;
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: "image/gif",
    CacheControl: "public, max-age=300",
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  return {
    key,
    uploadUrl,
    publicUrl: `${endpoint.replace(/\/$/, "")}/${BUCKET}/${key}`,
    headers: { "Content-Type": "image/gif" },
  };
}
