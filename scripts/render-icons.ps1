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

function Test-ReparsePoint {
    param([string]$Path)
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) {
        return $false
    }
    return ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
}

function Assert-NotReparsePoint {
    param([string]$Path)
    if (Test-ReparsePoint $Path) {
        throw "輸出路徑不可是符號連結或其他重解析點：$Path"
    }
}

function Assert-NoReparsePointsInPath {
    param(
        [string]$Path,
        [string]$Boundary
    )

    $current = [IO.Path]::GetFullPath($Path)
    $resolvedBoundary = [IO.Path]::GetFullPath($Boundary)

    while ($true) {
        if (Test-ReparsePoint $current) {
            throw "路徑及其父層不可含符號連結或其他重解析點：$current"
        }
        if ($current -ieq $resolvedBoundary) {
            break
        }

        $parent = Split-Path -Path $current -Parent
        if ([string]::IsNullOrEmpty($parent) -or $parent -ieq $current) {
            throw "無法驗證路徑的父層：$Path"
        }
        $current = $parent
    }
}

function Assert-RegularFileWithinProject {
    param(
        [string]$Path,
        [string]$Description
    )

    Assert-NoReparsePointsInPath -Path $Path -Boundary $projectRoot
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) {
        throw "找不到$Description：$Path"
    }
    if ($item.PSIsContainer -or $item -isnot [IO.FileInfo]) {
        throw "$Description 必須是一般檔案：$Path"
    }
}

function Remove-OwnedTemporaryDirectory {
    param([string]$Path)

    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) {
        return
    }
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "拒絕刪除符號連結或其他重解析點：$Path"
    }
    Remove-Item -LiteralPath $Path -Recurse -Force
}

# System.Drawing 的圖示縮放在非 Windows 不受支援；避免產生不可靠的圖示檔。
$isWindowsPlatform = $env:OS -eq 'Windows_NT'
if (-not $isWindowsPlatform) {
    throw "非 Windows 平台已阻擋圖示縮放：本腳本使用 System.Drawing，請改在 Windows 執行；商店截圖腳本不受此限制。"
}

$ChromePath = Resolve-ChromeExecutable $ChromePath

Assert-RegularFileWithinProject -Path $sourcePath -Description '圖示來源'
if (-not (Test-Path -LiteralPath $iconDirectory -PathType Container)) {
    throw "圖示輸出路徑不是資料夾：$iconDirectory"
}
Assert-NoReparsePointsInPath -Path $iconDirectory -Boundary $projectRoot
Assert-NotReparsePoint $iconDirectory

$sourceUri = [Uri]::new($sourcePath).AbsoluteUri
$masterPath = Join-Path $iconDirectory 'master-512.png'
$outputPaths = @(16, 32, 48, 128) | ForEach-Object { Join-Path $iconDirectory "icon-$_.png" }
foreach ($outputPath in $outputPaths) {
    Assert-NotReparsePoint $outputPath
}
Assert-NotReparsePoint $masterPath
if (Test-Path -LiteralPath $masterPath) {
    Remove-Item -LiteralPath $masterPath -Force
}

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
        Remove-OwnedTemporaryDirectory $resolvedProfile
    }
}

if (-not (Test-Path -LiteralPath $masterPath)) {
    throw "圖示主圖產生失敗：$masterPath"
}
Assert-NotReparsePoint $masterPath

Add-Type -AssemblyName System.Drawing
$master = [Drawing.Image]::FromFile($masterPath)

try {
    foreach ($size in @(16, 32, 48, 128)) {
        $outputPath = Join-Path $iconDirectory "icon-$size.png"
        Assert-NotReparsePoint $outputPath
        $bitmap = [Drawing.Bitmap]::new($size, $size, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = $null

        try {
            $graphics = [Drawing.Graphics]::FromImage($bitmap)
            $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($master, 0, 0, $size, $size)
            $bitmap.Save($outputPath, [Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            if ($null -ne $graphics) {
                $graphics.Dispose()
            }
            if ($null -ne $bitmap) {
                $bitmap.Dispose()
            }
        }
    }
}
finally {
    $master.Dispose()
    if (Test-ReparsePoint $masterPath) {
        throw "拒絕刪除符號連結或其他重解析點：$masterPath"
    }
    Remove-Item -LiteralPath $masterPath -Force -ErrorAction SilentlyContinue
}

Get-ChildItem -LiteralPath $iconDirectory -Filter 'icon-*.png' |
    Sort-Object Name |
    Select-Object Name, Length
