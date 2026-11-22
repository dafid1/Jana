import { Capacitor, registerPlugin } from '@capacitor/core';

interface GallerySaverPlugin {
  saveImage(options: { dataUrl: string; fileName: string }): Promise<{ saved: boolean; uri?: string }>;
}

const GallerySaver = registerPlugin<GallerySaverPlugin>('GallerySaver');

function inferExtensionFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

async function resolveBlobAndDataUrl(
  sourceUrl: string
): Promise<{ blob: Blob; dataUrl: string; mime: string }> {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error('تعذر جلب الصورة للحفظ');
  }
  const blob = await response.blob();
  const mime = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('فشل تحويل الصورة'));
      }
    };
    reader.onerror = () => reject(new Error('فشل قراءة بيانات الصورة'));
    reader.readAsDataURL(blob);
  });

  return { blob, dataUrl, mime };
}

export async function saveImageToGallery(
  sourceUrl: string,
  preferredName?: string
): Promise<'gallery' | 'downloads'> {
  const { blob, dataUrl, mime } = await resolveBlobAndDataUrl(sourceUrl);
  const ext = inferExtensionFromMime(mime);
  const baseName = (preferredName || `JanaX_${Date.now()}`)
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .replace(/\.[^.]+$/, '');
  const finalFileName = `${baseName || `JanaX_${Date.now()}`}.${ext}`;

  if (Capacitor.isNativePlatform()) {
    await GallerySaver.saveImage({
      dataUrl,
      fileName: finalFileName,
    });
    return 'gallery';
  }

  // Web / PWA save without popup/navigation
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = finalFileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }
  return 'downloads';
}
