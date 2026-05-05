param(
    [string]$TaskName = "Codex Mobile Web",
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8787,
    [string]$CodexExe = "",
    [switch]$RunAsSystem,
    [switch]$InteractiveLogon,
    [switch]$AllowManagedFallback,
    [switch]$NoAuth,
    [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$installingUserProfile = $env:USERPROFILE
if (-not $InteractiveLogon) {
    $RunAsSystem = $true
}
if ($RunAsSystem -and $InteractiveLogon) {
    throw "-RunAsSystem and -InteractiveLogon cannot be used together."
}
if ($RunAsSystem) {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principalCheck = [System.Security.Principal.WindowsPrincipal]::new($identity)
    $isAdmin = $principalCheck.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        throw "Installing a sign-out-safe startup task requires an elevated PowerShell session. Re-run this script as Administrator, or use -InteractiveLogon for the older sign-in-bound task."
    }
}

$launcher = Join-Path $scriptRoot "start-codex-mobile-web-windowless.ps1"
$hiddenLauncher = Join-Path $scriptRoot "start-codex-mobile-web-hidden.vbs"
if (-not (Test-Path -LiteralPath $launcher)) {
    throw "Windowless launcher not found: $launcher"
}
if (-not (Test-Path -LiteralPath $hiddenLauncher)) {
    throw "Hidden launcher not found: $hiddenLauncher"
}

function Quote-TaskArgument {
    param([string]$Value)
    '"' + ($Value -replace '"', '\"') + '"'
}

$arguments = @(
    (Quote-TaskArgument $hiddenLauncher),
    "-HostAddress", (Quote-TaskArgument $HostAddress),
    "-Port", [string]$Port,
    "-UserProfilePath", (Quote-TaskArgument $installingUserProfile)
)

if (-not [string]::IsNullOrWhiteSpace($CodexExe)) {
    $arguments += @("-CodexExe", (Quote-TaskArgument $CodexExe))
}
if (-not $AllowManagedFallback) {
    $arguments += "-EnsureStandaloneMux"
    $arguments += "-RequireSharedAppServer"
}
if ($NoAuth) {
    $arguments += "-NoAuth"
}

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument ($arguments -join " ") `
    -WorkingDirectory $scriptRoot
if ($RunAsSystem) {
    $trigger = New-ScheduledTaskTrigger -AtStartup
} else {
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
}
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
if ($RunAsSystem) {
    $principal = New-ScheduledTaskPrincipal `
        -UserId "SYSTEM" `
        -LogonType ServiceAccount `
        -RunLevel Highest
    $descriptionMode = "at Windows startup as LocalSystem"
} else {
    $principal = New-ScheduledTaskPrincipal `
        -UserId $currentUser `
        -LogonType Interactive `
        -RunLevel Limited
    $descriptionMode = "at Windows logon"
}

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Start Codex Mobile Web on port $Port without a visible console window $descriptionMode." `
    -Force | Out-Null

if ($RunNow) {
    Start-ScheduledTask -TaskName $TaskName
}

Get-ScheduledTask -TaskName $TaskName | Select-Object TaskName, State
