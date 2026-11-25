package org.janax.chat.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.WindowManager;

import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "VaultSecurity",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class VaultSecurityPlugin extends Plugin {
    private static final String CHANNEL_ID = "janax_messages";
    private static final String CHANNEL_NAME = "تنبيهات الحاسبة";

    @PluginMethod
    public void setScreenSecure(PluginCall call) {
        boolean secure = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (getActivity() == null) {
            call.resolve(new JSObject().put("enabled", false));
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (secure) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            JSObject ret = new JSObject();
            ret.put("enabled", secure);
            call.resolve(ret);
        });
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationsPermCallback");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PermissionCallback
    private void notificationsPermCallback(PluginCall call) {
        boolean granted = getPermissionState("notifications") == PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void showLocalNotification(PluginCall call) {
        String title = call.getString("title", "حاسبة النظام");
        String body = call.getString("body", "لديك إشعار جديد");
        int notifId = call.getInt("id", (int) (System.currentTimeMillis() % 100000));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                call.resolve(new JSObject().put("shown", false));
                return;
            }
        }

        Context context = getContext();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) {
            call.resolve(new JSObject().put("shown", false));
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.enableVibration(true);
                manager.createNotificationChannel(channel);
            }
        }

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            notifId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        manager.notify(notifId, builder.build());
        call.resolve(new JSObject().put("shown", true));
    }

    @PluginMethod
    public void getPendingShare(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            JSObject payload = ((MainActivity) getActivity()).getPendingSharePayload();
            JSObject ret = new JSObject();
            ret.put("payload", payload);
            call.resolve(ret);
            return;
        }
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void clearPendingShare(PluginCall call) {
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).clearPendingSharePayload();
        }
        call.resolve();
    }
}
