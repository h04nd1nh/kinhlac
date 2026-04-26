$exePath = "c:\medicine\Kinhlac\Kinhlac.exe"
if (!(Test-Path $exePath)) { Write-Output "Not found"; exit }

[Reflection.Assembly]::LoadFrom($exePath) | Out-Null

$types = [System.AppDomain]::CurrentDomain.GetAssemblies() | Where-Object { $_.Location -like "*Kinhlac.exe" } | ForEach-Object { $_.GetTypes() }

foreach ($t in $types) {
    if ($t.FullName -match "Diagnosis|Calc|Logic|Formula|Main") {
        Write-Output "Type: $($t.FullName)"
        $methods = $t.GetMethods([System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::NonPublic -bor [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::Static)
        foreach ($m in $methods) {
            if ($m.DeclaringType.FullName -eq $t.FullName) {
                Write-Output "  Method: $($m.Name)"
            }
        }
    }
}
