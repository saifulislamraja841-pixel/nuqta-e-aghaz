package org.nuqtaeaghaz.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
    private static final String HOME = "https://www.nuqtaeaghaz.org/app.html";
    private static final int FILE_REQ = 1, MIC_REQ = 2;
    private ValueCallback<Uri[]> fileCb;          // photo / file picker for the chat
    private PermissionRequest pendingMic;         // voice notes
    private WebView web;
    private ProgressBar progress;
    private String lastUrl = HOME;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        setContentView(R.layout.activity_main);
        web = findViewById(R.id.web);
        progress = findViewById(R.id.progress);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // portal sign-in is kept in localStorage
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setUserAgentString(s.getUserAgentString() + " NuqtaApp/1.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);   // Google Forms in pop-ups
        web.addJavascriptInterface(new Bridge(), "NuqtaApp");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                return handle(req.getUrl());
            }
            @Override
            public void onPageStarted(WebView v, String url, Bitmap icon) {
                if (url != null && url.startsWith("http")) lastUrl = url;
            }
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) v.loadUrl("file:///android_asset/offline.html");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView v, int p) {
                progress.setProgress(p);
                progress.setVisibility(p >= 100 ? View.GONE : View.VISIBLE);
            }
            // "Photo" and "File" buttons in the chat
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                boolean imagesOnly = false;
                for (String t : params.getAcceptTypes()) if (t != null && t.startsWith("image/")) imagesOnly = true;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(imagesOnly ? "image/*" : "*/*");
                try { startActivityForResult(Intent.createChooser(i, imagesOnly ? "Choose a photo" : "Choose a file"), FILE_REQ); }
                catch (ActivityNotFoundException e) { fileCb = null; return false; }
                return true;
            }
            // "Voice note" button: microphone, only for our own pages
            @Override
            public void onPermissionRequest(PermissionRequest req) {
                runOnUiThread(() -> {
                    boolean mic = false;
                    for (String r : req.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) mic = true;
                    if (!mic || !isOurs(req.getOrigin())) { req.deny(); return; }
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        req.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    } else {
                        pendingMic = req;
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MIC_REQ);
                    }
                });
            }
        });
        web.setDownloadListener((url, ua, cd, mime, len) -> openExternal(Uri.parse(url)));

        if (state != null) web.restoreState(state);
        else web.loadUrl(startUrl(getIntent()));
    }

    private String startUrl(Intent i) {
        Uri d = i == null ? null : i.getData();
        return d != null && isOurs(d) ? d.toString() : HOME;
    }

    private boolean isOurs(Uri u) {
        String h = u.getHost();
        return h != null && (h.equals("nuqtaeaghaz.org") || h.endsWith(".nuqtaeaghaz.org"));
    }

    /** true = handled outside the WebView */
    private boolean handle(Uri u) {
        String scheme = u.getScheme() == null ? "" : u.getScheme();
        String host = u.getHost() == null ? "" : u.getHost();
        if (scheme.equals("http") || scheme.equals("https")) {
            if (isOurs(u) || host.endsWith("google.com") || host.endsWith("googleusercontent.com")
                    || host.endsWith("gstatic.com") || host.equals("forms.gle")) {
                // site pages and Google Forms stay in the app; WhatsApp/maps/social go to their apps
                if (!host.equals("maps.google.com") && !u.getPath().startsWith("/maps")) return false;
            }
        }
        openExternal(u);
        return true;
    }

    private void openExternal(Uri u) {
        try {
            Intent i = "intent".equals(u.getScheme())
                    ? Intent.parseUri(u.toString(), Intent.URI_INTENT_SCHEME)
                    : new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException | java.net.URISyntaxException e) {
            // nothing can open it; ignore
        }
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == FILE_REQ && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            fileCb = null;
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code == MIC_REQ && pendingMic != null) {
            if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) pendingMic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
            else { pendingMic.deny(); Toast.makeText(this, "Allow the microphone in Settings to send voice notes.", Toast.LENGTH_LONG).show(); }
            pendingMic = null;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent.getData() != null) web.loadUrl(startUrl(intent));
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    private class Bridge {
        @JavascriptInterface
        public void retry() {
            runOnUiThread(() -> web.loadUrl(lastUrl));
        }

        /** Saves a file from the chat (sent as base64) to Downloads/Nuqta and opens it. */
        @JavascriptInterface
        public boolean saveFile(String b64, String name, String mime) {
            try {
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                String safe = (name == null || name.isEmpty() ? "file" : name).replaceAll("[\\\\/:*?\"<>|]", "_");
                Uri uri = null;
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues cv = new ContentValues();
                    cv.put(MediaStore.MediaColumns.DISPLAY_NAME, safe);
                    cv.put(MediaStore.MediaColumns.MIME_TYPE, mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                    cv.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Nuqta");
                    uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) return false;
                    try (OutputStream out = getContentResolver().openOutputStream(uri)) { out.write(bytes); }
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) return false;
                    try (FileOutputStream out = new FileOutputStream(new File(dir, safe))) { out.write(bytes); }
                }
                final Uri open = uri;
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Saved to Downloads: " + safe, Toast.LENGTH_SHORT).show();
                    if (open != null) {
                        try {
                            Intent v = new Intent(Intent.ACTION_VIEW);
                            v.setDataAndType(open, mime);
                            v.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(v);
                        } catch (ActivityNotFoundException e) { /* no app can open it; it's still in Downloads */ }
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }
}
