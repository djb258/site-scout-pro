# Doppler Global Setup Script
# Run this in PowerShell to complete Doppler setup

Write-Host "Doppler Global Setup" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green
Write-Host ""

# Add ~/bin to PATH if not already present
$binPath = "$env:USERPROFILE\bin"
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")

if ($currentPath -notlike "*$binPath*") {
    Write-Host "Adding $binPath to PATH..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("Path", "$binPath;$currentPath", "User")
    $env:Path = "$binPath;$env:Path"
    Write-Host "[OK] Added to PATH" -ForegroundColor Green
} else {
    Write-Host "[OK] $binPath already in PATH" -ForegroundColor Green
}

# Check if doppler is accessible
$dopplerPath = "$binPath\doppler.exe"
if (Test-Path $dopplerPath) {
    Write-Host "[OK] Doppler CLI found at $dopplerPath" -ForegroundColor Green
    & $dopplerPath --version
} else {
    Write-Host "[ERROR] Doppler CLI not found. Please run the install script first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 1: Login to Doppler" -ForegroundColor Cyan
Write-Host "------------------------" -ForegroundColor Cyan
Write-Host "This will open a browser window for authentication..."
Write-Host ""

# Run doppler login
& $dopplerPath login

Write-Host ""
Write-Host "Step 2: Configure Global Scope" -ForegroundColor Cyan
Write-Host "-------------------------------" -ForegroundColor Cyan

# Set global scope
& $dopplerPath configure set scope global
Write-Host "[OK] Doppler configured with global scope" -ForegroundColor Green

Write-Host ""
Write-Host "Doppler Global Setup Complete!" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now use Doppler in any repository:" -ForegroundColor Yellow
Write-Host "  doppler setup          # Link a project to a repo"
Write-Host "  doppler secrets        # View secrets"
Write-Host "  doppler run -- cmd     # Run command with secrets"
Write-Host ""
Write-Host "To create a new project:"
Write-Host "  doppler projects create my-project"
Write-Host ""
