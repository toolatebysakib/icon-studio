Unicode True
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
Name "Icon Studio by Sakib"
OutFile "..\..\..\outputs\IconStudio-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Icon Studio"
InstallDirRegKey HKCU "Software\Sakib\IconStudioApp" "InstallLocation"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails nevershow
VIProductVersion "5.0.0.0"
VIAddVersionKey "ProductName" "Icon Studio by Sakib"
VIAddVersionKey "CompanyName" "Sakib"
VIAddVersionKey "FileDescription" "Icon Studio Installer"
VIAddVersionKey "FileVersion" "5.0.0"
VIAddVersionKey "LegalCopyright" "Copyright Sakib 2026"
!define MUI_ICON "assets\app.ico"
!define MUI_UNICON "assets\app.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\IconStudioApp.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Open Icon Studio"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Var ResolveUtility
Var WaitPID

Function .onInit
 SetShellVarContext current
 SetRegView 64
 ${IfNot} ${RunningX64}
  MessageBox MB_OK|MB_ICONSTOP "Icon Studio requires 64-bit Windows 10 or later."
  Abort
 ${EndIf}
 ${GetParameters} $0
 ${GetOptions} $0 "/WAITPID=" $WaitPID
 StrCmp $WaitPID "" donewait
 System::Call 'kernel32::OpenProcess(i 0x00100000, i 0, i $WaitPID) p.r1'
 StrCmp $1 "0" donewait
 System::Call 'kernel32::WaitForSingleObject(p r1, i 30000) i.r2'
 System::Call 'kernel32::CloseHandle(p r1)'
 StrCmp $2 "0" donewait
 MessageBox MB_OK|MB_ICONSTOP "Close Icon Studio, then run this installer again."
 Abort
 donewait:
 ReadRegStr $ResolveUtility HKCU "Software\Sakib\IconStudioApp" "ResolveUtilityFolder"
 StrCmp $ResolveUtility "" 0 +2
 StrCpy $ResolveUtility "$APPDATA\Blackmagic Design\DaVinci Resolve\Support\Fusion\Scripts\Utility"
FunctionEnd

Section "Icon Studio"
 SetShellVarContext current
 SetRegView 64
 SetOutPath "$INSTDIR"
 ; Preserve one previous executable. Never stop Resolve or discard user data.
 IfFileExists "$INSTDIR\IconStudioApp.exe" 0 newinstall
 Delete "$INSTDIR\IconStudioApp.previous.exe"
 ClearErrors
 Rename "$INSTDIR\IconStudioApp.exe" "$INSTDIR\IconStudioApp.previous.exe"
 IfErrors appbusy newinstall
 appbusy:
 MessageBox MB_OK|MB_ICONSTOP "Close Icon Studio before installing the update."
 Abort
 newinstall:
 ClearErrors
 File "package\IconStudioApp.exe"
 IfErrors rollback
 File "package\WebView2Loader.dll"
 File "assets\app.ico"
 File /r "package\web"
 CreateDirectory "$ResolveUtility\_IconStudioAppConnector"
 SetOutPath "$ResolveUtility\_IconStudioAppConnector"
 File "resolve\bridge.py.txt"
 SetOutPath "$ResolveUtility"
 File "resolve\Icon Studio App.py"
 SetOutPath "$INSTDIR"
 WriteRegStr HKCU "Software\Sakib\IconStudioApp" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Sakib\IconStudioApp" "ResolveUtilityFolder" "$ResolveUtility"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IconStudioApp" "DisplayName" "Icon Studio by Sakib"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IconStudioApp" "DisplayVersion" "5.0.0"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IconStudioApp" "Publisher" "Sakib"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IconStudioApp" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IconStudioApp" "DisplayIcon" "$INSTDIR\app.ico"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IconStudioApp" "UninstallString" '"$INSTDIR\Uninstall.exe"'
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IconStudioApp" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IconStudioApp" "NoRepair" 1
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 CreateDirectory "$SMPROGRAMS\Icon Studio"
 CreateShortcut "$SMPROGRAMS\Icon Studio\Icon Studio.lnk" "$INSTDIR\IconStudioApp.exe" "" "$INSTDIR\app.ico"
 CreateShortcut "$DESKTOP\Icon Studio.lnk" "$INSTDIR\IconStudioApp.exe" "" "$INSTDIR\app.ico"
 InitPluginsDir
 File /oname=$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe "..\..\toolchain\MicrosoftEdgeWebview2Setup.exe"
 DetailPrint "Checking Microsoft WebView2…"
 ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install' $0
 IfSilent 0 installcomplete
 ${GetParameters} $0
 ${GetOptions} $0 "/NOLAUNCH" $1
 IfErrors 0 installcomplete
 Exec '"$INSTDIR\IconStudioApp.exe"'
 installcomplete:
 Goto finished
 rollback:
 Delete "$INSTDIR\IconStudioApp.exe"
 Rename "$INSTDIR\IconStudioApp.previous.exe" "$INSTDIR\IconStudioApp.exe"
 MessageBox MB_OK|MB_ICONSTOP "Installation failed. The previous executable was restored."
 Abort
 finished:
SectionEnd

Section "Uninstall"
 SetShellVarContext current
 SetRegView 64
 ReadRegStr $ResolveUtility HKCU "Software\Sakib\IconStudioApp" "ResolveUtilityFolder"
 Delete "$ResolveUtility\Icon Studio App.py"
 Delete "$ResolveUtility\_IconStudioAppConnector\bridge.py.txt"
 RMDir "$ResolveUtility\_IconStudioAppConnector"
 Delete "$DESKTOP\Icon Studio.lnk"
 Delete "$SMPROGRAMS\Icon Studio\Icon Studio.lnk"
 RMDir "$SMPROGRAMS\Icon Studio"
 Delete "$INSTDIR\IconStudioApp.exe"
 Delete "$INSTDIR\IconStudioApp.previous.exe"
 Delete "$INSTDIR\WebView2Loader.dll"
 Delete "$INSTDIR\app.ico"
 !include "uninstall-web.nsh"
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
 DeleteRegKey HKCU "Software\Sakib\IconStudioApp"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\IconStudioApp"
SectionEnd
