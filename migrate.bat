@echo off
echo PostgreSQL Database Migration Tool
echo ====================================
echo.

REM Check if Python is installed
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if required packages are installed
python -c "import psycopg2, dotenv" > nul 2>&1
if %errorlevel% neq 0 (
    echo Installing required packages...
    pip install psycopg2-binary python-dotenv
)

REM Run the migration script with arguments
python migrate_database.py %*

if %errorlevel% neq 0 (
    echo Migration failed with error code %errorlevel%
    pause
    exit /b %errorlevel%
)

echo.
echo Migration completed successfully!
pause 