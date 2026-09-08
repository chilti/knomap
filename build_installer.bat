@echo off
setlocal enabledelayedexpansion

echo ==============================================
echo       COMPILADOR DE KNOMAP
echo ==============================================
echo.

:: Detectar Inno Setup Compiler (ISCC)
set "ISCC_PATH="
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if "!ISCC_PATH!"=="" if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"
if "!ISCC_PATH!"=="" for /f "delims=" %%i in ('where iscc 2^>nul') do set "ISCC_PATH=%%i"

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
if exist publish_win rmdir /s /q publish_win
if exist publish_linux rmdir /s /q publish_linux
if exist publish_mac_intel rmdir /s /q publish_mac_intel
if exist publish_mac_arm rmdir /s /q publish_mac_arm

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

set ROBOCOPY_EXCLUDE=/xd __pycache__ .venv venv temp /xf test_output.json test_*.json temp_test.json *.pyc

echo   - Creando empaquetado para Linux...
if exist Output\knoMap_Linux rmdir /s /q Output\knoMap_Linux
mkdir Output\knoMap_Linux
xcopy publish_linux\* Output\knoMap_Linux\ /s /e /y /q >nul
robocopy engine Output\knoMap_Linux\engine /s /e %ROBOCOPY_EXCLUDE% >nul
if exist .env.example copy .env.example Output\knoMap_Linux\.env.example >nul

powershell -Command "Out-File -FilePath 'Output\knoMap_Linux\setup_env.sh' -Encoding ascii -InputObject '#!/bin/bash`ncd \"`$(dirname \"`$0\")\"`necho \"==============================================\"`necho \"  Configurando entorno Python para knoMap     \"`necho \"==============================================\"`nif ! command -v python3 &> /dev/null; then`n    echo \"Error: python3 no esta instalado en el sistema.\"`n    exit 1`nfi`necho \"Creando entorno virtual (.venv)...\"`npython3 -m venv engine/.venv`necho \"Instalando dependencias de IA...\"`nengine/.venv/bin/pip install --upgrade pip`nengine/.venv/bin/pip install -r engine/requirements.txt`nchmod +x knoMap`necho \"Listo. Ya puedes ejecutar ./knoMap\"'"

powershell -Command "Out-File -FilePath 'Output\knoMap_Linux\INSTRUCCIONES_LINUX.txt' -Encoding utf8 -InputObject \"==============================================`nINSTRUCCIONES DE INSTALACION PARA LINUX`n==============================================`n`n1. Abre una terminal en esta carpeta.`n2. Ejecuta el instalador del entorno de Python:`n   chmod +x setup_env.sh knoMap`n   ./setup_env.sh`n`n3. (Opcional) Si usaras el Asistente IA, configura tus claves:`n   cp .env.example .env`n`n4. Inicia la aplicacion:`n   ./knoMap\""

timeout /t 3 /nobreak >nul
pushd Output\knoMap_Linux
tar -a -c -f ..\knoMap_Linux.zip *
popd

echo   - Creando empaquetado para Mac (Intel)...
if exist Output\knoMap_Mac_Intel rmdir /s /q Output\knoMap_Mac_Intel
mkdir Output\knoMap_Mac_Intel\knoMap.app\Contents\MacOS
mkdir Output\knoMap_Mac_Intel\knoMap.app\Contents\Resources
copy backend\src\LabSOM.Backend.Core\Info.plist Output\knoMap_Mac_Intel\knoMap.app\Contents\Info.plist >nul
xcopy publish_mac_intel\* Output\knoMap_Mac_Intel\knoMap.app\Contents\MacOS\ /s /e /y /q >nul
robocopy engine Output\knoMap_Mac_Intel\knoMap.app\Contents\MacOS\engine /s /e %ROBOCOPY_EXCLUDE% >nul
if exist .env.example copy .env.example Output\knoMap_Mac_Intel\.env.example >nul

powershell -Command "Out-File -FilePath 'Output\knoMap_Mac_Intel\setup_env.sh' -Encoding ascii -InputObject '#!/bin/bash`ncd \"`$(dirname \"`$0\")\"`necho \"==============================================\"`necho \"  Configurando entorno Python para knoMap (macOS)\"`necho \"==============================================\"`nif ! command -v python3 &> /dev/null; then`n    echo \"Error: python3 no esta instalado. Instálalo desde python.org o con brew install python3.\"`n    exit 1`nfi`necho \"Creando entorno virtual (.venv)...\"`npython3 -m venv knoMap.app/Contents/MacOS/engine/.venv`necho \"Instalando dependencias de IA...\"`nknoMap.app/Contents/MacOS/engine/.venv/bin/pip install --upgrade pip`nknoMap.app/Contents/MacOS/engine/.venv/bin/pip install -r knoMap.app/Contents/MacOS/engine/requirements.txt`nchmod +x knoMap.app/Contents/MacOS/knoMap`necho \"Listo. El entorno de knoMap esta configurado.\"'"

