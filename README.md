# 白板视频工作室 | Whiteboard Video Studio

<p align="center">
  <img height="20" alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" />
  <img height="20" alt="Electron 35" src="https://img.shields.io/badge/Electron-35-47848F?logo=electron&logoColor=white" />
  <img height="20" alt="Vite 7" src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white" />
  <img height="20" alt="Node.js runtime" src="https://img.shields.io/badge/Node.js-runtime-339933?logo=nodedotjs&logoColor=white" />
</p>

一款用于制作白底黑字知识短视频的桌面工作室。编辑逐段题词、配置中心图片和顶部文案、生成语音，并导出带同步字幕的 MP4。

A desktop studio for creating knowledge videos with black text on a white background. Edit captions, choose a center image, configure headers, generate narration, and export MP4 videos with synchronized captions.

## 成品预览 | Preview

<p align="center">
  <img src="docs/screenshots/psychology-video.png" alt="心理学知识短视频成品画面 / Finished psychology knowledge video frame" width="800" />
</p>

## 功能 | Features

- 白底黑字固定模板，支持自定义左右顶部文案、作者署名和中心图片。
- 内置 5 张黑白知识主题图片，也支持选择本地图片。
- 按标点拆分文稿，优先保持句子完整；题词最多显示两行，自动换行不会把标点放在行首。
- 使用兼容 OpenAI 格式的服务进行 AI 拆分，可保存多组本地 API 配置。
- 使用微软 Edge 在线中文语音，提供多种音色、语速设置和试听；生成语音保存在本地。
- 导出前可选择是否包含语音和视频分辨率；导出时持续保持字幕画面与语音同步。
- 新建项目时保存当前文稿、模板、分段及已生成音频。项目文件夹按日期时间和文稿首句命名。
- 管理台浏览项目、JSON 描述、模板与导出视频。

- Fixed black-on-white video template with configurable headers, author credit, and center image.
- Five built-in monochrome knowledge-themed images, with support for local image selection.
- Punctuation-aware script splitting that favors complete sentences. Captions use at most two lines, and automatic line wrapping keeps punctuation off the start of a line.
- AI-assisted splitting through OpenAI-compatible services, with multiple local API profiles.
- Microsoft Edge Chinese text-to-speech with selectable voices, speed control, and previews. Generated audio stays on the local machine.
- Choose whether to include audio and select the video resolution before export. Captions remain synchronized with narration during export.
- Save the current script, template, segments, and generated audio when starting a new project. Project folders use the date, time, and first sentence as their name.
- Browse projects, JSON descriptions, templates, and exported videos in the management view.

## 启动 | Getting Started

需要已安装 Node.js、npm，以及用于 MP4 转码的 FFmpeg。

Requires Node.js, npm, and FFmpeg for MP4 transcoding.

```powershell
npm install
npm start
```

浏览器预览地址：`http://127.0.0.1:5173/`。AI、语音、图片选择和视频导出等完整功能需要 Electron 桌面端。

Browser preview: `http://127.0.0.1:5173/`. Full AI, speech, image selection, and video export features require the Electron desktop app.

## 使用 | Usage

1. 设置顶部文案、作者署名与中心图片。
2. 粘贴文稿，按标点拆分或使用 AI 辅助拆分，然后检查段落。
3. 生成语音；应用会先列出已有和缺失语音，可选择补齐缺失段或全部重新生成。
4. 选择是否包含声音和导出分辨率，然后导出 MP4。
5. 在管理台查看项目及其本地素材。

1. Configure the headers, author credit, and center image.
2. Paste a script, split it by punctuation or use AI assistance, then review the segments.
3. Generate narration. The app lists existing and missing clips so you can fill gaps or regenerate all clips.
4. Choose whether to include audio and select an export resolution, then export the MP4.
5. Browse projects and their local assets in the management view.

## 服务配置 | Service Configuration

在应用的“AI / 语音设置”中配置拆分服务地址、模型和 API 密钥。AI 拆分使用兼容 OpenAI 格式的 `chat/completions` 接口。微软 Edge 在线语音需要联网，不需要 API 密钥。API 密钥由 Electron `safeStorage` 加密保存在本机。

Configure the AI service URL, model, and API key under **AI / 语音设置**. AI splitting uses an OpenAI-compatible `chat/completions` endpoint. Microsoft Edge online speech requires an internet connection but no API key. Electron `safeStorage` encrypts API keys on the local machine.

MP4 export requires `ffmpeg` on `PATH`. Set `FFMPEG_PATH` to use a specific FFmpeg executable.

## 测试 | Testing

```powershell
npm run build
npm run smoke
npm run smoke:ffmpeg
```

Electron 冒烟测试会操作桌面工作流、生成语音、导出视频并核对音视频时长。纯 FFmpeg 测试用于验证备用渲染流程。

The Electron smoke test exercises the desktop workflow, generates speech, exports a video, and checks audio/video duration alignment. The FFmpeg smoke test verifies the fallback rendering path.

## 技术栈 | Tech Stack

React 19 · Electron 35 · Vite 7 · Node.js · Microsoft Edge TTS
