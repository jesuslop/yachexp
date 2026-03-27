$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$staging = Join-Path $dist '_xpi_staging'
$configFilePath = Join-Path $PSScriptRoot '.env.json'

if (!(Test-Path $configFilePath)) {
  throw "Missing config file: $configFilePath"
}

$config = Get-Content -Raw -Path $configFilePath | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($config.WEB_EXT_API_KEY) -or [string]::IsNullOrWhiteSpace($config.WEB_EXT_API_SECRET)) {
  throw 'WEB_EXT_API_KEY and WEB_EXT_API_SECRET must be set in scripts\.env.json.'
}

Push-Location $root
try {
  & "$root\scripts\package.ps1"

  if (!(Test-Path $staging)) {
    throw "Expected staging directory was not created: $staging"
  }

  web-ext sign `
    --source-dir $staging `
    --artifacts-dir $dist `
    --channel unlisted `
    --api-key $config.WEB_EXT_API_KEY `
    --api-secret $config.WEB_EXT_API_SECRET
}
finally {
  Pop-Location
}
