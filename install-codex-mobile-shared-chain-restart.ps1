param(
  [string]$TaskName = "Codex Mobile Web Shared Chain Restart",
  [string]$MobileTaskName = "Codex Mobile Web",
  [string]$At = "04:30",
  [string]$WorkspacePath = (Split-Path -Parent $MyInvocation.MyCommand.Path),
  [string]$UserProfilePath = $env:USERPROFILE,
  [switch]$RunNow,
  [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

function Resolve-ExistingPath {
  param([string]$Path)
  if ([string]::IsNullOrWhiteSpace($Path)) {
    return $null
  }
  try {
    return (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
  } catch {
    return [System.IO.Path]::GetFullPath($Path)
  }
}

function Quote-TaskArgument {
  param([string]$Value)
  return '"' + ($Value -replace '"', '\"') + '"'
}

$WorkspacePath = Resolve-ExistingPath $WorkspacePath
$UserProfilePath = Resolve-ExistingPath $UserProfilePath
$RestartScript = Join-Path $WorkspacePath "restart-codex-mobile-shared-chain.ps1"

if ($Uninstall) {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed scheduled task '$TaskName' if it existed."
  exit 0
}

if (-not (Test-Path -LiteralPath $RestartScript)) {
  throw "Restart script not found: $RestartScript"
}

try {
  $AtTime = [datetime]::Today.Add([TimeSpan]::Parse($At))
} catch {
  $AtTime = [datetime]::Parse($At)
}

$PowerShellExe = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
$Arguments = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-WindowStyle", "Hidden",
  "-File", (Quote-TaskArgument $RestartScript),
  "-TaskName", (Quote-TaskArgument $MobileTaskName),
  "-WorkspacePath", (Quote-TaskArgument $WorkspacePath),
  "-UserProfilePath", (Quote-TaskArgument $UserProfilePath)
) -join " "

$Action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument $Arguments -WorkingDirectory $WorkspacePath
$Trigger = New-ScheduledTaskTrigger -Daily -At $AtTime
$Principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$Settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)

$Task = New-ScheduledTask `
  -Action $Action `
  -Trigger $Trigger `
  -Principal $Principal `
  -Settings $Settings `
  -Description "Daily hidden restart for the Codex Mobile Web shared app-server chain only. It does not restart Hermes Mobile, Gateway, WSL, or Codex Desktop."
$Task.Settings.Hidden = $true

Register-ScheduledTask -TaskName $TaskName -InputObject $Task -Force | Out-Null

if ($RunNow) {
  Start-ScheduledTask -TaskName $TaskName
}

$Registered = Get-ScheduledTask -TaskName $TaskName
$Info = Get-ScheduledTaskInfo -TaskName $TaskName
[pscustomobject]@{
  TaskName = $Registered.TaskName
  State = $Registered.State
  NextRunTime = $Info.NextRunTime
  LastRunTime = $Info.LastRunTime
  LastTaskResult = $Info.LastTaskResult
}
