$ErrorActionPreference = "Stop"

$toolPath = Join-Path $PSScriptRoot "..\src\systemStatus.ps1"

Write-Host "Testing systemStatus tool in dry_run mode..."
$output = & $toolPath -DryRun

if (-not $output) {
  throw "Tool returned empty output."
}

$json = $output | ConvertFrom-Json

if ($json.tool -ne "systemStatus") {
  throw "Unexpected tool name."
}

if ($json.security.readOnly -ne $true) {
  throw "Tool is not marked as read-only."
}

if ($json.security.usesNetwork -ne $false) {
  throw "Tool should not use network."
}

Write-Host "systemStatus dry_run test passed."
$output