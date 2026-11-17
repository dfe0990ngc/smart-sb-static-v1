@echo off
setlocal
cd /d "%~dp0"

rem Secrets live in secrets.bat (copy secrets.bat.example). Keep it out of git.
if exist secrets.bat call secrets.bat

rem Set this to your PAPERLESS-NGX address (not Directus).
if not defined PAPERLESS_URL set PAPERLESS_URL=http://192.168.1.47:8000
if not defined CLAUDE_MODEL set CLAUDE_MODEL=claude-sonnet-5-5
if not defined GEMINI_MODEL set GEMINI_MODEL=gemini-3.8-flash
rem auto = Claude first, Gemini fallback | claude | gemini
if not defined LLM_PROVIDER set LLM_PROVIDER=auto

if not defined PAPERLESS_TOKEN (
  echo Missing PAPERLESS_TOKEN - set it in secrets.bat
  exit /b 1
)
if not defined ANTHROPIC_API_KEY if not defined GEMINI_API_KEY (
  echo Set ANTHROPIC_API_KEY and/or GEMINI_API_KEY in secrets.bat
  exit /b 1
)

rem Usage: document-ai.bat --once ^| --interval 60 ^| --id 12345 --dry-run
python paperless_ai_agent.py %*
endlocal
