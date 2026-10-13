$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ffmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
$ffprobeCommand = Get-Command ffprobe -ErrorAction SilentlyContinue
if (-not $ffmpegCommand -or -not $ffprobeCommand) {
  throw 'ffmpeg and ffprobe must be available on PATH.'
}

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$voice = $synth.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -eq 'zh-CN' } | Select-Object -First 1
if (-not $voice) { throw 'No installed Chinese Windows speech voice was found.' }
$synth.SelectVoice($voice.VoiceInfo.Name)
$synth.Rate = 0
$synth.Volume = 100

$root = Split-Path -Parent $PSScriptRoot
$samplePath = Join-Path $root 'samples\psychology-smoke-script.txt'
$lines = [System.IO.File]::ReadAllLines($samplePath, [System.Text.Encoding]::UTF8) | Where-Object { $_.Trim() }
$outputDirectory = Join-Path $root 'output'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputPath = Join-Path $outputDirectory "psychology-smoke-$timestamp.mp4"
$tempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "whiteboard-smoke-$timestamp"
New-Item -ItemType Directory -Force -Path $tempDirectory | Out-Null
$fontPath = 'C\:/Windows/Fonts/msyhbd.ttc'
$concatPath = Join-Path $tempDirectory 'audio-list.txt'
$audioList = [System.Collections.Generic.List[string]]::new()
$durations = [System.Collections.Generic.List[double]]::new()
$textPaths = [System.Collections.Generic.List[string]]::new()

function Convert-FilterPath([string] $value) {
  return $value.Replace('\', '/').Replace(':', '\:')
}

function Wrap-ChineseText([string] $value, [int] $limit = 16) {
  $chars = $value.ToCharArray()
  $lines = [System.Collections.Generic.List[string]]::new()
  for ($index = 0; $index -lt $chars.Length; $index += $limit) {
    $count = [Math]::Min($limit, $chars.Length - $index)
    $lines.Add((-join $chars[$index..($index + $count - 1)]))
  }
  return ($lines -join "`n")
}

try {
  for ($index = 0; $index -lt $lines.Count; $index++) {
    $sequence = $index + 1
    $audioPath = Join-Path $tempDirectory ("speech-{0:D2}.wav" -f $sequence)
    $textPath = Join-Path $tempDirectory ("title-{0:D2}.txt" -f $sequence)
    $synth.SetOutputToWaveFile($audioPath)
    $synth.Speak($lines[$index])
    $synth.SetOutputToNull()
    [System.IO.File]::WriteAllText($textPath, (Wrap-ChineseText $lines[$index]), [System.Text.UTF8Encoding]::new($false))
    $audioList.Add("file '$($audioPath.Replace('\', '/'))'")
    $textPaths.Add((Convert-FilterPath $textPath))

    $probe = & $ffprobeCommand.Source -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $audioPath
    if ($LASTEXITCODE -ne 0) { throw "Could not inspect generated speech clip $sequence." }
    $durations.Add([double]::Parse(($probe | Select-Object -First 1), [Globalization.CultureInfo]::InvariantCulture))
  }

  [System.IO.File]::WriteAllLines($concatPath, $audioList, [System.Text.UTF8Encoding]::new($false))
  $fullAudio = Join-Path $tempDirectory 'narration.wav'
  & $ffmpegCommand.Source -hide_banner -loglevel error -y -f concat -safe 0 -i $concatPath -c:a pcm_s16le $fullAudio
  if ($LASTEXITCODE -ne 0) { throw 'Could not concatenate speech clips.' }

  $totalDuration = ($durations | Measure-Object -Sum).Sum
  $filters = [System.Collections.Generic.List[string]]::new()
  $filters.Add("drawtext=fontfile='$fontPath':text='Psychology Notes':x=62:y=42:fontsize=26:fontcolor=black:expansion=none")
  $filters.Add("drawtext=fontfile='$fontPath':text='Mind & Behavior':x=w-text_w-62:y=42:fontsize=26:fontcolor=black:expansion=none")
  $filters.Add("drawtext=fontfile='$fontPath':text='@Whiteboard Studio':x=(w-text_w)/2:y=632:fontsize=34:fontcolor=black:expansion=none")
  $start = 0.0
  for ($index = 0; $index -lt $durations.Count; $index++) {
    $end = $start + $durations[$index]
    $textPath = $textPaths[$index]
    $startValue = [Math]::Max(0, $start - 0.01).ToString('0.000', [Globalization.CultureInfo]::InvariantCulture)
    $endValue = $end.ToString('0.000', [Globalization.CultureInfo]::InvariantCulture)
    $filters.Add("drawtext=fontfile='$fontPath':textfile='$textPath':x=(w-text_w)/2:y=(h-text_h)/2+135:fontsize=62:fontcolor=black:line_spacing=12:expansion=none:enable=between(t\,$startValue\,$endValue)")
    $start = $end
  }
  $filterGraph = $filters -join ','
  & $ffmpegCommand.Source -hide_banner -loglevel error -y -f lavfi -i "color=c=white:s=1280x720:r=30:d=$($totalDuration.ToString('0.000',[Globalization.CultureInfo]::InvariantCulture))" -i $fullAudio -vf $filterGraph -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest $outputPath
  if ($LASTEXITCODE -ne 0) { throw 'FFmpeg could not render the smoke-test video.' }

  $report = & $ffprobeCommand.Source -v error -show_entries format=duration:stream=codec_type,codec_name,width,height -of json $outputPath | ConvertFrom-Json
  if ($LASTEXITCODE -ne 0) { throw 'Could not verify the rendered video.' }
  if ($report.streams.Count -lt 2) { throw 'The output does not contain both video and audio streams.' }
  if ($report.streams | Where-Object { $_.codec_type -eq 'video' -and ($_.width -ne 1280 -or $_.height -ne 720) }) { throw 'Unexpected video dimensions.' }

  [pscustomobject]@{
    Output = $outputPath
    Voice = $voice.VoiceInfo.Name
    DurationSeconds = [Math]::Round([double]$report.format.duration, 2)
    Video = ($report.streams | Where-Object codec_type -eq 'video' | Select-Object -First 1)
    Audio = ($report.streams | Where-Object codec_type -eq 'audio' | Select-Object -First 1)
  } | Format-List
} finally {
  $synth.Dispose()
  Remove-Item -LiteralPath $tempDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
