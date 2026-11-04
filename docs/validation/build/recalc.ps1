# Open the workbook in Excel, recalculate every formula and save, so the expected values are stored in the file.
param([string]$Path)
$full = (Resolve-Path $Path).Path
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
function Retry($block) { for ($i = 0; $i -lt 90; $i++) { try { return & $block } catch { Start-Sleep -Milliseconds 1000 } } throw 'Excel stayed busy' }
try {
  $wb = Retry { $xl.Workbooks.Open($full, 0, $false) }
  Retry { $xl.CalculateFull() } | Out-Null
  Retry { $wb.Worksheets.Item(1).Activate() } | Out-Null
  Retry { $wb.Save() } | Out-Null
  Retry { $wb.Close($true) } | Out-Null
  'saved'
} finally {
  $xl.Quit()
  [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null
}
