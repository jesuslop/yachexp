# PowerShell release script: build + sign unlisted XPI
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$dist = Join-Path $root 'dist'
$config_file_path = Join-Path $PSScriptRoot '.env.json'

if (!(Test-Path $config_file_path)) {
  throw "Missing config file: $config_file_path"
}

$config = Get-Content -Raw $config_file_path | ConvertFrom-Json

if (!(Test-Path $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

if ([string]::IsNullOrWhiteSpace($config.WEB_EXT_API_KEY) -or [string]::IsNullOrWhiteSpace($config.WEB_EXT_API_SECRET)) {
  throw 'WEB_EXT_API_KEY and WEB_EXT_API_SECRET must be set in scripts\\.env.json.'
}

Push-Location $root
try {
  & "$root\scripts\package.ps1"
  web-ext sign --source-dir $root --artifacts-dir $dist --channel unlisted --api-key $config.WEB_EXT_API_KEY --api-secret $config.WEB_EXT_API_SECRET
}
finally {
  Pop-Location
}
