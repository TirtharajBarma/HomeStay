/**
 * Homestay photos on Cloudinary. The server signs each upload (GET /upload/signature); the photo goes
 * straight from the phone to Cloudinary, never through our API. Only the returned https URL is saved
 * on the homestay (updateHomestay → PUT /homestay → MongoDB), which every device then syncs.
 */
import { api } from '../data/api';

type PickedPhoto = { uri: string; mimeType?: string | null; fileName?: string | null };

/** Upload one picked photo and return its permanent https URL. Throws with a readable message. */
export async function uploadPhoto(photo: PickedPhoto): Promise<string> {
  const sig = await api.get('/upload/signature');
  const form = new FormData();
  // React Native's FormData takes a { uri, type, name } object for a local file
  form.append('file', { uri: photo.uri, type: photo.mimeType || 'image/jpeg', name: photo.fileName || 'photo.jpg' } as any);
  form.append('api_key', String(sig.apiKey));
  // Exactly the params the server signed, with the same values
  for (const k of ['allowed_formats', 'folder', 'timestamp', 'transformation', 'signature']) form.append(k, String(sig[k]));
  let res: Response;
  try {
    res = await fetch(String(sig.uploadUrl), { method: 'POST', body: form });
  } catch {
    throw new Error('No connection. Check your internet and try again.');
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || typeof data.secure_url !== 'string') {
    throw new Error(data?.error?.message ? `Photo upload failed: ${data.error.message}` : 'Photo upload failed. Please try again.');
  }
  return data.secure_url;
}

/** A stored photo that can be shown as an image (older homestays may hold plain text labels). */
export const isImagePhoto = (p: string) => p.startsWith('https://') || p.startsWith('data:image/');

/** Display URL: Cloudinary resizes it and picks the best format/quality for the device. */
export const photoUrl = (p: string, width: number) =>
  p.includes('res.cloudinary.com/') ? p.replace('/image/upload/', `/image/upload/f_auto,q_auto,c_limit,w_${width}/`) : p;
