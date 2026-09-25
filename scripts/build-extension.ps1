param(
    [string]$OutputDirectory = (Join-Path (Join-Path $PSScriptRoot '..') 'dist')
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$stagingRoot = Join-Path $outputRoot 'chat-observatory'
$zipPath = Join-Path $outputRoot 'chat-observatory.zip'

$relativeOutput = [IO.Path]::GetRelativePath($projectRoot, $outputRoot).Replace('\', '/')
$isProjectRoot = $relativeOutput -eq '.'
$relativeOutputParts = $relativeOutput -split '/'
$isOutsideProject = $relativeOutputParts.Count -gt 0 -and $relativeOutputParts[0] -eq '..'
if ($isProjectRoot -or $isOutsideProject) {
    throw "輸出資料夾必須是專案內的子資料夾（不可是專案本身或專案外）：$projectRoot"
}

function Test-ReparsePoint {
    param([string]$Path)
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) {
        return $false
    }
    return ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
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
            throw "無法驗證輸出路徑的父層：$Path"
        }
        $current = $parent
    }
}

Assert-NoReparsePointsInPath -Path $outputRoot -Boundary $projectRoot

if (Test-Path -LiteralPath $outputRoot -PathType Leaf) {
    throw "輸出路徑必須是資料夾：$outputRoot"
}

if (Test-ReparsePoint $stagingRoot) {
    throw "拒絕刪除符號連結或其他重解析點：$stagingRoot"
}
if (Test-Path -LiteralPath $stagingRoot) {
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

if (Test-ReparsePoint $zipPath) {
    throw "拒絕刪除符號連結或其他重解析點：$zipPath"
}
if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

$requiredFiles = @(
    @('manifest.json'),
    @('background.js'),
    @('content.js'),
    @('content.css'),
    @('_locales', 'en', 'messages.json'),
    @('_locales', 'ja', 'messages.json'),
    @('_locales', 'zh_TW', 'messages.json'),
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
    @('assets', 'themes', 'cosmic-spectrum-rainbow.jpg'),
    @('icons', 'icon-16.png'),
    @('icons', 'icon-32.png'),
    @('icons', 'icon-48.png'),
    @('icons', 'icon-128.png')
)

foreach ($pathSegments in $requiredFiles) {
    $relativePath = $pathSegments -join '/'
    $source = $projectRoot
    foreach ($segment in $pathSegments) {
        $source = Join-Path $source $segment
    }
    Assert-NoReparsePointsInPath -Path $source -Boundary $projectRoot
    $sourceItem = Get-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue
    if ($null -eq $sourceItem) {
        throw "缺少必要檔案：$relativePath"
    }
    if ($sourceItem.PSIsContainer -or $sourceItem -isnot [IO.FileInfo]) {
        throw "必要來源必須是一般檔案：$relativePath"
    }
    $destination = $stagingRoot
    foreach ($segment in $pathSegments) {
        $destination = Join-Path $destination $segment
    }
    $destinationDirectory = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination

    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $destinationHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash
    if ($sourceHash -ne $destinationHash) {
        throw "封裝檔案與來源不一致：$relativePath"
    }
}

Compress-Archive -Path (Join-Path $stagingRoot '*') -DestinationPath $zipPath

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $actualEntries = @(
        $archive.Entries |
            Where-Object { $_.Name } |
            ForEach-Object { $_.FullName.Replace('\', '/') } |
            Sort-Object
    )
    $expectedEntries = @(
        $requiredFiles |
            ForEach-Object { ($_ -join '/').Replace('\', '/') } |
            Sort-Object
    )
    $unexpectedEntries = @(Compare-Object -ReferenceObject $expectedEntries -DifferenceObject $actualEntries)
    if ($unexpectedEntries.Count -gt 0) {
        $details = ($unexpectedEntries | ForEach-Object { "$($_.SideIndicator) $($_.InputObject)" }) -join ', '
        throw "ZIP 內容與預期清單不一致：$details"
    }
}
finally {
    $archive.Dispose()
}

[pscustomobject]@{
    StagingDirectory = $stagingRoot
    ZipPath = $zipPath
    ZipBytes = (Get-Item -LiteralPath $zipPath).Length
    VerifiedFiles = $requiredFiles.Count
}
