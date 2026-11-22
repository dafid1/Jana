package org.janax.chat.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(
    name = "GallerySaver",
    permissions = {
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE }
        )
    }
)
public class GallerySaverPlugin extends Plugin {

    @PluginMethod
    public void saveImage(PluginCall call) {
        String dataUrl = call.getString("dataUrl");
        String fileName = call.getString("fileName", "JanaX_" + System.currentTimeMillis() + ".jpg");

        if (dataUrl == null || dataUrl.isEmpty()) {
            call.reject("Missing image data");
            return;
        }

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            if (getPermissionState("storage") != PermissionState.GRANTED) {
                requestPermissionForAlias("storage", call, "storagePermsCallback");
                return;
            }
        }

        performSave(call, dataUrl, fileName);
    }

    @PermissionCallback
    private void storagePermsCallback(PluginCall call) {
        if (getPermissionState("storage") == PermissionState.GRANTED) {
            String dataUrl = call.getString("dataUrl");
            String fileName = call.getString("fileName", "JanaX_" + System.currentTimeMillis() + ".jpg");
            performSave(call, dataUrl, fileName);
        } else {
            call.reject("Storage permission denied");
        }
    }

    private void performSave(PluginCall call, String dataUrl, String fileName) {
        try {
            String mimeType = "image/jpeg";
            String base64Part = dataUrl;

            int commaIndex = dataUrl.indexOf(',');
            if (commaIndex != -1) {
                String header = dataUrl.substring(0, commaIndex);
                if (header.contains("image/png")) {
                    mimeType = "image/png";
                } else if (header.contains("image/webp")) {
                    mimeType = "image/webp";
                } else if (header.contains("image/gif")) {
                    mimeType = "image/gif";
                }
                base64Part = dataUrl.substring(commaIndex + 1);
            }

            byte[] imageBytes = Base64.decode(base64Part, Base64.DEFAULT);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, mimeType);
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/JanaX");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                Uri collection = MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                Uri itemUri = resolver.insert(collection, values);
                if (itemUri == null) {
                    call.reject("Failed to create MediaStore entry");
                    return;
                }

                try (OutputStream out = resolver.openOutputStream(itemUri)) {
                    if (out == null) {
                        call.reject("Failed to open MediaStore output stream");
                        return;
                    }
                    out.write(imageBytes);
                    out.flush();
                }

                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(itemUri, values, null, null);

                JSObject result = new JSObject();
                result.put("saved", true);
                result.put("uri", itemUri.toString());
                call.resolve(result);
            } else {
                File picturesDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES);
                File janaxDir = new File(picturesDir, "JanaX");
                if (!janaxDir.exists() && !janaxDir.mkdirs()) {
                    call.reject("Failed to create Pictures/JanaX directory");
                    return;
                }

                File destFile = new File(janaxDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(destFile)) {
                    fos.write(imageBytes);
                    fos.flush();
                }

                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[] { destFile.getAbsolutePath() },
                    new String[] { mimeType },
                    null
                );

                JSObject result = new JSObject();
                result.put("saved", true);
                result.put("uri", Uri.fromFile(destFile).toString());
                call.resolve(result);
            }
        } catch (Exception e) {
            call.reject("Failed to save image to gallery: " + e.getMessage(), e);
        }
    }
}
