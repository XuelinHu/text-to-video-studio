# 白板视频工作室

[英文文档](README.md)

一款用于制作白底黑字知识短视频的桌面工作室。可以编辑逐段题词、配置中心图片和顶部文案、生成语音，并导出字幕与语音同步的 MP4。

## 成品预览

<p align="center">
  <img src="docs/screenshots/psychology-video.png" alt="心理学知识短视频成品画面" width="800" />
</p>

## 功能

- 白底黑字固定模板，支持自定义左右顶部文案、作者署名和中心图片。
- 内置 5 张黑白知识主题图片，也支持选择本地图片。
- 按标点拆分文稿并优先保持句子完整；题词最多显示两行，自动换行不会把标点放在行首。
- 通过兼容 OpenAI 格式的服务进行 AI 拆分，可保存多组本地 API 配置。
- 使用微软 Edge 在线中文语音，提供多种音色、语速设置和试听；生成语音保存在本地。
- 导出前可选择是否包含语音和视频分辨率；导出时持续保持字幕画面与语音同步。
- 新建项目时保存当前文稿、模板、分段及已生成音频。项目文件夹按日期时间和文稿首句命名。
- 在管理台浏览项目、JSON 描述、模板与导出视频。

## 启动

需要已安装 Node.js、npm，以及用于 MP4 转码的 FFmpeg。

```powershell
npm install
npm start
```

浏览器预览地址：`http://127.0.0.1:5173/`。AI、语音、图片选择和视频导出等完整功能需要 Electron 桌面端。

## 桌面安装包

创建并推送版本标签，例如 `v0.2.3`，GitHub Actions 会自动构建 Windows 安装程序、Android APK，以及适用于 Apple Silicon 和 Intel 的 macOS DMG/ZIP，并将它们附加到 GitHub Release。macOS 安装包暂未签名；配置 Apple Developer 证书和公证凭据后，才能提供已签名并公证的安装包。

桌面安装包内置 FFmpeg，可直接导出 MP4。微软 Edge 在线语音仍需要联网。FFmpeg 按其自身许可证分发，详见 [第三方组件说明](THIRD_PARTY_NOTICES.md)。

覆盖安装新版前，请先退出白板视频工作室。如果安装器提示无法关闭应用，请取消提示、关闭工作室窗口，并在任务管理器中结束残留的 `Whiteboard Video Studio.exe` 进程，再重新运行安装程序。项目文件和设置保存在安装目录之外，不会因覆盖安装而删除。

请使用 GitHub Releases 中的正式安装包，其中包含 MP4 导出需要的对应平台 FFmpeg。未携带 FFmpeg 的本地安装包会明确提示组件缺失，不会继续执行失败的导出。

## Android 版本

项目提供可直接侧载安装的 Android APK。标点拆分、编辑和 MP4 转换在设备本机运行；微软 Edge 在线语音和 AI 文稿拆分需要联网。MP4 默认保存到系统相册目录 `Movies/白板视频工作室`。

在 Windows 开发机上运行以下命令构建：

```powershell
npm run build:android
```

APK 输出到 `release/Whiteboard-Video-Studio-Android.apk`。该安装包使用 Android 调试签名，适合直接安装测试；发布到 Google Play 需要单独配置正式签名密钥。GitHub Release 工作流也会自动附上 APK。

## 使用流程

1. 设置顶部文案、作者署名与中心图片。
2. 粘贴文稿，按标点拆分或使用 AI 辅助拆分，然后检查段落。
3. 生成语音；应用会先列出已有和缺失语音，可选择补齐缺失段或全部重新生成。
4. 选择是否包含声音和导出分辨率，然后导出 MP4。
5. 在管理台查看项目及其本地素材。

## 服务配置

在应用的“AI / 语音设置”中配置拆分服务地址、模型和 API 密钥。AI 拆分使用兼容 OpenAI 格式的 `chat/completions` 接口。微软 Edge 在线语音需要联网，不需要 API 密钥。API 密钥由 Electron `safeStorage` 加密保存在本机。

MP4 导出需要系统能够运行 `ffmpeg`。如需指定 FFmpeg 程序路径，可以设置 `FFMPEG_PATH`。

## 测试

```powershell
npm run build
npm run smoke
npm run smoke:ffmpeg
```

Electron 冒烟测试会操作桌面工作流、生成语音、导出视频并核对音视频时长。FFmpeg 冒烟测试用于验证备用渲染流程。

## 技术栈

React 19 · Electron 35 · Vite 7 · Node.js · Microsoft Edge TTS
