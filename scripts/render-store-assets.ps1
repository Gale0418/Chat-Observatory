param(
    [string]$ChromePath = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixturePath = Join-Path $projectRoot 'tests\visual-fixture.html'
$outputDirectory = Join-Path $projectRoot 'store-assets'

if (-not (Test-Path -LiteralPath $ChromePath)) {
    throw "找不到 Chrome：$ChromePath"
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

foreach ($capture in $captures) {
    $profilePath = Join-Path $env:TEMP "ytce-store-$([guid]::NewGuid().ToString('N'))"
    $outputPath = Join-Path $outputDirectory $capture.Name
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
    }
    finally {
        $resolvedProfile = [IO.Path]::GetFullPath($profilePath)
        $resolvedTemp = [IO.Path]::GetFullPath($env:TEMP)
        if ($resolvedProfile.StartsWith($resolvedTemp, [StringComparison]::OrdinalIgnoreCase)) {
            Remove-Item -LiteralPath $resolvedProfile -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

Add-Type -AssemblyName System.Drawing
Get-ChildItem -LiteralPath $outputDirectory -Filter '*.png' |
    Sort-Object Name |
    ForEach-Object {
        $image = [Drawing.Image]::FromFile($_.FullName)
        try {
            [pscustomobject]@{
                Name = $_.Name
                Width = $image.Width
                Height = $image.Height
                Bytes = $_.Length
            }
        }
        finally {
            $image.Dispose()
        }
    }
