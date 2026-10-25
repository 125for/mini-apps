@echo off
rem Mini Apps desktop launcher build script (ASCII only).
rem Uses the .NET Framework compiler bundled with Windows - no installation needed.
rem App launchers with Chinese names are created by MiniApps.exe itself (--make-launchers).
setlocal

set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo [error] csc.exe not found
  exit /b 1
)

pushd "%~dp0"
"%CSC%" /nologo /target:winexe /codepage:65001 /optimize+ /out:MiniApps.exe src\Launcher.cs
if errorlevel 1 ( popd & exit /b 1 )
popd

"%~dp0MiniApps.exe" --make-launchers
if errorlevel 1 exit /b 1
echo [ok] desktop launchers built
endlocal
