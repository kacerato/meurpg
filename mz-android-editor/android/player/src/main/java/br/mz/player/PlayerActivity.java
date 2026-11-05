package br.mz.player;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.res.AssetManager;
import android.os.Bundle;
import android.util.Log;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Player de jogos RPG Maker MZ: WebView em tela cheia que serve assets/www/** numa origem
 * HTTPS fixa (https://appassets.androidplatform.net/) interceptando as requisições.
 * Origem fixa = saves do localforage/IndexedDB persistem entre execuções; XHR (main.js testa
 * XHR em document.currentScript.src, áudio e imagens criptografadas usam XHR) funciona, ao
 * contrário de file://.
 */
public class PlayerActivity extends Activity {
    private static final String TAG = "MZ.Player";
    static final String HOST = "appassets.androidplatform.net";
    static final String ORIGIN = "https://" + HOST + "/";

    private WebView web;
    private AssetManager assets;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        assets = getAssets();
        applyAppJson();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setBackgroundColor(0xff000000);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                if (!HOST.equals(req.getUrl().getHost())) {
                    return null;
                }
                return serve(req);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d(TAG, "[game] " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });
        setContentView(web);
        applyImmersive();
        web.loadUrl(ORIGIN + "index.html");
    }

    /** assets/www/app.json: {"title": "..."} gravado pelo editor na exportação. */
    private void applyAppJson() {
        try (InputStream in = assets.open("www/app.json")) {
            JSONObject o = new JSONObject(new String(readAll(in), StandardCharsets.UTF_8));
            String title = o.optString("title", "");
            if (!title.isEmpty()) {
                setTitle(title);
                setTaskDescription(new ActivityManager.TaskDescription(title));
            }
        } catch (Exception ignored) {
        }
    }

    private WebResourceResponse serve(WebResourceRequest req) {
        String path = req.getUrl().getPath();
        if (path == null || path.equals("/") || path.isEmpty()) {
            path = "/index.html";
        }
        if (path.contains("..")) {
            return error(403, "Forbidden");
        }
        String rel = "www" + path;
        String type = mime(path);
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-cache");
        try {
            String range = req.getRequestHeaders() != null ? req.getRequestHeaders().get("Range") : null;
            if (range == null && req.getRequestHeaders() != null) {
                range = req.getRequestHeaders().get("range");
            }
            if (range != null && range.startsWith("bytes=")) {
                byte[] all;
                try (InputStream in = assets.open(rel)) {
                    all = readAll(in);
                }
                long size = all.length;
                long start = 0;
                long end = size - 1;
                String[] r = range.substring(6).split("-", 2);
                if (!r[0].isEmpty()) {
                    start = Long.parseLong(r[0]);
                    if (r.length > 1 && !r[1].isEmpty()) {
                        end = Math.min(size - 1, Long.parseLong(r[1]));
                    }
                } else if (r.length > 1 && !r[1].isEmpty()) {
                    start = Math.max(0, size - Long.parseLong(r[1]));
                }
                if (start > end) {
                    start = 0;
                }
                int len = (int) (end - start + 1);
                headers.put("Accept-Ranges", "bytes");
                headers.put("Content-Range", "bytes " + start + "-" + end + "/" + size);
                headers.put("Content-Length", String.valueOf(len));
                return new WebResourceResponse(type, null, 206, "Partial Content", headers,
                    new ByteArrayInputStream(all, (int) start, len));
            }
            InputStream in = assets.open(rel);
            headers.put("Accept-Ranges", "bytes");
            return new WebResourceResponse(type, null, 200, "OK", headers, in);
        } catch (IOException | NumberFormatException e) {
            return error(404, "Not Found");
        }
    }

    private static WebResourceResponse error(int status, String reason) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        return new WebResourceResponse("text/plain", "utf-8", status, reason, headers,
            new ByteArrayInputStream(reason.getBytes(StandardCharsets.UTF_8)));
    }

    static String mime(String name) {
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        switch (ext) {
            case "html": return "text/html";
            case "js": return "text/javascript";
            case "css": return "text/css";
            case "json": return "application/json";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "gif": return "image/gif";
            case "webp": return "image/webp";
            case "svg": return "image/svg+xml";
            case "ogg": return "audio/ogg";
            case "m4a": return "audio/mp4";
            case "wav": return "audio/wav";
            case "mp3": return "audio/mpeg";
            case "webm": return "video/webm";
            case "mp4": return "video/mp4";
            case "wasm": return "application/wasm";
            case "ttf": return "font/ttf";
            case "otf": return "font/otf";
            case "woff": return "font/woff";
            case "woff2": return "font/woff2";
            case "txt": return "text/plain";
            default: return "application/octet-stream";
        }
    }

    static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] b = new byte[64 * 1024];
        int n;
        while ((n = in.read(b)) >= 0) {
            buf.write(b, 0, n);
        }
        return buf.toByteArray();
    }

    private void applyImmersive() {
        android.view.Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            WindowInsetsController c = w.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            w.getDecorView().setSystemUiVisibility(0x00001000 | 0x00000004 | 0x00000002 | 0x00000200 | 0x00000400 | 0x00000100);
        }
        if (android.os.Build.VERSION.SDK_INT >= 28) {
            w.getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersive();
        }
    }

    /** Voltar = tecla Esc do jogo (menu/cancelar); na tela de título, sai do jogo. */
    @Override
    public void onBackPressed() {
        String js = "(function(){try{"
            + "if(window.SceneManager&&SceneManager._scene&&window.Scene_Title&&SceneManager._scene instanceof Scene_Title){return 'exit';}"
            + "if(window.Input){Input._currentState.escape=true;setTimeout(function(){Input._currentState.escape=false;},120);}"
            + "return 'esc';}catch(e){return 'exit';}})()";
        web.evaluateJavascript(js, r -> {
            if (r != null && r.contains("exit")) {
                finish();
            }
        });
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) {
            web.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
        }
        super.onDestroy();
    }
}
