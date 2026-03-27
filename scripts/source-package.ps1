$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$staging = Join-Path $dist '_source_review_staging'
$manifestPath = Join-Path $root 'manifest.json'

if (!(Test-Path $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

if (Test-Path $staging) {
  Remove-Item -Recurse -Force -Path $staging
}

New-Item -ItemType Directory -Path $staging | Out-Null

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$outputPath = Join-Path $dist ("source-review-{0}.zip" -f $manifest.version)

if (Test-Path $outputPath) {
  Remove-Item -Force -Path $outputPath
}

$excludePatterns = @(
  '.git',
  'dist',
  'node_modules',
  'private'
)

Get-ChildItem -Path $root -Force | Where-Object {
  $excludePatterns -notcontains $_.Name
} | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination $staging -Recurse -Force
}

Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $outputPath

Write-Host ("Created source review package: {0}" -f $outputPath)
