Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$libDir = Join-Path $root 'lib'

if (-not (Test-Path $libDir)) {
  New-Item -ItemType Directory -Force -Path $libDir | Out-Null
}

$turndownSrc = Join-Path $root 'node_modules\turndown\dist\turndown.js'
$gfmSrc = Join-Path $root 'node_modules\turndown-plugin-gfm\dist\turndown-plugin-gfm.js'

if (-not (Test-Path $turndownSrc)) {
  throw "Missing $turndownSrc. Run 'npm install' first."
}

if (-not (Test-Path $gfmSrc)) {
  throw "Missing $gfmSrc. Run 'npm install' first."
}

Copy-Item -Force $turndownSrc (Join-Path $libDir 'turndown.js')
Copy-Item -Force $gfmSrc (Join-Path $libDir 'turndown-plugin-gfm.js')

Write-Host 'Dependencies synced into lib/.'
