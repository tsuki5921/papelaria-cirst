@echo off
chcp 65001 >nul
title Papelaria Crista
cd /d "%~dp0"

echo.
echo  Papelaria Crista - preparando...
echo.

set PY=
where py >nul 2>nul && set PY=py
if not defined PY ( where python >nul 2>nul && set PY=python )
if not defined PY (
  echo  [ERRO] Python nao encontrado.
  echo  Instale em https://www.python.org/downloads/  ^(marque "Add python.exe to PATH"^)
  echo  e depois rode este arquivo de novo.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo  Criando ambiente Python ^(so na primeira vez^)...
  %PY% -m venv .venv || goto erro
)

echo  Instalando/conferindo dependencias...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r requirements.txt || goto erro

".venv\Scripts\python.exe" run.py %*
echo.
echo  A loja foi encerrada.
pause
exit /b 0

:erro
echo.
echo  [ERRO] Algo deu errado. Copie as mensagens acima e envie para o suporte.
pause
exit /b 1