powershell -Command "Out-File -FilePath 'Output\knoMap_Mac_Intel\INSTRUCCIONES_MAC.txt' -Encoding utf8 -InputObject \"==============================================`nINSTRUCCIONES DE INSTALACION PARA MAC (Intel)`n==============================================`n`n1. Abre una terminal en esta carpeta.`n2. Configura los permisos y el entorno de Python ejecutando:`n   chmod +x setup_env.sh knoMap.app/Contents/MacOS/knoMap`n   ./setup_env.sh`n`n3. (Opcional) Si usaras el Asistente IA, configura tus claves:`n   cp .env.example .env`n`n4. Inicia la aplicacion haciendo doble clic en knoMap.app o ejecutando:`n   open knoMap.app\""

timeout /t 3 /nobreak >nul
pushd Output\knoMap_Mac_Intel
tar -a -c -f ..\knoMap_Mac_Intel.zip *
popd

echo   - Creando empaquetado para Mac (Apple Silicon)...
if exist Output\knoMap_Mac_Arm rmdir /s /q Output\knoMap_Mac_Arm
mkdir Output\knoMap_Mac_Arm\knoMap.app\Contents\MacOS
mkdir Output\knoMap_Mac_Arm\knoMap.app\Contents\Resources
copy backend\src\LabSOM.Backend.Core\Info.plist Output\knoMap_Mac_Arm\knoMap.app\Contents\Info.plist >nul
xcopy publish_mac_arm\* Output\knoMap_Mac_Arm\knoMap.app\Contents\MacOS\ /s /e /y /q >nul
robocopy engine Output\knoMap_Mac_Arm\knoMap.app\Contents\MacOS\engine /s /e %ROBOCOPY_EXCLUDE% >nul
if exist .env.example copy .env.example Output\knoMap_Mac_Arm\.env.example >nul

powershell -Command "Out-File -FilePath 'Output\knoMap_Mac_Arm\setup_env.sh' -Encoding ascii -InputObject '#!/bin/bash`ncd \"`$(dirname \"`$0\")\"`necho \"==============================================\"`necho \"  Configurando entorno Python para knoMap (macOS)\"`necho \"==============================================\"`nif ! command -v python3 &> /dev/null; then`n    echo \"Error: python3 no esta instalado. Instálalo desde python.org o con brew install python3.\"`n    exit 1`nfi`necho \"Creando entorno virtual (.venv)...\"`npython3 -m venv knoMap.app/Contents/MacOS/engine/.venv`necho \"Instalando dependencias de IA...\"`nknoMap.app/Contents/MacOS/engine/.venv/bin/pip install --upgrade pip`nknoMap.app/Contents/MacOS/engine/.venv/bin/pip install -r knoMap.app/Contents/MacOS/engine/requirements.txt`nchmod +x knoMap.app/Contents/MacOS/knoMap`necho \"Listo. El entorno de knoMap esta configurado.\"'"

powershell -Command "Out-File -FilePath 'Output\knoMap_Mac_Arm\INSTRUCCIONES_MAC.txt' -Encoding utf8 -InputObject \"==============================================`nINSTRUCCIONES DE INSTALACION PARA MAC (Apple Silicon)`n==============================================`n`n1. Abre una terminal en esta carpeta.`n2. Configura los permisos y el entorno de Python ejecutando:`n   chmod +x setup_env.sh knoMap.app/Contents/MacOS/knoMap`n   ./setup_env.sh`n`n3. (Opcional) Si usaras el Asistente IA, configura tus claves:`n   cp .env.example .env`n`n4. Inicia la aplicacion haciendo doble clic en knoMap.app o ejecutando:`n   open knoMap.app\""

timeout /t 3 /nobreak >nul
pushd Output\knoMap_Mac_Arm
tar -a -c -f ..\knoMap_Mac_Silicon.zip *
popd
echo.

echo [4/4] Empaquetando el Instalador de Windows (Inno Setup)...
if exist publish rmdir /s /q publish
move publish_win publish >nul
if exist .env.example copy .env.example publish\.env.example >nul

if "!ISCC_PATH!"=="" (
    echo [ADVERTENCIA] Inno Setup 6 [ISCC.exe] no fue detectado en el sistema.
    echo No se genero Output\knoMap_Installer_Lite.exe.
    echo Instala Inno Setup 6 para compilar el instalador ejecutable de Windows.
) else (
    echo Usando compilador Inno Setup: "!ISCC_PATH!"
    "!ISCC_PATH!" installer-lite.iss
    if !errorlevel! neq 0 (
        echo Error al crear el instalador de Windows.
        pause
        exit /b !errorlevel!
    )
)

:: Limpiar carpetas temporales
if exist publish rmdir /s /q publish
if exist publish_linux rmdir /s /q publish_linux
if exist publish_mac_intel rmdir /s /q publish_mac_intel
if exist publish_mac_arm rmdir /s /q publish_mac_arm
if exist Output\knoMap_Linux rmdir /s /q Output\knoMap_Linux
if exist Output\knoMap_Mac_Intel rmdir /s /q Output\knoMap_Mac_Intel
if exist Output\knoMap_Mac_Arm rmdir /s /q Output\knoMap_Mac_Arm
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
