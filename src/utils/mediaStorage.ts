import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/config';

export interface MediaUploadResult {
  url: string;
  sizeBytes: number;
  source: 'storage' | 'inline';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('فشل قراءة الملف'));
      }
    };
    reader.onerror = () => reject(new Error('تعذر تحويل الملف'));
    reader.readAsDataURL(blob);
  });
}

function sanitizeFileSegment(name: string): string {
  return (name || 'media')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);
}

/**
 * Uploads media (video, voice, document, image) to Firebase Storage with progress tracking.
 * Falls back cleanly to inline DataURL only for small payloads (< 450 KB) if Storage is unavailable/unconfigured.
 */
export async function uploadMediaWithFallback(
  fileOrBlob: Blob | File,
  folderPath: string,
  fileName: string,
  options?: {
    onProgress?: (percent: number) => void;
    inlineFallbackDataUrl?: string;
    maxInlineBytes?: number;
  }
): Promise<MediaUploadResult> {
  const safeName = sanitizeFileSegment(fileName);
  const storagePath = `${folderPath}/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, storagePath);
  const maxInlineBytes = options?.maxInlineBytes ?? 450 * 1024;

  try {
    const uploadTask = uploadBytesResumable(storageRef, fileOrBlob, {
      contentType: fileOrBlob.type || 'application/octet-stream',
    });

    const downloadUrl = await new Promise<string>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        try {
          uploadTask.cancel();
        } catch {
          // Ignore cancel failure
        }
        reject(new Error('STORAGE_TIMEOUT'));
      }, 15000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            options?.onProgress?.(pct);
          }
        },
        (error) => {
          window.clearTimeout(timeoutId);
          reject(error);
        },
        async () => {
          window.clearTimeout(timeoutId);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            options?.onProgress?.(100);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    });

    return {
      url: downloadUrl,
      sizeBytes: fileOrBlob.size,
      source: 'storage',
    };
  } catch (err) {
    // Graceful inline fallback for compact files if Firebase Storage is not enabled on the project yet
    if (options?.inlineFallbackDataUrl && fileOrBlob.size <= maxInlineBytes) {
      options?.onProgress?.(100);
      return {
        url: options.inlineFallbackDataUrl,
        sizeBytes: fileOrBlob.size,
        source: 'inline',
      };
    }

    if (fileOrBlob.size <= maxInlineBytes) {
      const dataUrl = await blobToDataUrl(fileOrBlob);
      options?.onProgress?.(100);
      return {
        url: dataUrl,
        sizeBytes: fileOrBlob.size,
        source: 'inline',
      };
    }

    throw new Error(
      err instanceof Error && err.message === 'STORAGE_TIMEOUT'
        ? 'انتهى وقت رفع الملف إلى التخزين السحابي؛ يرجى تقليل حجم الملف أو التحقق من تفعيل Firebase Storage.'
        : 'تعذر رفع الملف كبير الحجم؛ يرجى التأكد من تفعيل Firebase Storage أو اختيار ملف أصغر من 450 كيلوبايت.'
    );
  }
}
