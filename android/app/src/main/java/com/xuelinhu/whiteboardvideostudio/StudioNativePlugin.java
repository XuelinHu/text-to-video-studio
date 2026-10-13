package com.xuelinhu.whiteboardvideostudio;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.ReturnCode;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

@CapacitorPlugin(name = "StudioNative")
public class StudioNativePlugin extends Plugin {
    private static final String CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private static final String EDGE_VERSION = "143.0.3650.75";
    private final OkHttpClient webSocketClient = new OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build();

    @PluginMethod
    public void generateSpeech(PluginCall call) {
        String text = call.getString("text", "");
        String voice = call.getString("voice", "zh-CN-XiaoxiaoNeural");
        int rate = call.getInt("rate", 10);
        if (text.trim().isEmpty()) {
            call.reject("语音文本不能为空。");
            return;
        }

        HttpUrl url = new HttpUrl.Builder()
            .scheme("https")
            .host("api.msedgeservices.com")
            .addPathSegments("tts/cognitiveservices/websocket/v1")
            .addQueryParameter("Ocp-Apim-Subscription-Key", CLIENT_TOKEN)
            .addQueryParameter("Sec-MS-GEC", secMsGec())
            .addQueryParameter("Sec-MS-GEC-Version", "1-" + EDGE_VERSION)
            .build();
        Request request = new Request.Builder()
            .url(url)
            .header("Origin", "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold")
            .header("User-Agent", "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36 Edg/143.0.0.0")
            .header("Cache-Control", "no-cache")
            .build();
        call.setKeepAlive(true);
        ByteArrayOutputStream audio = new ByteArrayOutputStream();
        boolean[] completed = { false };
        WebSocket[] socket = { null };
        Runnable timeout = () -> {
            if (completed[0]) return;
            completed[0] = true;
            if (socket[0] != null) socket[0].cancel();
            call.reject("微软在线语音连接超时，请检查网络后重试。");
        };
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(timeout, 45000);

        socket[0] = webSocketClient.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                String config = "Content-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"
                    + "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"},\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}";
                webSocket.send(config);
                String ssml = "X-RequestId:" + UUID.randomUUID().toString().replace("-", "")
                    + "\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n"
                    + "<speak version=\"1.0\" xmlns=\"http://www.w3.org/2001/10/synthesis\" xmlns:mstts=\"https://www.w3.org/2001/mstts\" xml:lang=\""
                    + escapeXml(voice.substring(0, Math.min(5, voice.length()))) + "\"><voice name=\"" + escapeXml(voice)
                    + "\"><prosody rate=\"" + (rate >= 0 ? "+" : "") + rate + "%\">" + escapeXml(text)
                    + "</prosody></voice></speak>";
                webSocket.send(ssml);
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                byte[] packet = bytes.toByteArray();
                byte[] marker = "Path:audio\r\n".getBytes(StandardCharsets.UTF_8);
                int offset = indexOf(packet, marker);
                if (offset >= 0) audio.write(packet, offset + marker.length, packet.length - offset - marker.length);
            }

            @Override
            public void onMessage(WebSocket webSocket, String textMessage) {
                if (!textMessage.contains("Path:turn.end") || completed[0]) return;
                completed[0] = true;
                JSObject result = new JSObject();
                result.put("data", Base64.encodeToString(audio.toByteArray(), Base64.NO_WRAP));
                result.put("mimeType", "audio/mpeg");
                call.resolve(result);
                webSocket.close(1000, "complete");
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable error, Response response) {
                if (completed[0]) return;
                completed[0] = true;
                String detail = error.getMessage() == null ? "网络连接失败" : error.getMessage();
                call.reject("微软 Edge 在线语音生成失败：" + detail);
            }
        });
    }

    @PluginMethod
    public void exportVideo(PluginCall call) {
        String encoded = call.getString("webmBase64", "");
        String requestedName = safeName(call.getString("fileName", "知识短视频"));
        String resolution = call.getString("resolution", "1280x720");
        boolean includeAudio = call.getBoolean("includeAudio", true);
        long duration = Math.max(1, Math.round(call.getDouble("duration", 60.0) * 1000));
        int[] size = outputSize(resolution);
        if (encoded.isEmpty()) {
            call.reject("录制数据为空，无法导出视频。");
            return;
        }

        File input = new File(getContext().getCacheDir(), "studio-" + UUID.randomUUID() + ".webm");
        File output = new File(getContext().getCacheDir(), requestedName + "-" + UUID.randomUUID() + ".mp4");
        try (FileOutputStream stream = new FileOutputStream(input)) {
            stream.write(Base64.decode(encoded, Base64.DEFAULT));
        } catch (Exception error) {
            call.reject("无法读取录制视频：" + error.getMessage());
            return;
        }

        StringBuilder command = new StringBuilder()
            .append("-y -i ").append(quote(input.getAbsolutePath()))
            .append(" -vf scale=").append(size[0]).append(':').append(size[1]).append(":flags=lanczos")
            .append(" -c:v mpeg4 -q:v 3 -pix_fmt yuv420p");
        if (includeAudio) command.append(" -c:a aac -b:a 128k");
        else command.append(" -an");
        command.append(" -movflags +faststart ").append(quote(output.getAbsolutePath()));

        call.setKeepAlive(true);
        FFmpegKit.executeAsync(command.toString(), session -> {
            input.delete();
            if (!ReturnCode.isSuccess(session.getReturnCode()) || !output.isFile() || output.length() == 0) {
                String failStack = session.getFailStackTrace();
                call.reject("MP4 转换失败：" + (failStack == null ? "设备编码器无法处理此视频" : failStack));
                output.delete();
                return;
            }
            try {
                call.resolve(publishVideo(output, requestedName));
            } catch (Exception error) {
                call.reject("MP4 已生成，但保存到媒体库失败：" + error.getMessage());
            } finally {
                output.delete();
            }
        }, log -> { }, statistics -> {
            double elapsed = statistics.getTime();
            double percent = Math.min(99, Math.max(0, (elapsed / (double) duration) * 94 + 5));
            JSObject progress = new JSObject();
            progress.put("percent", percent);
            notifyListeners("exportProgress", progress);
        });
    }

    @PluginMethod
    public void openVideo(PluginCall call) {
        String value = call.getString("uri", "");
        if (value.isEmpty()) {
            call.reject("视频路径不存在。");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(Uri.parse(value), "video/mp4");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(intent, "打开视频"));
            call.resolve();
        } catch (Exception error) {
            call.reject("没有可用的视频播放器：" + error.getMessage());
        }
    }

    private JSObject publishVideo(File source, String fileName) throws Exception {
        JSObject result = new JSObject();
        String displayName = fileName + "-" + System.currentTimeMillis() + ".mp4";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, displayName);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "video/mp4");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/白板视频工作室");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri uri = getContext().getContentResolver().insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("系统没有返回媒体库文件位置");
            try (OutputStream destination = getContext().getContentResolver().openOutputStream(uri);
                 FileInputStream input = new FileInputStream(source)) {
                if (destination == null) throw new IllegalStateException("无法写入媒体库文件");
                copy(input, destination);
            }
            values.clear();
            values.put(MediaStore.MediaColumns.IS_PENDING, 0);
            getContext().getContentResolver().update(uri, values, null, null);
            result.put("uri", uri.toString());
            result.put("filePath", "Movies/白板视频工作室/" + displayName);
            return result;
        }

        File folder = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_MOVIES), "白板视频工作室");
        if (!folder.exists() && !folder.mkdirs()) throw new IllegalStateException("无法创建视频保存目录");
        File destination = new File(folder, displayName);
        try (FileInputStream input = new FileInputStream(source); FileOutputStream output = new FileOutputStream(destination)) {
            copy(input, output);
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", destination);
        result.put("uri", uri.toString());
        result.put("filePath", destination.getAbsolutePath());
        return result;
    }

    private static void copy(InputStream input, OutputStream output) throws Exception {
        byte[] buffer = new byte[65536];
        int count;
        while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count);
    }

    private static int[] outputSize(String value) {
        switch (value) {
            case "854x480": return new int[]{854, 480};
            case "1920x1080": return new int[]{1920, 1080};
            default: return new int[]{1280, 720};
        }
    }

    private static String safeName(String value) {
        String cleaned = value == null ? "知识短视频" : value.replaceAll("[<>:\"/\\\\|?*\\p{Cntrl}]", "").trim();
        if (cleaned.isEmpty()) cleaned = "知识短视频";
        return cleaned.length() > 72 ? cleaned.substring(0, 72) : cleaned;
    }

    private static String quote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String escapeXml(String value) {
        return value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&apos;");
    }

    private static String secMsGec() {
        try {
            long ticks = ((System.currentTimeMillis() / 1000L) + 11644473600L) * 10000000L;
            long rounded = ticks - ticks % 3000000000L;
            byte[] bytes = (rounded + CLIENT_TOKEN).getBytes(StandardCharsets.US_ASCII);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
            StringBuilder token = new StringBuilder();
            for (byte item : digest) token.append(String.format(Locale.US, "%02X", item));
            return token.toString();
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private static int indexOf(byte[] haystack, byte[] needle) {
        outer: for (int index = 0; index <= haystack.length - needle.length; index++) {
            for (int offset = 0; offset < needle.length; offset++) {
                if (haystack[index + offset] != needle[offset]) continue outer;
            }
            return index;
        }
        return -1;
    }
}
