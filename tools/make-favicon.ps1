<#
  Rasterises the monogram into public/favicon.ico and src/app/apple-icon.png.

  The ICO goes in public/, NOT in src/app/. Next processes images in the app
  directory to read their dimensions, and its ICO decoder expects DIB entries;
  this file carries PNG-compressed entries, which every browser reads but that
  decoder does not — it fails with "unable to decode image data" and serves a
  500 for the whole route. Served from public/ it is never decoded, and
  browsers still find it at the conventional /favicon.ico.

  Why both, when src/app/icon.svg already exists: the SVG only gets used by
  clients that read the <link rel="icon"> tag. Google's crawler, Windows
  shortcuts, older Safari and several link-preview services request the
  hard-coded /favicon.ico instead. When that 404s on a Vercel deployment the
  platform's own mark is what ends up displayed, which is exactly the bug this
  fixes.

  The geometry is drawn with GDI+ rather than by rendering the SVG, because
  System.Drawing has no SVG rasteriser. It must therefore be kept in step with
  icon.svg by hand — the shape is nine primitives, so that is cheaper than
  taking on a rendering dependency.

  Usage: powershell -File tools/make-favicon.ps1
#>
param(
  [string]$IcoOut = "public/favicon.ico",
  [string]$AppleOut = "src/app/apple-icon.png"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

# icon.svg is authored on a 32-unit grid; every coordinate below is in those
# units and scaled at draw time, so the two stay comparable by eye.
function New-Mark([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size,
    ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $k = $size / 32.0
  $ground = [System.Drawing.Color]::FromArgb(255, 4, 6, 11)
  $cyan = [System.Drawing.Color]::FromArgb(255, 34, 211, 238)
  $bright = [System.Drawing.Color]::FromArgb(255, 103, 232, 249)

  # rounded-rect ground
  $r = 7.0 * $k
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($size - $d, 0, $d, $d, 270, 90)
  $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $path.AddArc(0, $size - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.SolidBrush $ground
  $g.FillPath($brush, $path)
  $brush.Dispose()

  # The hairline border collapses into a muddy ring below ~24px, where it costs
  # contrast and returns nothing. Drop it there.
  if ($size -ge 24) {
    $bc = [System.Drawing.Color]::FromArgb(97, 34, 211, 238)
    $bp = New-Object System.Drawing.Pen $bc, ([float](1.0 * $k))
    $g.DrawPath($bp, $path)
    $bp.Dispose()
  }
  $path.Dispose()

  # the "A", widened slightly at small sizes so the crossbar survives
  $w = if ($size -lt 24) { 3.4 } else { 2.7 }
  $pen = New-Object System.Drawing.Pen $cyan, ([float]($w * $k))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, [float](16 * $k), [float](7.2 * $k), [float](24.2 * $k), [float](25 * $k))
  $g.DrawLine($pen, [float](16 * $k), [float](7.2 * $k), [float](7.8 * $k), [float](25 * $k))
  $g.DrawLine($pen, [float](11.4 * $k), [float](19.4 * $k), [float](20.6 * $k), [float](19.4 * $k))
  $pen.Dispose()

  # graph nodes
  function Dot($cx, $cy, $rad, $col) {
    $b = New-Object System.Drawing.SolidBrush $col
    $g.FillEllipse($b, [float](($cx - $rad) * $k), [float](($cy - $rad) * $k),
      [float]($rad * 2 * $k), [float]($rad * 2 * $k))
    $b.Dispose()
  }
  Dot 16 7.2 2.9 $bright
  Dot 7.8 25 2.1 $cyan
  Dot 24.2 25 2.1 $cyan

  $g.Dispose()
  return $bmp
}

function Get-PngBytes($bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  $ms.Dispose()
  # NB: the leading comma stops PowerShell unrolling the array into the
  # pipeline. Without it the caller gets a stream of individual bytes, rebuilt
  # as an Object[], and BinaryWriter silently matches Write(char) instead of
  # Write(byte[]) — which produced a 108-byte ICO of pure header.
  return ,$bytes
}

# --- favicon.ico ------------------------------------------------------------
# Vista-era ICO: each entry carries a whole PNG rather than a DIB, which every
# browser in use reads and which keeps the file small.
$sizes = @(16, 32, 48, 64, 128, 256)
$images = @()
foreach ($s in $sizes) {
  $bmp = New-Mark $s
  $images += , (Get-PngBytes $bmp)
  $bmp.Dispose()
}

$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter $ms
$bw.Write([uint16]0)              # reserved
$bw.Write([uint16]1)              # type: icon
$bw.Write([uint16]$sizes.Count)

$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]
  # 256 is stored as 0 — the field is a single byte
  $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))
  $bw.Write([byte]($(if ($s -ge 256) { 0 } else { $s })))
  $bw.Write([byte]0)              # palette size
  $bw.Write([byte]0)              # reserved
  $bw.Write([uint16]1)            # colour planes
  $bw.Write([uint16]32)           # bits per pixel
  $bw.Write([uint32]([byte[]]$images[$i]).Length)
  $bw.Write([uint32]$offset)
  $offset += ([byte[]]$images[$i]).Length
}
foreach ($img in $images) { $bw.Write([byte[]]$img) }
$bw.Flush()

$icoPath = Join-Path (Get-Location) $IcoOut
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$bw.Dispose(); $ms.Dispose()
Write-Host "wrote $IcoOut ($($sizes -join ', ') px, $([int]((Get-Item $icoPath).Length/1KB)) KB)"

# --- apple-icon.png ---------------------------------------------------------
# iOS ignores the ICO and has no transparency on the home screen, so this one
# is a flat 180px tile.
$apple = New-Mark 180
$applePath = Join-Path (Get-Location) $AppleOut
$apple.Save($applePath, [System.Drawing.Imaging.ImageFormat]::Png)
$apple.Dispose()
Write-Host "wrote $AppleOut (180px)"
