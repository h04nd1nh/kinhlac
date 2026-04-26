@echo off
title KINH LAC - BO CAI TUONG THICH 64-BIT (SIEU ON DINH)
echo ...........................................................
echo   DANG THIET LAP PHAN MEM KINH LAC CHO WINDOWS 64-BIT
echo ...........................................................
echo.

:: Kiem tra quyen Admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] LOI: Ban phai chuot phai vao file nay va chon 'Run as Administrator'.
    pause
    exit /b
)

echo [1/3] Dang ky trinh dieu khien Database OLEDB...
C:\Windows\SysWOW64\regsvr32.exe /s C:\Windows\SysWOW64\msjetoledb40.dll
C:\Windows\SysWOW64\regsvr32.exe /s C:\Windows\SysWOW64\msjet40.dll

echo [2/3] Kich hoat moi truong Legacy JIT (De dứt điểm lỗi Invalid Program)...
reg add "HKLM\SOFTWARE\Microsoft\.NETFramework" /v "useLegacyJit" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SOFTWARE\WOW6432Node\Microsoft\.NETFramework" /v "useLegacyJit" /t REG_DWORD /d 1 /f >nul 2>&1

echo [3/3] Thiet lap quyen chay cho Loader...
set "APP_PATH=%~dp0KinhLac_32bit_Loader.exe"
reg add "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\AppCompatFlags\Layers" /v "%APP_PATH%" /t REG_SZ /d "~ RUNASADMIN" /f >nul 2>&1

echo.
echo ...........................................................
echo   DA CAU HINH XONG! 
echo   BAY GIO BAN HAY KHOI DONG LAI MAY TINH (Bat buoc)
echo   DE CUNG CO MOI TRUONG ON DINH NHAT.
echo   SAU DO MO PHAN MEM BANG FILE: KinhLac_32bit_Loader.exe
echo ...........................................................
pause
