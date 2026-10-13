package com.xuelinhu.whiteboardvideostudio;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(StudioNativePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
