package org.janax.chat.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BackNavigation")
public class BackNavigationPlugin extends Plugin {

    @PluginMethod
    public void setCanGoBack(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setBackInterceptionEnabled(enabled);
        }
        JSObject ret = new JSObject();
        ret.put("enabled", enabled);
        call.resolve(ret);
    }
}
