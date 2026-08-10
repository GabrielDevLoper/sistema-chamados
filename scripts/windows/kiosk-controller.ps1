$ErrorActionPreference = "Stop"

$Port = 17865
$PinHash = "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92"
$AllowedOrigins = @(
  "https://sistema-chamados.velyondev.workers.dev",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
)
$FailedAttempts = 0
$BlockedUntil = [DateTime]::MinValue

function Get-Sha256([string]$Value) {
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($Value)
    return ([System.BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
  }
  finally {
    $algorithm.Dispose()
  }
}

function Send-Response {
  param(
    [System.Net.Sockets.NetworkStream]$Stream,
    [int]$StatusCode,
    [string]$StatusText,
    [string]$Body,
    [string]$Origin
  )

  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $headers = @(
    "HTTP/1.1 $StatusCode $StatusText",
    "Content-Type: application/json; charset=utf-8",
    "Content-Length: $($bodyBytes.Length)",
    "Access-Control-Allow-Origin: $Origin",
    "Access-Control-Allow-Methods: POST, OPTIONS",
    "Access-Control-Allow-Headers: Content-Type",
    "Access-Control-Allow-Private-Network: true",
    "Access-Control-Max-Age: 600",
    "Cache-Control: no-store",
    "Connection: close",
    "",
    ""
  ) -join "`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($bodyBytes.Length -gt 0) {
    $Stream.Write($bodyBytes, 0, $bodyBytes.Length)
  }
  $Stream.Flush()
}

function Close-RetiradaSenhaChrome {
  $processes = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" |
    Where-Object {
      $_.CommandLine -and
      $_.CommandLine -match "--user-data-dir=.*ChromeKiosk[\\/]+RetiradaSenha"
    }

  foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

$listener = [System.Net.Sockets.TcpListener]::new(
  [System.Net.IPAddress]::Loopback,
  $Port
)
$listener.Start()

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $reader = $null
    $stream = $null
    $responseSent = $false
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new(
        $stream,
        [System.Text.Encoding]::UTF8,
        $false,
        4096,
        $true
      )
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $headers = @{}
      while ($true) {
        $line = $reader.ReadLine()
        if ([string]::IsNullOrEmpty($line)) {
          break
        }
        $separator = $line.IndexOf(":")
        if ($separator -gt 0) {
          $headers[$line.Substring(0, $separator).Trim()] = $line.Substring($separator + 1).Trim()
        }
      }

      $parts = $requestLine.Split(" ")
      $method = $parts[0]
      $path = $parts[1]
      $origin = [string]$headers["Origin"]
      if ($AllowedOrigins -notcontains $origin) {
        Send-Response $stream 403 "Forbidden" '{"error":"Origem não autorizada."}' "null"
        continue
      }

      if ($method -eq "OPTIONS") {
        Send-Response $stream 204 "No Content" "" $origin
        continue
      }

      if ($method -ne "POST" -or $path -ne "/control") {
        Send-Response $stream 404 "Not Found" '{"error":"Rota não encontrada."}' $origin
        continue
      }

      if ([DateTime]::UtcNow -lt $BlockedUntil) {
        Send-Response $stream 429 "Too Many Requests" '{"error":"Muitas tentativas. Aguarde cinco minutos."}' $origin
        continue
      }

      $contentLength = 0
      if ($headers.ContainsKey("Content-Length")) {
        $contentLength = [int]$headers["Content-Length"]
      }
      if ($contentLength -le 0 -or $contentLength -gt 2048) {
        Send-Response $stream 400 "Bad Request" '{"error":"Requisição inválida."}' $origin
        continue
      }

      $buffer = New-Object char[] $contentLength
      $read = 0
      while ($read -lt $contentLength) {
        $count = $reader.Read($buffer, $read, $contentLength - $read)
        if ($count -le 0) {
          break
        }
        $read += $count
      }
      $payload = (-join $buffer[0..($read - 1)]) | ConvertFrom-Json

      if ((Get-Sha256 ([string]$payload.pin)) -ne $PinHash) {
        $FailedAttempts += 1
        if ($FailedAttempts -ge 5) {
          $BlockedUntil = [DateTime]::UtcNow.AddMinutes(5)
          $FailedAttempts = 0
        }
        Send-Response $stream 401 "Unauthorized" '{"error":"PIN inválido."}' $origin
        continue
      }

      $FailedAttempts = 0
      if ($payload.action -notin @("close", "shutdown")) {
        Send-Response $stream 400 "Bad Request" '{"error":"Comando inválido."}' $origin
        continue
      }

      Send-Response $stream 200 "OK" '{"ok":true}' $origin
      $responseSent = $true
      Start-Sleep -Milliseconds 900

      if ($payload.action -eq "close") {
        Close-RetiradaSenhaChrome
      }
      else {
        Start-Process -FilePath "shutdown.exe" -ArgumentList "/s", "/t", "5"
      }
    }
    catch {
      if (!$responseSent -and $stream -and $stream.CanWrite) {
        Send-Response $stream 500 "Internal Server Error" '{"error":"Falha no controlador local."}' "null"
      }
    }
    finally {
      if ($reader) {
        $reader.Dispose()
      }
      $client.Dispose()
    }
  }
}
finally {
  $listener.Stop()
}
