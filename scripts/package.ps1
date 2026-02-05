# PowerShell packaging script for Firefox XPI
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$dist = Join-Path $root 'dist'

if (!(Test-Path $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

Push-Location $root
try {
  web-ext build --overwrite-dest --artifacts-dir $dist
}
finally {
  Pop-Location
}
