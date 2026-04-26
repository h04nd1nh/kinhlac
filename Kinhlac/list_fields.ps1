$exePath = "c:\medicine\Kinhlac\Kinhlac.exe"
[Reflection.Assembly]::LoadFrom($exePath) | Out-Null
$type = [System.AppDomain]::CurrentDomain.GetAssemblies() | Where-Object { $_.Location -like "*Kinhlac.exe" } | ForEach-Object { $_.GetType("Kinhlac.KinhlacCore") } | Where-Object { $_ -ne $null }

if ($type) {
    Write-Output "Fields in $($type.FullName):"
    $fields = $type.GetFields([System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::NonPublic -bor [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::Static)
    foreach ($f in $fields) {
        Write-Output "  Field: $($f.Name) ($($f.FieldType.FullName))"
    }
}
