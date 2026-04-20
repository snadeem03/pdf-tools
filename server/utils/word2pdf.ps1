param([string]$docPath, [string]$pdfPath)

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 'wdAlertsNone'
    
    # Open document
    $doc = $word.Documents.Open($docPath, $false, $true) # ReadOnly = true
    
    # Save as PDF (Format 17 = wdFormatPDF)
    $doc.SaveAs([ref]$pdfPath, [ref]17)
    
    $doc.Close($false)
    Write-Output "Success"
} catch {
    Write-Error $_.Exception.Message
    exit 1
} finally {
    if ($word) {
        $word.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    # Force garbage collection
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
