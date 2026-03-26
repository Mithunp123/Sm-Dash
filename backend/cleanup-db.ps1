#!/usr/bin/env pwsh

Write-Host "`n================================" -ForegroundColor Cyan
Write-Host "  DATABASE CLEANUP & RESET" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Check if database exists
$dbPath = "volunteer_system.db"

if (Test-Path $dbPath) {
    Write-Host "🗑️  Found old database: $dbPath" -ForegroundColor Yellow
    Write-Host "📦 Backing up database..." -ForegroundColor Blue
    
    # Create backup
    $backupPath = "volunteer_system.db.backup"
    Copy-Item $dbPath $backupPath -Force
    Write-Host "✅ Backup created: $backupPath" -ForegroundColor Green
    
    # Delete old database
    Write-Host "🔄 Deleting corrupted database..." -ForegroundColor Blue
    Remove-Item $dbPath -Force
    Write-Host "✅ Database deleted" -ForegroundColor Green
} else {
    Write-Host "ℹ️  No database found. Creating fresh..." -ForegroundColor Cyan
}

Write-Host "`n✅ ✅ ✅ DATABASE CLEANUP COMPLETE ✅ ✅ ✅" -ForegroundColor Green
Write-Host "`n📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Run: npm run start" -ForegroundColor White
Write-Host "2. Wait for initialization to complete" -ForegroundColor White
Write-Host "3. Try creating a folder again" -ForegroundColor White
Write-Host "`n"
