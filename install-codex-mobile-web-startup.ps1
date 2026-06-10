param(
    [string]$TaskName = "Codex Mobile Web",
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8787,
    [string]$CodexExe = "",
    [string]$UserId = "",
    [string]$UserProfilePath = "",
    [string]$HermesPluginBaseUrl = "",
    [string]$PublicBaseUrl = "",
    [string]$HermesPluginFrameOrigins = "",
    [string]$HermesPluginNotificationBaseUrl = "",
    [string]$HermesPluginNotificationKey = "",
    [string]$HermesPluginNotificationKeyFile = "",
    [switch]$RunAsSystem,
    [switch]$InteractiveLogon,
    [switch]$AllowManagedFallback,
    [switch]$NoAuth,
    [switch]$RunNow
)

$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

if ($RunAsSystem -and $InteractiveLogon) {
    throw "-RunAsSystem and -InteractiveLogon cannot be used together."
}

function Test-LocalSystemIdentity {
    param([string]$Name)
    if ([string]::IsNullOrWhiteSpace($Name)) {
        return $false
    }
    return ($Name -ieq "NT AUTHORITY\SYSTEM") -or ($Name -ieq "SYSTEM")
}

if ($RunAsSystem) {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $principalCheck = [System.Security.Principal.WindowsPrincipal]::new($identity)
    $isAdmin = $principalCheck.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        throw "Installing with -RunAsSystem requires an elevated PowerShell session. The default user-logon task does not require LocalSystem."
    }
}

$installingUserProfile = if (-not [string]::IsNullOrWhiteSpace($UserProfilePath)) {
    [Environment]::ExpandEnvironmentVariables($UserProfilePath)
} else {
    $env:USERPROFILE
}
if ([string]::IsNullOrWhiteSpace($installingUserProfile) -or -not (Test-Path -LiteralPath $installingUserProfile -PathType Container)) {
    throw "User profile path not found. Run this installer as the target Windows user or pass -UserProfilePath <profile-path>."
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
if (-not [string]::IsNullOrWhiteSpace($HermesPluginBaseUrl)) {
    $arguments += @("-HermesPluginBaseUrl", (Quote-TaskArgument $HermesPluginBaseUrl))
}
if (-not [string]::IsNullOrWhiteSpace($PublicBaseUrl)) {
    $arguments += @("-PublicBaseUrl", (Quote-TaskArgument $PublicBaseUrl))
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginFrameOrigins)) {
    $arguments += @("-HermesPluginFrameOrigins", (Quote-TaskArgument $HermesPluginFrameOrigins))
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationBaseUrl)) {
    $arguments += @("-HermesPluginNotificationBaseUrl", (Quote-TaskArgument $HermesPluginNotificationBaseUrl))
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationKey)) {
    $arguments += @("-HermesPluginNotificationKey", (Quote-TaskArgument $HermesPluginNotificationKey))
}
if (-not [string]::IsNullOrWhiteSpace($HermesPluginNotificationKeyFile)) {
    $arguments += @("-HermesPluginNotificationKeyFile", (Quote-TaskArgument $HermesPluginNotificationKeyFile))
}
if (-not $AllowManagedFallback) {
    $arguments += "-EnsureStandaloneMux"
    $arguments += "-RequireSharedAppServer"
}
if ($NoAuth) {
    $arguments += "-NoAuth"
}
if ($RunAsSystem) {
    $arguments += "-RunAsSystemTask"
}

$currentIdentityName = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
if ([string]::IsNullOrWhiteSpace($UserId) -and -not $RunAsSystem) {
    if (Test-LocalSystemIdentity -Name $currentIdentityName) {
        throw "Default startup mode registers an interactive user-logon task. When running as LocalSystem, pass -UserId <domain\user> and -UserProfilePath <profile-path>, or run this installer from that user's PowerShell session."
    }
    $UserId = $currentIdentityName
}
$action = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument ($arguments -join " ") `
    -WorkingDirectory $scriptRoot
if ($RunAsSystem) {
    $trigger = New-ScheduledTaskTrigger -AtStartup
} else {
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $UserId
}
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit ([TimeSpan]::Zero)
$settings.Hidden = $true
if ($RunAsSystem) {
    $principal = New-ScheduledTaskPrincipal `
        -UserId "SYSTEM" `
        -LogonType ServiceAccount `
        -RunLevel Highest
    $descriptionMode = "at Windows startup as LocalSystem"
} else {
    $principal = New-ScheduledTaskPrincipal `
        -UserId $UserId `
        -LogonType Interactive `
        -RunLevel Limited
    $descriptionMode = "at Windows logon as $UserId"
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
