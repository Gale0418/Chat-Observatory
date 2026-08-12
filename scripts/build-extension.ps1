param(
    [string]$OutputDirectory = (Join-Path (Join-Path $PSScriptRoot '..') 'dist')
)

$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputRoot = [IO.Path]::GetFullPath($OutputDirectory)
$stagingRoot = Join-Path $outputRoot 'yt-chat-enlarger'
$zipPath = Join-Path $outputRoot 'yt-chat-enlarger.zip'

$relativeOutput = [IO.Path]::GetRelativePath($projectRoot, $outputRoot).Replace('\', '/')
$isProjectRoot = $relativeOutput -eq '.'
$relativeOutputParts = $relativeOutput -split '/'
$isOutsideProject = $relativeOutputParts.Count -gt 0 -and $relativeOutputParts[0] -eq '..'
if ($isProjectRoot -or $isOutsideProject) {
    throw "輸出資料夾必須是專案內的子資料夾（不可是專案本身或專案外）：$projectRoot"
}

function Test-ReparsePoint {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        return $false
    }
    $item = Get-Item -LiteralPath $Path -Force
    return ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0
}

if (Test-ReparsePoint $outputRoot) {
    throw "輸出資料夾不可是符號連結或其他重解析點：$outputRoot"
}

if (Test-Path -LiteralPath $stagingRoot) {
    if (Test-ReparsePoint $stagingRoot) {
        throw "拒絕刪除符號連結或其他重解析點：$stagingRoot"
    }
    Remove-Item -LiteralPath $stagingRoot -Recurse -Force
}

if (Test-Path -LiteralPath $zipPath) {
    if (Test-ReparsePoint $zipPath) {
        throw "拒絕刪除符號連結或其他重解析點：$zipPath"
    }
    Remove-Item -LiteralPath $zipPath -Force
}

New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null

$requiredFiles = @(
    @('manifest.json'),
    @('background.js'),
    @('content.js'),
    @('content.css'),
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
    if (-not (Test-Path -LiteralPath $source)) {
        throw "缺少必要檔案：$relativePath"
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
