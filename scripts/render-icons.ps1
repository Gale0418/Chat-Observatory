param(
    [string]$ChromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourcePath = Join-Path $projectRoot 'icons\source.svg'
$iconDirectory = Join-Path $projectRoot 'icons'

if (-not (Test-Path -LiteralPath $ChromePath)) {
    throw "找不到 Chrome：$ChromePath"
}

if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "找不到圖示來源：$sourcePath"
}

$sourceUri = [Uri]::new($sourcePath).AbsoluteUri
$masterPath = Join-Path $iconDirectory 'master-512.png'
$profilePath = Join-Path $env:TEMP "ytce-icon-$([guid]::NewGuid().ToString('N'))"
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
}
finally {
    $resolvedProfile = [IO.Path]::GetFullPath($profilePath)
    $resolvedTemp = [IO.Path]::GetFullPath($env:TEMP)
    if ($resolvedProfile.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
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
