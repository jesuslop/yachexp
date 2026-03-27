$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$staging = Join-Path $dist '_xpi_staging'
$manifestPath = Join-Path $root 'manifest.json'

if (!(Test-Path $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
$includedFiles = [System.Collections.Generic.HashSet[string]]::new(
  [System.StringComparer]::OrdinalIgnoreCase
)

function Normalize-RelativePath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue
  )

  return ($PathValue -replace '/', '\').TrimStart('\')
}

function Add-RelativeFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RelativePath
  )

  if ([string]::IsNullOrWhiteSpace($RelativePath)) {
    return
  }

  if ($RelativePath -match '^(?:[a-z]+:)?//') {
    return
  }

  if ($RelativePath.StartsWith('#')) {
    return
  }

  $normalized = Normalize-RelativePath $RelativePath
  $fullPath = Join-Path $root $normalized

  if ((Test-Path $fullPath) -and !(Test-Path $fullPath -PathType Container)) {
    [void]$includedFiles.Add($normalized)
  }
}

function Add-HtmlDependencies {
  param(
    [Parameter(Mandatory = $true)]
    [string]$HtmlRelativePath
  )

  Add-RelativeFile $HtmlRelativePath

  $normalized = Normalize-RelativePath $HtmlRelativePath
  $fullPath = Join-Path $root $normalized
  if (!(Test-Path $fullPath)) {
    return
  }

  $html = Get-Content -Raw -Path $fullPath
  $regex = '(?:src|href)\s*=\s*["'']([^"'']+)["'']'

  foreach ($match in [System.Text.RegularExpressions.Regex]::Matches($html, $regex)) {
    $assetPath = $match.Groups[1].Value
    if ($assetPath -match '^(?:[a-z]+:)?//') {
      continue
    }
    if ($assetPath.StartsWith('#')) {
      continue
    }

    $resolved = [System.IO.Path]::GetFullPath(
      (Join-Path (Split-Path -Parent $fullPath) $assetPath)
    )

    if ($resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
      $relative = $resolved.Substring($root.Length).TrimStart('\', '/')
      Add-RelativeFile $relative
    }
  }
}

function Add-ManifestValue {
  param(
    $Value
  )

  if ($null -eq $Value) {
    return
  }

  if ($Value -is [string]) {
    Add-RelativeFile $Value
    return
  }

  if ($Value -is [System.Collections.IEnumerable] -and !($Value -is [string])) {
    foreach ($item in $Value) {
      Add-ManifestValue $item
    }
    return
  }

  if ($Value -is [pscustomobject]) {
    foreach ($property in $Value.PSObject.Properties) {
      Add-ManifestValue $property.Value
    }
  }
}

function Get-ManifestPropertyValue {
  param(
    $Object,
    [Parameter(Mandatory = $true)]
    [string]$PropertyName
  )

  if ($null -eq $Object) {
    return $null
  }

  $property = $Object.PSObject.Properties[$PropertyName]
  if ($null -eq $property) {
    return $null
  }

  return $property.Value
}

Add-RelativeFile 'manifest.json'
Add-RelativeFile 'default-settings.json'
Add-RelativeFile 'LICENSE.txt'

foreach ($contentScript in @($manifest.content_scripts)) {
  Add-ManifestValue (Get-ManifestPropertyValue $contentScript 'js')
  Add-ManifestValue (Get-ManifestPropertyValue $contentScript 'css')
}

if ($manifest.background) {
  Add-ManifestValue (Get-ManifestPropertyValue $manifest.background 'scripts')
  Add-ManifestValue (Get-ManifestPropertyValue $manifest.background 'service_worker')
}

$optionsPage = Get-ManifestPropertyValue $manifest.options_ui 'page'
if ($optionsPage) {
  Add-HtmlDependencies $optionsPage
}

if ($manifest.action) {
  Add-ManifestValue (Get-ManifestPropertyValue $manifest.action 'default_popup')
  Add-ManifestValue (Get-ManifestPropertyValue $manifest.action 'default_icon')
}

Add-ManifestValue $manifest.icons

foreach ($resourceSet in @(Get-ManifestPropertyValue $manifest 'web_accessible_resources')) {
  Add-ManifestValue (Get-ManifestPropertyValue $resourceSet 'resources')
}

if (Test-Path $staging) {
  Remove-Item -Recurse -Force -Path $staging
}
New-Item -ItemType Directory -Path $staging | Out-Null

foreach ($relativePath in ($includedFiles | Sort-Object)) {
  $sourcePath = Join-Path $root $relativePath
  $targetPath = Join-Path $staging $relativePath
  $targetDir = Split-Path -Parent $targetPath

  if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  }

  Copy-Item -Path $sourcePath -Destination $targetPath -Force
}

$slug = ($manifest.name.ToLowerInvariant() -replace '[^a-z0-9]+', '_').Trim('_')
$outputName = '{0}-{1}.xpi' -f $slug, $manifest.version
$outputPath = Join-Path $dist $outputName

if (Test-Path $outputPath) {
  Remove-Item -Force -Path $outputPath
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $outputPath)

Write-Host ("Created local test XPI: {0}" -f $outputPath)
Write-Host ("Included {0} files." -f $includedFiles.Count)
