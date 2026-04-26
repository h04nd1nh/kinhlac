$exePath = "c:\medicine\Kinhlac\Kinhlac.exe"
[Reflection.Assembly]::LoadFrom($exePath) | Out-Null
$types = [System.AppDomain]::CurrentDomain.GetAssemblies() | Where-Object { $_.Location -like "*Kinhlac.exe" } | ForEach-Object { $_.GetTypes() }
foreach ($t in $types) {
    Write-Output $t.FullName
}
