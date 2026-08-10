@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo       COMPILADOR DE KNOMAP
echo ==============================================
echo.

echo [1/4] Compilando la Interfaz (Frontend)...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo Error al compilar el frontend.
    pause
    exit /b %errorlevel%
)
cd ..
echo.

echo [2/4] Compilando el Motor (Backend) para Windows, Linux y Mac...
cd backend\src\LabSOM.Backend.Core

echo   - Compilando para Windows...
dotnet publish -c Release -r win-x64 --self-contained true -o ..\..\..\publish_win
if %errorlevel% neq 0 exit /b %errorlevel%

echo   - Compilando para Linux...
dotnet publish -c Release -r linux-x64 --self-contained true -o ..\..\..\publish_linux
if %errorlevel% neq 0 exit /b %errorlevel%

echo   - Compilando para Mac (Intel)...
dotnet publish -c Release -r osx-x64 --self-contained true -o ..\..\..\publish_mac_intel
if %errorlevel% neq 0 exit /b %errorlevel%

echo   - Compilando para Mac (Apple Silicon / ARM64)...
dotnet publish -c Release -r osx-arm64 --self-contained true -o ..\..\..\publish_mac_arm
if %errorlevel% neq 0 exit /b %errorlevel%

cd ..\..\..\
echo.

echo [3/4] Empaquetando para Linux y Mac (.zip)...
if not exist Output mkdir Output

echo   - Creando empaquetado para Linux...
if exist Output\knoMap_Linux rmdir /s /q Output\knoMap_Linux
mkdir Output\knoMap_Linux
xcopy publish_linux\* Output\knoMap_Linux\ /s /e /y /q >nul
robocopy engine Output\knoMap_Linux\engine /s /e /xd __pycache__ .venv venv temp >nul
timeout /t 5 /nobreak >nul
pushd Output\knoMap_Linux
tar -a -c -f ..\knoMap_Linux.zip *
popd

echo   - Creando empaquetado para Mac (Intel)...
if exist Output\knoMap_Mac_Intel rmdir /s /q Output\knoMap_Mac_Intel
mkdir Output\knoMap_Mac_Intel\knoMap.app\Contents\MacOS
mkdir Output\knoMap_Mac_Intel\knoMap.app\Contents\Resources
copy backend\src\LabSOM.Backend.Core\Info.plist Output\knoMap_Mac_Intel\knoMap.app\Contents\Info.plist >nul
xcopy publish_mac_intel\* Output\knoMap_Mac_Intel\knoMap.app\Contents\MacOS\ /s /e /y /q >nul
robocopy engine Output\knoMap_Mac_Intel\knoMap.app\Contents\MacOS\engine /s /e /xd __pycache__ .venv venv temp >nul
powershell -Command "Out-File -FilePath 'Output\knoMap_Mac_Intel\INSTRUCCIONES_MAC.txt' -Encoding utf8 -InputObject \"==============================================`nINSTRUCCIONES DE INSTALACION PARA MAC`n==============================================`n`nDado que la aplicacion se ha comprimido en formato ZIP, macOS puede revocar el permiso de ejecucion.`nSi al abrir 'knoMap' aparece un mensaje indicando que esta danada o no se puede abrir,`nabre la Terminal en esta carpeta y ejecuta:`n`nchmod +x knoMap.app/Contents/MacOS/knoMap`n`nLuego podras abrirla normalmente haciendo doble clic en el icono.\""
timeout /t 5 /nobreak >nul
pushd Output\knoMap_Mac_Intel
tar -a -c -f ..\knoMap_Mac_Intel.zip *
popd

echo   - Creando empaquetado para Mac (Apple Silicon)...
if exist Output\knoMap_Mac_Arm rmdir /s /q Output\knoMap_Mac_Arm
mkdir Output\knoMap_Mac_Arm\knoMap.app\Contents\MacOS
mkdir Output\knoMap_Mac_Arm\knoMap.app\Contents\Resources
copy backend\src\LabSOM.Backend.Core\Info.plist Output\knoMap_Mac_Arm\knoMap.app\Contents\Info.plist >nul
xcopy publish_mac_arm\* Output\knoMap_Mac_Arm\knoMap.app\Contents\MacOS\ /s /e /y /q >nul
robocopy engine Output\knoMap_Mac_Arm\knoMap.app\Contents\MacOS\engine /s /e /xd __pycache__ .venv venv temp >nul
powershell -Command "Out-File -FilePath 'Output\knoMap_Mac_Arm\INSTRUCCIONES_MAC.txt' -Encoding utf8 -InputObject \"==============================================`nINSTRUCCIONES DE INSTALACION PARA MAC`n==============================================`n`nDado que la aplicacion se ha comprimido en formato ZIP, macOS puede revocar el permiso de ejecucion.`nSi al abrir 'knoMap' aparece un mensaje indicando que esta danada o no se puede abrir,`nabre la Terminal en esta carpeta y ejecuta:`n`nchmod +x knoMap.app/Contents/MacOS/knoMap`n`nLuego podras abrirla normalmente haciendo doble clic en el icono.\""
timeout /t 5 /nobreak >nul
pushd Output\knoMap_Mac_Arm
tar -a -c -f ..\knoMap_Mac_Silicon.zip *
popd
echo.

echo [4/4] Empaquetando el Instalador de Windows (Inno Setup)...
if exist publish rmdir /s /q publish
move publish_win publish >nul

"C:\Program Files (x86)\Inno Setup 6\ISCC.exe" installer-lite.iss
if %errorlevel% neq 0 (
    echo Error al crear el instalador de Windows.
    pause
    exit /b %errorlevel%
)

:: Limpiar carpetas temporales
rmdir /s /q publish
rmdir /s /q publish_linux
rmdir /s /q publish_mac_intel
rmdir /s /q publish_mac_arm
rmdir /s /q Output\knoMap_Linux
rmdir /s /q Output\knoMap_Mac_Intel
rmdir /s /q Output\knoMap_Mac_Arm
echo.

echo ==============================================
echo  EXITO: Paquetes compilados correctamente.
echo  Rutas:
echo   - Windows: Output\knoMap_Installer_Lite.exe
echo   - Linux:   Output\knoMap_Linux.zip
echo   - Mac (Intel):   Output\knoMap_Mac_Intel.zip
echo   - Mac (Silicon): Output\knoMap_Mac_Silicon.zip
echo ==============================================
pause
