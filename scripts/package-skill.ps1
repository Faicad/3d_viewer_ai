param(
    [string]$OutputDir = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
$srcDir = (Resolve-Path (Join-Path $PSScriptRoot ".." "skills" "3d_viewer")).Path
$OutputDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputDir)

Add-Type -AssemblyName System.IO.Compression.FileSystem

$excludePatterns = @(
    'env\*',
    'tests\*',
    'test.mjs',
    'playwright.config.ts',
    'tests\smoke-test.mjs',
    'wasm\*',
    'favicon.ico',
    'models\*'
)

$allFiles = Get-ChildItem $srcDir -Recurse -File

function Write-Zip($files, $outputPath, $renameMap) {
    Write-Host "Packaging $($files.Count) files to $outputPath ..."
    if (Test-Path $outputPath) { Remove-Item $outputPath -Force }
    $zip = [System.IO.Compression.ZipFile]::Open($outputPath, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            $rel = $file.FullName.Substring($srcDir.Length + 1)
            if ($renameMap.ContainsKey($rel)) {
                $rel = $renameMap[$rel]
            }
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $rel, [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally {
        $zip.Dispose()
    }
    Write-Host "Done: $outputPath"
}

# --- English package ---
$enFiles = $allFiles | Where-Object {
    $rel = $_.FullName.Substring($srcDir.Length + 1)
    $rel -notlike 'SKILL_cn.md' -and
    -not ($excludePatterns | Where-Object { $rel -like $_ })
}
$enOutput = Join-Path $OutputDir "3d_viewer_skill_en.zip"
Write-Zip $enFiles $enOutput @{}

# --- Chinese package ---
$cnFiles = $allFiles | Where-Object {
    $rel = $_.FullName.Substring($srcDir.Length + 1)
    -not ($excludePatterns | Where-Object { $rel -like $_ })
}
$cnOutput = Join-Path $OutputDir "3d_viewer_skill_cn.zip"
$renameMap = @{
    'SKILL.md' = 'SKILL_en.md'
    'SKILL_cn.md' = 'SKILL.md'
}
Write-Zip $cnFiles $cnOutput $renameMap
