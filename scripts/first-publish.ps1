# Interactive first publish + trusted publisher setup (requires browser 2FA).
# New @lofcz/tinysheet-* packages: publish first (creates ownership), then trust.
# Run from repo root in a normal terminal:
#   powershell -ExecutionPolicy Bypass -File .\scripts\first-publish.ps1
#
# Prerequisites:
#   - logged in as lofcz (`npm whoami`)
#   - GitHub repo renamed/available as lofcz/tinysheet
#   - `bun run build` already succeeded (dist present)

$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$repo = "lofcz/tinysheet"
$workflow = "release.yml"

$packages = @(
  @{ Name = "@lofcz/tinysheet-formula-parser"; Dir = "packages/formula-parser" },
  @{ Name = "@lofcz/tinysheet-core"; Dir = "packages/core" },
  @{ Name = "@lofcz/tinysheet-react"; Dir = "packages/react" },
  @{ Name = "@lofcz/tinysheet-excel"; Dir = "packages/excel" }
)

Write-Host "==> Building" -ForegroundColor Cyan
bun run build

foreach ($pkg in $packages) {
  $ver = (Get-Content (Join-Path $pkg.Dir "package.json") | ConvertFrom-Json).version
  Write-Host "==> Publish $($pkg.Name)@$ver" -ForegroundColor Cyan
  Push-Location $pkg.Dir
  npm publish --access public
  Pop-Location
}

foreach ($pkg in $packages) {
  Write-Host "==> Trusted publisher: $($pkg.Name)" -ForegroundColor Cyan
  npm trust github $pkg.Name --file $workflow --repo $repo --allow-publish -y
}

Write-Host "==> Deprecate old @lofcz/prospera-sheet-* names (optional)" -ForegroundColor Cyan
$msg = "Package renamed to @lofcz/tinysheet-*. Use @lofcz/tinysheet-core / @lofcz/tinysheet-react / @lofcz/tinysheet-excel."
try { npm deprecate "@lofcz/prospera-sheet-core" $msg } catch { Write-Warning $_ }
try { npm deprecate "@lofcz/prospera-sheet-react" $msg } catch { Write-Warning $_ }
try { npm deprecate "@lofcz/prospera-sheet-excel" $msg } catch { Write-Warning $_ }

Write-Host "Done. Verify:" -ForegroundColor Green
foreach ($pkg in $packages) {
  Write-Host "  npm view $($pkg.Name) version"
  Write-Host "  npm trust list $($pkg.Name)"
}
