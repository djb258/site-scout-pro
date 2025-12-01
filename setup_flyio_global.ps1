# Fly.io Global Setup Script
# Run this in PowerShell to install and configure Fly.io CLI globally

Write-Host "Fly.io Global Setup" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host ""

# Create bin directory if needed
$binPath = "$env:USERPROFILE\bin"
if (-not (Test-Path $binPath)) {
    New-Item -ItemType Directory -Path $binPath -Force | Out-Null
    Write-Host "[OK] Created $binPath" -ForegroundColor Green
}

# Add to PATH if not already present
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$binPath*") {
    Write-Host "Adding $binPath to PATH..." -ForegroundColor Yellow
    [Environment]::SetEnvironmentVariable("Path", "$binPath;$currentPath", "User")
    $env:Path = "$binPath;$env:Path"
    Write-Host "[OK] Added to PATH" -ForegroundColor Green
} else {
    Write-Host "[OK] $binPath already in PATH" -ForegroundColor Green
}

# Download flyctl
Write-Host ""
Write-Host "Downloading Fly.io CLI..." -ForegroundColor Cyan

$flyctlPath = "$binPath\flyctl.exe"
$downloadUrl = "https://fly.io/install.ps1"

try {
    # Use the official Fly.io PowerShell installer
    $installScript = Invoke-WebRequest -Uri $downloadUrl -UseBasicParsing
    
    # Set install location
    $env:FLYCTL_INSTALL = "$env:USERPROFILE\.fly"
    
    # Run the install script
    Invoke-Expression $installScript.Content
    
    # Copy to bin folder for global access
    $flySource = "$env:USERPROFILE\.fly\bin\flyctl.exe"
    if (Test-Path $flySource) {
        Copy-Item $flySource $flyctlPath -Force
        Write-Host "[OK] Fly.io CLI installed to $flyctlPath" -ForegroundColor Green
    }
} catch {
    Write-Host "[ERROR] Failed to download: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Install manually using:" -ForegroundColor Yellow
    Write-Host "  iwr https://fly.io/install.ps1 -useb | iex"
    exit 1
}

# Verify installation
Write-Host ""
if (Test-Path $flyctlPath) {
    Write-Host "[OK] Fly.io CLI installed" -ForegroundColor Green
    & $flyctlPath version
} elseif (Test-Path "$env:USERPROFILE\.fly\bin\flyctl.exe") {
    Write-Host "[OK] Fly.io CLI installed to ~/.fly/bin" -ForegroundColor Green
    & "$env:USERPROFILE\.fly\bin\flyctl.exe" version
    
    # Add .fly\bin to PATH
    $flyBinPath = "$env:USERPROFILE\.fly\bin"
    if ($currentPath -notlike "*$flyBinPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$flyBinPath;$currentPath", "User")
        $env:Path = "$flyBinPath;$env:Path"
        Write-Host "[OK] Added $flyBinPath to PATH" -ForegroundColor Green
    }
} else {
    Write-Host "[ERROR] Installation failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 1: Login to Fly.io" -ForegroundColor Cyan
Write-Host "-----------------------" -ForegroundColor Cyan
Write-Host "This will open a browser for authentication..."
Write-Host ""

# Determine which path has flyctl
if (Test-Path $flyctlPath) {
    & $flyctlPath auth login
} else {
    & "$env:USERPROFILE\.fly\bin\flyctl.exe" auth login
}

Write-Host ""
Write-Host "Fly.io Global Setup Complete!" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""
Write-Host "You can now use Fly.io in any repository:" -ForegroundColor Yellow
Write-Host "  fly launch       # Create a new app"
Write-Host "  fly deploy       # Deploy your app"
Write-Host "  fly status       # Check app status"
Write-Host "  fly logs         # View logs"
Write-Host ""
Write-Host "Fly.io commands work globally from any directory."
Write-Host ""

