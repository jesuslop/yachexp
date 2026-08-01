$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$staging = Join-Path $dist '_xpi_staging'
$configFilePath = Join-Path $PSScriptRoot '.env.json'
$webExt = Join-Path $root 'node_modules\.bin\web-ext.cmd'
$webExtJwtClockPreload = Join-Path $PSScriptRoot 'web-ext-jwt-clock-preload.cjs'
$amoClockUrl = 'https://addons.mozilla.org/api/v5/site/'

if (!(Test-Path $configFilePath)) {
  throw "Missing config file: $configFilePath"
}

$config = Get-Content -Raw -Path $configFilePath | ConvertFrom-Json

if ([string]::IsNullOrWhiteSpace($config.WEB_EXT_API_KEY) -or [string]::IsNullOrWhiteSpace($config.WEB_EXT_API_SECRET)) {
  throw 'WEB_EXT_API_KEY and WEB_EXT_API_SECRET must be set in scripts\.env.json.'
}

if (!(Test-Path $webExt)) {
  throw "Missing local web-ext executable: $webExt. Run 'npm install' first."
}

if (!(Test-Path $webExtJwtClockPreload)) {
  throw "Missing web-ext JWT clock preload: $webExtJwtClockPreload"
}

function Test-AmoClockSkew {
  $localUtc = [DateTimeOffset]::UtcNow
  $skewSeconds = $null
  Write-Host ("Signing preflight local UTC: {0}" -f $localUtc.ToString('o'))

  try {
    $response = Invoke-WebRequest -Method Head -Uri $amoClockUrl -UseBasicParsing -TimeoutSec 15
    $serverDateHeader = $response.Headers.Date
    if ($serverDateHeader -is [array]) {
      $serverDateHeader = $serverDateHeader[0]
    }

    if ([string]::IsNullOrWhiteSpace($serverDateHeader)) {
      Write-Warning 'Could not read AMO Date header; continuing without clock-skew check.'
      return
    }

    $serverUtc = [DateTimeOffset]::Parse($serverDateHeader).ToUniversalTime()
    $skewSeconds = [Math]::Round(($localUtc - $serverUtc).TotalSeconds, 1)
    Write-Host ("Signing preflight AMO UTC:   {0}" -f $serverUtc.ToString('o'))
    Write-Host ("Signing preflight skew:      {0} seconds" -f $skewSeconds)
  }
  catch {
    Write-Warning "Could not verify AMO clock skew: $($_.Exception.Message)"
  }

  if ($null -ne $skewSeconds -and [Math]::Abs($skewSeconds) -gt 120) {
    throw "Local clock differs from AMO by $skewSeconds seconds. Sync Windows time, then rerun the release."
  }

  return $skewSeconds
}

Push-Location $root
try {
  & "$root\scripts\package.ps1"

  if (!(Test-Path $staging)) {
    throw "Expected staging directory was not created: $staging"
  }

  $skewSeconds = Test-AmoClockSkew
  $jwtBackdateSeconds = 0
  if ($null -ne $skewSeconds -and $skewSeconds -gt 0) {
    $jwtBackdateSeconds = [Math]::Min(60, [Math]::Ceiling($skewSeconds) + 10)
    Write-Host ("Signing preflight JWT backdate: {0} seconds" -f $jwtBackdateSeconds)
  }

  $previousNodeOptions = $env:NODE_OPTIONS
  $previousJwtBackdate = $env:WEB_EXT_JWT_BACKDATE_SECONDS

  try {
    if ($jwtBackdateSeconds -gt 0) {
      $webExtJwtClockPreloadForNode = $webExtJwtClockPreload -replace '\\', '/'
      $env:WEB_EXT_JWT_BACKDATE_SECONDS = [string]$jwtBackdateSeconds
      $env:NODE_OPTIONS = "--require `"$webExtJwtClockPreloadForNode`" $previousNodeOptions".Trim()
    }

    & $webExt sign `
      --source-dir $staging `
      --artifacts-dir $dist `
      --channel unlisted `
      --api-key $config.WEB_EXT_API_KEY `
      --api-secret $config.WEB_EXT_API_SECRET
  }
  finally {
    $env:NODE_OPTIONS = $previousNodeOptions
    $env:WEB_EXT_JWT_BACKDATE_SECONDS = $previousJwtBackdate
  }
}
finally {
  Pop-Location
}
