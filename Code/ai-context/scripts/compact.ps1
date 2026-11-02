#Requires -Version 5.1
<#
  compact.ps1 — prune CHANGELOG + sinh RESUME.md

  Dùng:
    pwsh -File ai-context/scripts/compact.ps1            # prune + sinh RESUME
    pwsh -File ai-context/scripts/compact.ps1 -Keep 20   # giữ 20 mục CHANGELOG
    pwsh -File ai-context/scripts/compact.ps1 -CheckOnly # chỉ báo cáo, không ghi gì
#>
[CmdletBinding()]
param(
  [int]$Keep = 15,
  [int]$ResumeLog = 8,
  [int]$MaxResumeLines = 200,
  [int]$WarnLines = 120,
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$ctx = Split-Path -Parent $PSScriptRoot
$archive = Join-Path $ctx 'archive'
if (-not (Test-Path $archive)) { New-Item -ItemType Directory -Path $archive | Out-Null }

function Get-Sections([string[]]$lines) {
  $entries = New-Object System.Collections.Generic.List[object]
  $current = $null
  foreach ($line in $lines) {
    if ($line -match '^##\s+') {
      if ($current) { $entries.Add($current) }
      $current = [pscustomobject]@{
        Title = $line
        Body  = New-Object System.Collections.Generic.List[string]
      }
    }
    elseif ($null -ne $current) { $current.Body.Add($line) }
  }
  if ($current) { $entries.Add($current) }
  return $entries
}

# ---- 1) Prune CHANGELOG ----
$logPath = Join-Path $ctx 'CHANGELOG.md'
$entries = @(Get-Sections (Get-Content -LiteralPath $logPath -Encoding UTF8))
Write-Host "CHANGELOG: $($entries.Count) muc hien tai, Keep=$Keep"

if ($entries.Count -gt $Keep -and -not $CheckOnly) {
  $overflow = @($entries | Select-Object -Skip $Keep)
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $arcPath = Join-Path $archive "changelog-$stamp.md"

  $buf = @("# CHANGELOG archive $stamp", "", "> Duoc sinh boi compact.ps1. AI khong doc thu muc archive/.", "")
  foreach ($e in $overflow) { $buf += $e.Title; $buf += $e.Body; $buf += "" }
  Set-Content -LiteralPath $arcPath -Value $buf -Encoding UTF8

  $kept = @($entries | Select-Object -First $Keep)
  $out = @(
    '# CHANGELOG — nhat ky phien (moi nhat o tren)',
    '',
    '> Prune: `pwsh -File ai-context/scripts/compact.ps1`. Archive: `archive/changelog-*.md`',
    ''
  )
  foreach ($e in $kept) { $out += $e.Title; $out += $e.Body; $out += '' }
  Set-Content -LiteralPath $logPath -Value $out -Encoding UTF8
  Write-Host "  -> da prune $($overflow.Count) muc cu sang $arcPath"
}
else {
  Write-Host '  -> khong prune'
}

# ---- 2) Canh bao file phinh to ----
foreach ($name in 'MEMORY.md', 'STATE.md', 'REQUIREMENTS.md', 'RULES.md') {
  $p = Join-Path $ctx $name
  if (Test-Path $p) {
    $n = (Get-Content -LiteralPath $p -Encoding UTF8).Count
    $flag = if ($n -gt $WarnLines) { ' [QUA DAI - xem RULES.md]' } else { '' }
    Write-Host ("  {0,-18} {1,4} dong{2}" -f $name, $n, $flag)
  }
}

# ---- 3) Sinh RESUME.md ----
$entries = @(Get-Sections (Get-Content -LiteralPath $logPath -Encoding UTF8))
$resumeLogCount = [Math]::Min($ResumeLog, $entries.Count)
do {
  $latest = @($entries | Select-Object -First $resumeLogCount)
  $resume = @(
    '<!-- TU DONG SINH BOI ai-context/scripts/compact.ps1 - KHONG EDIT TAY -->',
    '',
    '# RESUME.md - context compact dau moi phien',
    '',
    'AI: doc het file nay truoc khi bat dau. Khong quet .pio/ hay .vscode/.',
    'Can chi tiet hon? Mo file nguon tuong ung duoc link duoi day.',
    '',
    '---',
    ''
  )
  foreach ($name in 'MEMORY.md', 'STATE.md', 'REQUIREMENTS.md', 'RULES.md') {
    $p = Join-Path $ctx $name
    $resume += "## [$name]"
    $resume += ''
    if (Test-Path $p) {
      $resume += (Get-Content -LiteralPath $p -Encoding UTF8 | Where-Object { $_ -notmatch '^#\s' })
    }
    else {
      $resume += "(thieu file $name)"
    }
    $resume += ''
    $resume += '---'
    $resume += ''
  }
  if ($resumeLogCount -gt 0) {
    $resume += "## [CHANGELOG - $resumeLogCount muc moi nhat]"
    $resume += ''
    foreach ($e in $latest) { $resume += $e.Title; $resume += $e.Body; $resume += '' }
  }
  $compactResume = New-Object System.Collections.Generic.List[string]
  $previousBlank = $false
  foreach ($line in $resume) {
    $isBlank = [string]::IsNullOrWhiteSpace($line)
    if (-not ($isBlank -and $previousBlank)) { $compactResume.Add($line) }
    $previousBlank = $isBlank
  }
  $resume = @($compactResume)
  if ($resume.Count -gt $MaxResumeLines -and $resumeLogCount -gt 0) { $resumeLogCount-- }
} while ($resume.Count -gt $MaxResumeLines -and $resumeLogCount -ge 0)

if ($resume.Count -gt $MaxResumeLines) {
  throw "RESUME.md co $($resume.Count) dong truoc khi them changelog; vuot MaxResumeLines=$MaxResumeLines. Hay rut gon cac file context nguon ma khong xoa TODO hoac thong tin bat buoc."
}

$resumePath = Join-Path $ctx 'RESUME.md'
if ($CheckOnly) {
  Write-Host "CheckOnly: se sinh RESUME.md ($($resume.Count)/$MaxResumeLines dong, $resumeLogCount muc changelog)"
}
else {
  Set-Content -LiteralPath $resumePath -Value $resume -Encoding UTF8
  Write-Host "Da sinh RESUME.md ($($resume.Count)/$MaxResumeLines dong, $resumeLogCount muc changelog)"
}
