' WhatsApp MCP Bridge Startup Script
' Place this file in your Windows Startup folder (Win+R, shell:startup)
' It starts the WhatsApp bridge silently in the background

Dim objShell, strPath, strExe, strWorkingDir

Set objShell = CreateObject("WScript.Shell")

' Get the script's directory
strPath = Replace(WScript.ScriptFullName, WScript.ScriptName, "")

' Set paths
strExe = strPath & "whatsapp-bridge\main.exe"
strWorkingDir = strPath & "whatsapp-bridge"

' Check if main.exe exists
Dim objFSO
Set objFSO = CreateObject("Scripting.FileSystemObject")

If Not objFSO.FileExists(strExe) Then
    MsgBox "WhatsApp Bridge not found at: " & vbCrLf & strExe & vbCrLf & vbCrLf & _
           "Please ensure main.exe is built in the whatsapp-bridge folder.", _
           vbExclamation, "WhatsApp MCP Bridge"
    WScript.Quit
End If

' Start the bridge silently (0 = hidden window)
objShell.CurrentDirectory = strWorkingDir
objShell.Run """" & strExe & """", 0, False

' Clean up
Set objShell = Nothing
Set objFSO = Nothing