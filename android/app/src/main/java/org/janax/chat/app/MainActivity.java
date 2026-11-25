package org.janax.chat.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public class MainActivity extends BridgeActivity {
    private OnBackPressedCallback backPressedCallback;
    private volatile boolean shouldInterceptBack = false;
    private JSObject pendingSharePayload = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GallerySaverPlugin.class);
        registerPlugin(BackNavigationPlugin.class);
        registerPlugin(VaultSecurityPlugin.class);
        super.onCreate(savedInstanceState);

        extractShareIntent(getIntent());

        backPressedCallback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                Bridge currentBridge = getBridge();
                WebView webView = currentBridge != null ? currentBridge.getWebView() : null;
                if (webView == null) {
                    allowSystemBackExit();
                    return;
                }

                webView.evaluateJavascript(
                    "(function(){ try { return window.__janaxHandleAndroidBack ? window.__janaxHandleAndroidBack() : 'missing'; } catch (e) { return 'exit'; } })()",
                    value -> {
                        if ("\"handled\"".equals(value) || "handled".equals(value)) {
                            return;
                        }
                        if ("\"missing\"".equals(value) && webView.canGoBack()) {
                            webView.goBack();
                            return;
                        }
                        allowSystemBackExit();
                    }
                );
            }
        };

        getOnBackPressedDispatcher().addCallback(this, backPressedCallback);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (extractShareIntent(intent)) {
            Bridge currentBridge = getBridge();
            WebView webView = currentBridge != null ? currentBridge.getWebView() : null;
            if (webView != null) {
                webView.post(() -> webView.evaluateJavascript(
                    "window.__janaxOnNativeShare && window.__janaxOnNativeShare();",
                    null
                ));
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (backPressedCallback != null) {
            backPressedCallback.setEnabled(shouldInterceptBack);
        }
    }

    public void setBackInterceptionEnabled(boolean enabled) {
        shouldInterceptBack = enabled;
        runOnUiThread(() -> {
            if (backPressedCallback != null) {
                backPressedCallback.setEnabled(enabled);
            }
        });
    }

    public JSObject getPendingSharePayload() {
        return pendingSharePayload;
    }

    public void clearPendingSharePayload() {
        pendingSharePayload = null;
    }

    private boolean extractShareIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return false;
        }
        String type = intent.getType();
        if (type == null) return false;

        if ("text/plain".equals(type)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (sharedText != null && !sharedText.trim().isEmpty()) {
                JSObject payload = new JSObject();
                payload.put("type", "text");
                payload.put("text", sharedText.trim());
                pendingSharePayload = payload;
                return true;
            }
        } else if (type.startsWith("image/")) {
            Uri imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (imageUri != null) {
                String dataUrl = readImageUriAsCompressedDataUrl(imageUri);
                if (dataUrl != null) {
                    JSObject payload = new JSObject();
                    payload.put("type", "image");
                    payload.put("dataUrl", dataUrl);
                    payload.put("mimeType", "image/jpeg");
                    payload.put("fileName", "shared_" + System.currentTimeMillis() + ".jpg");
                    String caption = intent.getStringExtra(Intent.EXTRA_TEXT);
                    if (caption != null && !caption.trim().isEmpty()) {
                        payload.put("text", caption.trim());
                    }
                    pendingSharePayload = payload;
                    return true;
                }
            }
        }
        return false;
    }

    private String readImageUriAsCompressedDataUrl(Uri uri) {
        try {
            ContentResolver resolver = getContentResolver();
            try (InputStream is = resolver.openInputStream(uri)) {
                if (is == null) return null;
                Bitmap bitmap = BitmapFactory.decodeStream(is);
                if (bitmap == null) return null;

                int maxDim = 1280;
                int w = bitmap.getWidth();
                int h = bitmap.getHeight();
                if (w > maxDim || h > maxDim) {
                    float scale = Math.min((float) maxDim / w, (float) maxDim / h);
                    int nw = Math.max(1, Math.round(w * scale));
                    int nh = Math.max(1, Math.round(h * scale));
                    bitmap = Bitmap.createScaledBitmap(bitmap, nw, nh, true);
                }

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, 82, baos);
                byte[] bytes = baos.toByteArray();
                return "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP);
            }
        } catch (Exception e) {
            return null;
        }
    }

    private void allowSystemBackExit() {
        shouldInterceptBack = false;
        if (backPressedCallback != null) {
            backPressedCallback.setEnabled(false);
        }
        getOnBackPressedDispatcher().onBackPressed();
    }
}
