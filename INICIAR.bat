@echo off
chcp 65001 >nul
title Discord Share Clone
cd /d "%~dp0"

set "NODE=C:\Program Files\nodejs\node.exe"
set "NPM=C:\Program Files\nodejs\npm.cmd"

if not exist "%NODE%" (
    echo.
    echo  [ERRO] Node.js nao encontrado!
    echo  Baixe e instale: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo.
echo  ============================================
echo    Discord Share Clone
echo  ============================================
echo.

REM Instalar dependencias se necessario
if not exist "server\node_modules\" (
    echo  [1/3] Instalando servidor...
    cd server && call "%NPM%" install && cd ..
)

if not exist "client\node_modules\" (
    echo  [2/3] Instalando interface...
    cd client && call "%NPM%" install && cd ..
)

if not exist "client\dist\index.html" (
    echo  [3/3] Compilando interface...
    cd client && call "%NPM%" run build && cd ..
) else (
    echo  [OK] Tudo pronto!
)

echo.
echo  ============================================
echo    COMO USAR
echo  ============================================
echo.
echo  1. Este script inicia o servidor
echo  2. Abra no navegador:  http://localhost:3000
echo  3. Escolha modo HOST e clique Compartilhar Tela
echo.
echo  Outros PCs na mesma rede:
echo  - Abra http://SEU_IP:3000 no navegador deles
echo  - Escolha modo ESPECTADOR
echo.
echo  Seu IP local aparece abaixo quando o servidor iniciar.
echo  ============================================
echo.

cd server
"%NODE%" index.js
