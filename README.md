# Whiteboard Video Studio

<p align="center">
  <img height="20" alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" />
<img height="20" alt="Electron 35" src="https://img.shields.io/badge/Electron-35-47848F?logo=electron&logoColor=white" />
  <img height="20" alt="Capacitor 8" src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" />
  <img height="20" alt="Vite 7" src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" />
  <img height="20" alt="Node.js runtime" src="https://img.shields.io/badge/Node.js-runtime-339933?logo=nodedotjs&logoColor=white" />
</p>

A desktop studio for creating knowledge videos with black text on a white background. Edit captions, choose a center image, configure headers, generate narration, and export MP4 videos with synchronized captions.

[Chinese documentation](README.zh-CN.md)

## Preview

<p align="center">
  <img src="docs/screenshots/psychology-video.png" alt="Finished psychology knowledge video frame" width="800" />
</p>

## Features

- Fixed black-on-white video template with configurable headers, author credit, and center image.
- Five built-in monochrome knowledge-themed images, with support for local image selection.
- Punctuation-aware script splitting that favors complete sentences. Captions use at most two lines, and automatic line wrapping keeps punctuation off the start of a line.
- AI-assisted splitting through OpenAI-compatible services, with multiple local API profiles.
- Microsoft Edge Chinese text-to-speech with selectable voices, speed control, and previews. Generated audio stays on the local machine.
- Choose whether to include audio and select the video resolution before export. Captions remain synchronized with narration during export.
- Save the current script, template, segments, and generated audio when starting a new project. Project folders use the date, time, and first sentence as their name.
- Browse projects, JSON descriptions, templates, and exported videos in the management view.
- Install the Android APK. Punctuation splitting and MP4 conversion work on-device; Microsoft Edge speech and AI splitting need network access.

## Getting Started

Requires Node.js and npm for desktop development. Android APK builds also require an Android SDK and JDK 21. Desktop MP4 transcoding uses FFmpeg.

```powershell
npm install
npm start
```

Browser preview: `http://127.0.0.1:5173/`. Full AI, speech, image selection, and video export features require the Electron desktop app.

## Desktop Installers

Create a version tag such as `v0.2.2` and push it to GitHub. The release workflow builds a Windows NSIS installer, Android APK, and macOS DMG/ZIP packages for Apple Silicon and Intel, then attaches them to a GitHub Release. The macOS package is unsigned until Apple Developer signing and notarization credentials are configured.

The packaged desktop app includes FFmpeg for MP4 export. The Microsoft Edge online voice service still requires an internet connection. FFmpeg is distributed under its own license; see [Third-Party Notices](THIRD_PARTY_NOTICES.md).

When installing an update, exit Whiteboard Video Studio first. If setup says it cannot close the app, cancel the prompt, close the app window, and end any remaining `Whiteboard Video Studio.exe` process in Task Manager before running setup again. Project files and settings are stored separately from the installation directory.

Use an installer from GitHub Releases so it includes the platform-specific FFmpeg binary required for MP4 export. A locally built installer without that binary will show an error instead of starting a broken export.

## Android APK

Build a directly installable, debug-signed APK on Windows with:

```powershell
npm run build:android
```

The APK is written to `release/Whiteboard-Video-Studio-Android.apk`. It uses the Android media library and saves MP4 files under `Movies/白板视频工作室`. The release workflow also attaches the APK to GitHub Releases. This debug-signed APK is suitable for sideloading; Google Play distribution requires a separately managed release signing key.

## Usage

1. Configure the headers, author credit, and center image.
2. Paste a script, split it by punctuation or use AI assistance, then review the segments.
3. Generate narration. The app lists existing and missing clips so you can fill gaps or regenerate all clips.
4. Choose whether to include audio and select an export resolution, then export the MP4.
5. Browse projects and their local assets in the management view.

## Service Configuration

Configure the AI service URL, model, and API key under **AI / Speech Settings**. AI splitting uses an OpenAI-compatible `chat/completions` endpoint. Microsoft Edge online speech requires an internet connection but no API key. Electron `safeStorage` encrypts API keys on the local machine.

MP4 export requires `ffmpeg` on `PATH`. Set `FFMPEG_PATH` to use a specific FFmpeg executable.

## Testing

```powershell
npm run build
npm run smoke
npm run smoke:ffmpeg
```

The Electron smoke test exercises the desktop workflow, generates speech, exports a video, and checks audio/video duration alignment. The FFmpeg smoke test verifies the fallback rendering path.

## Tech Stack

React 19 · Electron 35 · Capacitor 8 · Vite 7 · Node.js · Microsoft Edge TTS
