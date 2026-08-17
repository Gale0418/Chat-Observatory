param(
    [string]$ChromePath
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourcePath = Join-Path (Join-Path $projectRoot 'icons') 'source.svg'
$iconDirectory = Join-Path $projectRoot 'icons'

function Resolve-ChromeExecutable {
    param([string]$RequestedPath)

    $candidates = [System.Collections.Generic.List[string]]::new()
    if ($RequestedPath) {
        $candidates.Add($RequestedPath)
    }
    else {
        $runningOnWindows = $env:OS -eq 'Windows_NT'
        if ($runningOnWindows) {
            if ($env:ProgramFiles) {
                $chromeRoot = Join-Path (Join-Path (Join-Path $env:ProgramFiles 'Google') 'Chrome') 'Application'
                $candidates.Add((Join-Path $chromeRoot 'chrome.exe'))
            }
            if ($env:LOCALAPPDATA) {
                $chromeRoot = Join-Path (Join-Path (Join-Path $env:LOCALAPPDATA 'Google') 'Chrome') 'Application'
                $candidates.Add((Join-Path $chromeRoot 'chrome.exe'))
            }
        }
        elseif ($IsMacOS) {
            $candidates.Add((Join-Path (Join-Path (Join-Path '/Applications' 'Google Chrome.app') 'Contents') (Join-Path 'MacOS' 'Google Chrome')))
            $candidates.Add((Join-Path (Join-Path (Join-Path '/Applications' 'Chromium.app') 'Contents') (Join-Path 'MacOS' 'Chromium')))
        }
        elseif ($IsLinux) {
            $candidates.Add((Join-Path '/usr' (Join-Path 'bin' 'google-chrome')))
            $candidates.Add((Join-Path '/usr' (Join-Path 'bin' 'chromium')))
            $candidates.Add((Join-Path '/usr' (Join-Path 'bin' 'chromium-browser')))
            $candidates.Add((Join-Path '/snap' (Join-Path 'bin' 'chromium')))
        }
    }

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return [IO.Path]::GetFullPath($candidate)
        }
    }

    if (-not $RequestedPath) {
        foreach ($commandName in @('chrome', 'google-chrome', 'chromium', 'chromium-browser')) {
            $command = Get-Command $commandName -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($command) {
                return $command.Source
            }
        }
    }

    throw "找不到 Chrome。請使用 -ChromePath <可執行檔路徑>，或將 chrome/google-chrome/chromium 加入 PATH。"
}

# System.Drawing 的圖示縮放在非 Windows 不受支援；避免產生不可靠的圖示檔。
$isWindowsPlatform = $env:OS -eq 'Windows_NT'
if (-not $isWindowsPlatform) {
    throw "非 Windows 平台已阻擋圖示縮放：本腳本使用 System.Drawing，請改在 Windows 執行；商店截圖腳本不受此限制。"
}

$ChromePath = Resolve-ChromeExecutable $ChromePath

if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "找不到圖示來源：$sourcePath"
}

$sourceUri = [Uri]::new($sourcePath).AbsoluteUri
$masterPath = Join-Path $iconDirectory 'master-512.png'
$profilePath = Join-Path ([IO.Path]::GetTempPath()) "chatobs-icon-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $profilePath | Out-Null

try {
    & $ChromePath `
        '--headless=new' `
        '--disable-gpu' `
        '--hide-scrollbars' `
        '--no-first-run' `
        '--run-all-compositor-stages-before-draw' `
        '--virtual-time-budget=1000' `
        '--force-device-scale-factor=1' `
        "--user-data-dir=$profilePath" `
        '--window-size=512,512' `
        "--screenshot=$masterPath" `
        $sourceUri | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Chrome 產生圖示主圖失敗（退出碼：$LASTEXITCODE）：$ChromePath"
    }
}
finally {
    $resolvedProfile = [IO.Path]::GetFullPath($profilePath)
    $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $relativeProfile = [IO.Path]::GetRelativePath($resolvedTemp, $resolvedProfile).Replace('\', '/')
    $relativeProfileParts = $relativeProfile -split '/'
    if ($relativeProfileParts.Count -gt 0 -and $relativeProfileParts[0] -ne '..') {
        Remove-Item -LiteralPath $resolvedProfile -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path -LiteralPath $masterPath)) {
    throw "圖示主圖產生失敗：$masterPath"
}

Add-Type -AssemblyName System.Drawing
$master = [Drawing.Image]::FromFile($masterPath)

try {
    foreach ($size in @(16, 32, 48, 128)) {
        $outputPath = Join-Path $iconDirectory "icon-$size.png"
        $bitmap = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)

        try {
            $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($master, 0, 0, $size, $size)
            $bitmap.Save($outputPath, [Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
}
finally {
    $master.Dispose()
    Remove-Item -LiteralPath $masterPath -Force
}

Get-ChildItem -LiteralPath $iconDirectory -Filter 'icon-*.png' |
    Sort-Object Name |
    Select-Object Name, Length
