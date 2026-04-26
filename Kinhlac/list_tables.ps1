try {
    $conn = New-Object -ComObject ADODB.Connection
    $conn.Open("Provider=Microsoft.Jet.OLEDB.4.0;Data Source=c:\medicine\Kinhlac\kinhlac.dat")
    $schema = $conn.OpenSchema(20) # adSchemaTables
    if ($schema -eq $null) {
        Write-Output "Failed to open schema."
    } else {
        while (-not $schema.EOF) {
            $name = $schema.Fields.Item("TABLE_NAME").Value
            $type = $schema.Fields.Item("TABLE_TYPE").Value
            if ($type -eq "TABLE") {
                Write-Output $name
            }
            $schema.MoveNext()
        }
    }
    $conn.Close()
} catch {
    Write-Output "Error: $($_.Exception.Message)"
}
