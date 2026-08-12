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
        $isWindows = $env:OS -eq 'Windows_NT'
        if ($isWindows) {
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

$ChromePath = Resolve-ChromeExecutable $ChromePath

if (-not (Test-Path -LiteralPath $fixturePath -PathType Leaf)) {
    throw "找不到商店截圖版型：$fixturePath"
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$fixtureUri = [Uri]::new($fixturePath).AbsoluteUri

$captures = @(
    @{
        Name = '01-control-center.png'
        Query = '?is_popout=1'
    },
    @{
        Name = '02-large-chat.png'
        Query = '?is_popout=1&mode=monitor&collapsed=1'
    }
)
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

$temporaryCaptureDirectory = Join-Path ([IO.Path]::GetTempPath()) "ytce-store-output-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $temporaryCaptureDirectory | Out-Null

try {
  foreach ($capture in $captures) {
    $profilePath = Join-Path ([IO.Path]::GetTempPath()) "ytce-store-$([guid]::NewGuid().ToString('N'))"
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
            Remove-Item -LiteralPath $resolvedProfile -Recurse -Force -ErrorAction SilentlyContinue
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
    Move-Item -LiteralPath (Join-Path $temporaryCaptureDirectory $capture.Name) -Destination (Join-Path $outputDirectory $capture.Name) -Force
  }

  $results
}
finally {
  $resolvedCaptureDirectory = [IO.Path]::GetFullPath($temporaryCaptureDirectory)
  $resolvedTemp = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
  $relativeCaptureDirectory = [IO.Path]::GetRelativePath($resolvedTemp, $resolvedCaptureDirectory).Replace('\', '/')
  $relativeCaptureParts = $relativeCaptureDirectory -split '/'
  if ($relativeCaptureParts.Count -gt 0 -and $relativeCaptureParts[0] -ne '..') {
    Remove-Item -LiteralPath $resolvedCaptureDirectory -Recurse -Force -ErrorAction SilentlyContinue
  }
}
