param(
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$drives = Get-PSDrive -PSProvider FileSystem | ForEach-Object {
  [PSCustomObject]@{
    Name = $_.Name
    UsedGB = [math]::Round($_.Used / 1GB, 2)
    FreeGB = [math]::Round($_.Free / 1GB, 2)
    TotalGB = [math]::Round(($_.Used + $_.Free) / 1GB, 2)
  }
}

$result = [PSCustomObject]@{
  tool = "systemStatus"
  mode = $(if ($DryRun) { "dry_run" } else { "read_only" })
  executedAt = (Get-Date).ToString("o")
  device = [PSCustomObject]@{
    hostname = $env:COMPUTERNAME
    username = $env:USERNAME
    osCaption = $os.Caption
    osVersion = $os.Version
    architecture = $os.OSArchitecture
    uptimeMinutes = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalMinutes, 0)
  }
  cpu = [PSCustomObject]@{
    name = $cpu.Name
    cores = $cpu.NumberOfCores
    logicalProcessors = $cpu.NumberOfLogicalProcessors
  }
  memory = [PSCustomObject]@{
    totalGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
    freeGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
    usedGB = [math]::Round(($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1MB, 2)
  }
  disks = $drives
  security = [PSCustomObject]@{
    readOnly = $true
    usesNetwork = $false
    usesExternalProvider = $false
    modifiesFiles = $false
  }
}

$result | ConvertTo-Json -Depth 8