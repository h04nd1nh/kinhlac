$exePath = "c:\medicine\Kinhlac\Kinhlac.exe"
[Reflection.Assembly]::LoadFrom($exePath) | Out-Null
$type = [System.AppDomain]::CurrentDomain.GetAssemblies() | Where-Object { $_.Location -like "*Kinhlac.exe" } | ForEach-Object { $_.GetType("Kinhlac.KinhlacCore") } | Where-Object { $_ -ne $null }

if ($type) {
    Write-Output "Properties in $($type.FullName):"
    $props = $type.GetProperties([System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::NonPublic -bor [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::Static)
    foreach ($p in $props) {
        Write-Output "  Property: $($p.Name) ($($p.PropertyType.FullName))"
    }
}
