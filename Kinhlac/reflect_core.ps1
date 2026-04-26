$exePath = "c:\medicine\Kinhlac\Kinhlac.exe"
[Reflection.Assembly]::LoadFrom($exePath) | Out-Null
$type = [System.AppDomain]::CurrentDomain.GetAssemblies() | Where-Object { $_.Location -like "*Kinhlac.exe" } | ForEach-Object { $_.GetType("Kinhlac.KinhlacCore") } | Where-Object { $_ -ne $null }

if ($type) {
    Write-Output "Type: $($type.FullName)"
    $methods = $type.GetMethods([System.Reflection.BindingFlags]::Public -bor [System.Reflection.BindingFlags]::NonPublic -bor [System.Reflection.BindingFlags]::Instance -bor [System.Reflection.BindingFlags]::Static)
    foreach ($m in $methods) {
        if ($m.DeclaringType.FullName -eq $type.FullName) {
            Write-Output "  Method: $($m.Name)"
        }
    }
} else {
    Write-Output "Type Kinhlac.KinhlacCore not found."
}
