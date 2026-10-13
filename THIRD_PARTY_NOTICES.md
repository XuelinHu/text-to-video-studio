# Third-Party Notices

## FFmpeg

Desktop installers bundle an FFmpeg binary supplied by `ffmpeg-static` 5.3.0. The npm package is licensed under GPL-3.0-or-later. The binary is downloaded from the `ffmpeg-static` b6.1.1 release; consult that release for the binary build details and applicable license materials:

- Package source and license: https://github.com/eugeneware/ffmpeg-static
- Binary release: https://github.com/eugeneware/ffmpeg-static/releases/tag/b6.1.1
- FFmpeg legal information: https://www.ffmpeg.org/legal.html
- FFmpeg 6.1.1 source: https://ffmpeg.org/releases/ffmpeg-6.1.1.tar.xz

Review the exact binary build configuration and license materials before redistributing installers. FFmpeg's licensing depends on the features enabled in each binary build.

The Android app uses `dev.ffmpegkit-maintained:ffmpeg-kit-full:8.1.7`, an LGPL-3.0 Android FFmpeg distribution. The Android build uses the non-GPL `mpeg4` video encoder. The package includes its third-party notices in the APK.

## Android Runtime

- Capacitor Android is distributed under the MIT license: https://github.com/ionic-team/capacitor
- OkHttp is distributed under the Apache License 2.0: https://github.com/square/okhttp
- SmartException Java is distributed under the BSD 3-Clause license: https://github.com/tanersener/smart-exception
