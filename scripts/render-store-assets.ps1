param(
    [string]$ChromePath
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixturePath = Join-Path (Join-Path $projectRoot 'tests') 'visual-fixture.html'
$outputDirectory = Join-Path $projectRoot 'store-assets'

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

$ChromePath = Resolve-ChromeExecutable $ChromePath

Assert-RegularFileWithinProject -Path $fixturePath -Description '商店截圖版型'

$fixtureInputs = @(
    @('content.js'),
    @('content.css'),
    @('assets', 'themes', 'cosmic-spectrum-black.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-red.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-orange.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-yellow.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-green.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-blue.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-purple.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-gray.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-white.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-gold.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-silver.jpg'),
    @('assets', 'themes', 'cosmic-spectrum-rainbow.jpg')
)
foreach ($pathSegments in $fixtureInputs) {
    $inputPath = $projectRoot
    foreach ($segment in $pathSegments) {
        $inputPath = Join-Path $inputPath $segment
    }
    Assert-RegularFileWithinProject -Path $inputPath -Description "商店截圖依賴檔案（$($pathSegments -join '/')）"
}

if (Test-Path -LiteralPath $outputDirectory -PathType Leaf) {
    throw "商店素材輸出路徑必須是資料夾：$outputDirectory"
}
Assert-NoReparsePointsInPath -Path $outputDirectory -Boundary $projectRoot
Assert-NotReparsePoint $outputDirectory

$captures = @(
    @{
        Name = '01-control-center.png'
        Query = '?is_popout=1'
    },
    @{
        Name = '02-large-chat.png'
        Query = '?is_popout=1&collapsed=1'
    }
)

$outputPaths = $captures | ForEach-Object { Join-Path $outputDirectory $_.Name }
foreach ($outputPath in $outputPaths) {
    Assert-NotReparsePoint $outputPath
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$fixtureUri = [Uri]::new($fixturePath).AbsoluteUri
function Read-PngDimensions {
    param([string]$Path)

    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 24) {
        throw "PNG 檔案太短：$Path"
    }
    $signature = @(137, 80, 78, 71, 13, 10, 26, 10)
    for ($index = 0; $index -lt $signature.Count; $index++) {
        if ($bytes[$index] -ne $signature[$index]) {
            throw "不是有效的 PNG：$Path"
        }
    }
    $width = ([uint32]$bytes[16] * 0x1000000) + ([uint32]$bytes[17] * 0x10000) + ([uint32]$bytes[18] * 0x100) + [uint32]$bytes[19]
    $height = ([uint32]$bytes[20] * 0x1000000) + ([uint32]$bytes[21] * 0x10000) + ([uint32]$bytes[22] * 0x100) + [uint32]$bytes[23]
    [pscustomobject]@{ Width = [int]$width; Height = [int]$height }
}

$temporaryCaptureDirectory = Join-Path ([IO.Path]::GetTempPath()) "chatobs-store-output-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $temporaryCaptureDirectory | Out-Null

try {
  foreach ($capture in $captures) {
    $profilePath = Join-Path ([IO.Path]::GetTempPath()) "chatobs-store-$([guid]::NewGuid().ToString('N'))"
    $outputPath = Join-Path $temporaryCaptureDirectory $capture.Name
    New-Item -ItemType Directory -Path $profilePath | Out-Null

    try {
        & $ChromePath `
            '--headless=new' `
            '--disable-gpu' `
            '--hide-scrollbars' `
            '--no-first-run' `
            '--run-all-compositor-stages-before-draw' `
            '--virtual-time-budget=1200' `
            '--force-device-scale-factor=1' `
            "--user-data-dir=$profilePath" `
            '--window-size=1280,800' `
            "--screenshot=$outputPath" `
            "$fixtureUri$($capture.Query)" | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Chrome 產生商店截圖失敗（退出碼：$LASTEXITCODE）：$($capture.Name)"
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
  }

  $results = foreach ($capture in $captures) {
    $path = Join-Path $temporaryCaptureDirectory $capture.Name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "商店截圖產生失敗，找不到輸出：$path"
    }
    $dimensions = Read-PngDimensions $path
    if ($dimensions.Width -ne 1280 -or $dimensions.Height -ne 800) {
        throw "商店截圖尺寸錯誤：$($capture.Name)（實際 $($dimensions.Width)x$($dimensions.Height)，預期 1280x800）"
    }
    [pscustomobject]@{
        Name = $capture.Name
        Width = $dimensions.Width
        Height = $dimensions.Height
        Bytes = (Get-Item -LiteralPath $path).Length
    }
  }

  # 兩張圖都通過驗證後才取代正式素材；Chrome 失敗時保留上一版。
  foreach ($capture in $captures) {
    $destination = Join-Path $outputDirectory $capture.Name
    Assert-NotReparsePoint $destination
    Move-Item -LiteralPath (Join-Path $temporaryCaptureDirectory $capture.Name) -Destination $destination -Force
  }

  $results
}
finally {
  $resolvedCaptureDirectory = [IO.Path]::GetFullPath($temporaryCaptureDirectory)
  $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $relativeCaptureDirectory = [IO.Path]::GetRelativePath($resolvedTemp, $resolvedCaptureDirectory).Replace('\', '/')
  $relativeCaptureParts = $relativeCaptureDirectory -split '/'
  if ($relativeCaptureParts.Count -gt 0 -and $relativeCaptureParts[0] -ne '..') {
    Remove-OwnedTemporaryDirectory $resolvedCaptureDirectory
  }
}
