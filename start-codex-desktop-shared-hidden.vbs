Option Explicit

Dim shell
Dim fso
Dim scriptDir
Dim psScript
Dim command
Dim i

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
psScript = fso.BuildPath(scriptDir, "start-codex-desktop-shared.ps1")

command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " & Quote(psScript)

For i = 0 To WScript.Arguments.Count - 1
    command = command & " " & Quote(WScript.Arguments(i))
Next

shell.CurrentDirectory = scriptDir
shell.Run command, 0, True

Function Quote(ByVal value)
    Quote = Chr(34) & Replace(CStr(value), Chr(34), Chr(34) & Chr(34)) & Chr(34)
End Function
