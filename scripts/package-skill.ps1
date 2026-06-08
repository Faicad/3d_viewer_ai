param(
    [string]$OutputPath = (Join-Path (Split-Path $PSScriptRoot -Parent) "3d_viewer_skill.zip")
)

$ErrorActionPreference = 'Stop'
$srcDir = (Resolve-Path (Join-Path $PSScriptRoot ".." "skills" "3d_viewer")).Path
$OutputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)

$excludePatterns = @(
    'env\*',
    'tests\*',
    'test.mjs',
    'playwright.config.ts',
    'scripts\smoke-test.mjs',
    'wasm\occt-import-js.cjs',
    'wasm\occt-import-js.wasm'
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$files = Get-ChildItem $srcDir -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($srcDir.Length + 1)
    -not ($excludePatterns | Where-Object { $rel -like $_ })
}

Write-Host "Packaging $($files.Count) files to $OutputPath ..."

if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }
$zip = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    foreach ($file in $files) {
        $rel = $file.FullName.Substring($srcDir.Length + 1)
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally {
    $zip.Dispose()
}

Write-Host "Done: $OutputPath"
