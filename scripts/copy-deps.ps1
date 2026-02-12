Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$libDir = Join-Path $root 'lib'

if (-not (Test-Path $libDir)) {
  New-Item -ItemType Directory -Force -Path $libDir | Out-Null
}

$turndownSrc = Join-Path $root 'node_modules\turndown\dist\turndown.js'
$gfmSrc = Join-Path $root 'node_modules\turndown-plugin-gfm\dist\turndown-plugin-gfm.js'
$jsonataSrc = Join-Path $root 'node_modules\jsonata\jsonata.js'
$yuppeeSrc = Join-Path $root 'node_modules\yuppee\dist\yuppee.umd.cjs'

if (-not (Test-Path $turndownSrc)) {
  throw "Missing $turndownSrc. Run 'npm install' first."
}

if (-not (Test-Path $gfmSrc)) {
  throw "Missing $gfmSrc. Run 'npm install' first."
}

if (-not (Test-Path $jsonataSrc)) {
  throw "Missing $jsonataSrc. Run 'npm install' first."
}

if (-not (Test-Path $yuppeeSrc)) {
  throw "Missing $yuppeeSrc. Run 'npm install' first."
}

Copy-Item -Force $turndownSrc (Join-Path $libDir 'turndown.js')
Copy-Item -Force $gfmSrc (Join-Path $libDir 'turndown-plugin-gfm.js')
Copy-Item -Force $jsonataSrc (Join-Path $libDir 'jsonata.js')
Copy-Item -Force $yuppeeSrc (Join-Path $libDir 'yuppee.js')

Write-Host 'Dependencies synced into lib/.'
