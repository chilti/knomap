[Setup]
AppName=knoMap
AppVersion=1.0.0
DefaultDirName={localappdata}\knoMap
DefaultGroupName=knoMap
OutputDir=Output
OutputBaseFilename=knoMap_Installer_Lite
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
SetupIconFile=frontend\public\icon.ico
UninstallDisplayIcon={app}\knoMap.exe
WizardImageFile=wizard_large.bmp
WizardSmallImageFile=wizard_small.bmp

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; C# Photino Application files
Source: "publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Python Engine scripts
Source: "engine\*"; DestDir: "{app}\engine"; Excludes: "__pycache__\, .venv\, venv\, temp\"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\knoMap"; Filename: "{app}\knoMap.exe"
Name: "{autodesktop}\knoMap"; Filename: "{app}\knoMap.exe"; Tasks: desktopicon

[Code]
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  // Check if Python is installed
  if not Exec('cmd.exe', '/c python --version', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
  begin
    MsgBox('Python no fue encontrado en el sistema. knoMap requiere Python para procesar algoritmos de IA. Por favor, instala Python 3 y marca la opcion "Add Python to PATH" durante la instalacion.', mbCriticalError, MB_OK);
    Result := False;
    Exit;
  end;
  Result := True;
end;

[Run]
; Install Python requirements automatically upon finish
Filename: "python.exe"; Parameters: "-m pip install -r ""{app}\engine\requirements.txt"""; Description: "Installing AI dependencies (Python)"; Flags: postinstall waituntilterminated
Filename: "{app}\knoMap.exe"; Description: "{cm:LaunchProgram,knoMap}"; Flags: nowait postinstall skipifsilent
