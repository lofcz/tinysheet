# Interactive first publish + trusted publisher setup (requires browser 2FA).
# New packages under @lofcz: publish first (creates ownership), then trust.
# Run from repo root in a normal terminal:
#   powershell -ExecutionPolicy Bypass -File .\scripts\first-publish.ps1

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$coreVer = (Get-Content packages/core/package.json | ConvertFrom-Json).version
$reactVer = (Get-Content packages/react/package.json | ConvertFrom-Json).version

Write-Host "==> Publish @lofcz/prospera-sheet-core@$coreVer" -ForegroundColor Cyan
Push-Location packages/core
npm publish --access public
Pop-Location

Write-Host "==> Publish @lofcz/prospera-sheet-react@$reactVer" -ForegroundColor Cyan
Push-Location packages/react
npm publish --access public
Pop-Location

Write-Host "==> Trusted publisher: @lofcz/prospera-sheet-core" -ForegroundColor Cyan
npm trust github @lofcz/prospera-sheet-core --file release.yml --repo lofcz/prospera-sheet --allow-publish -y

Write-Host "==> Trusted publisher: @lofcz/prospera-sheet-react" -ForegroundColor Cyan
npm trust github @lofcz/prospera-sheet-react --file release.yml --repo lofcz/prospera-sheet --allow-publish -y

Write-Host "Done. Verify:" -ForegroundColor Green
Write-Host "  npm view @lofcz/prospera-sheet-core version"
Write-Host "  npm view @lofcz/prospera-sheet-react version"
