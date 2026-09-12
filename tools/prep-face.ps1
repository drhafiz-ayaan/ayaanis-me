<#
  Crops the head out of the cut-out portrait for the background hologram.

  Cropped from the ORIGINAL photograph rather than from the prepared
  ayaan-cloud PNG. That one is downscaled to 1000px for the whole body, which
  leaves the head about 140px tall — blown up to fill a screen it is mush.
  The source still carries roughly 260px of head, and the hologram samples it
  as a point grid, so what resolution there is goes entirely into the face.

  The crop runs from the top of the head down to the shoulder line, found as
  the widest row in the upper third of the silhouette.

  Usage: powershell -File tools/prep-face.ps1 -Src <in.png>
#>
param(
  [Parameter(Mandatory = $true)][string]$Src,
  [string]$Out = "public/avatar/ayaan-face-v1.png",
  [int]$TargetHeight = 560,
  [double]$Gamma = 0.72
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$img = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Src))
$W = $img.Width
$H = $img.Height

$rect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
$d = $img.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $d.Stride
$buf = New-Object byte[] ($stride * $H)
[System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
$img.UnlockBits($d)

# NB: row widths below are $rowW, never $w. PowerShell variables are
# case-insensitive, so a loop-local $w silently overwrites $W, the image
# width — which then corrupts every bound computed from it.

# row extents of the silhouette
$rowMin = New-Object int[] $H
$rowMax = New-Object int[] $H
for ($y = 0; $y -lt $H; $y++) {
  $rowMin[$y] = $W
  $rowMax[$y] = -1
  $row = $y * $stride
  for ($x = 0; $x -lt $W; $x++) {
    if ($buf[$row + $x * 4 + 3] -gt 128) {
      if ($x -lt $rowMin[$y]) { $rowMin[$y] = $x }
      if ($x -gt $rowMax[$y]) { $rowMax[$y] = $x }
    }
  }
}

# top of the head, and the shoulder line below it
$topRow = 0
for ($y = 0; $y -lt $H; $y++) { if ($rowMax[$y] -ge $rowMin[$y]) { $topRow = $y; break } }

$bodyBottom = $H - 1
for ($y = $H - 1; $y -ge 0; $y--) { if ($rowMax[$y] -ge $rowMin[$y]) { $bodyBottom = $y; break } }
$figH = $bodyBottom - $topRow

# The head's bottom is the NECK, which is the narrowest row between the skull
# and the shoulders — not the widest row of the upper third, which on a full
# body lands at chest height and crops a torso instead of a face.
# So: find where the skull is widest, then walk down to the first local
# minimum. Below that the silhouette only widens, into the shoulders.
$skullRow = $topRow
$skullW = 0
$skullLimit = $topRow + [int]($figH * 0.13)
for ($y = $topRow; $y -lt $skullLimit; $y++) {
  $rowW = $rowMax[$y] - $rowMin[$y]
  if ($rowW -gt $skullW) { $skullW = $rowW; $skullRow = $y }
}

$neckRow = $skullRow
$neckW = [int]::MaxValue
$neckLimit = $topRow + [int]($figH * 0.24)
for ($y = $skullRow; $y -lt $neckLimit; $y++) {
  if ($rowMax[$y] -lt $rowMin[$y]) { continue }
  $rowW = $rowMax[$y] - $rowMin[$y]
  if ($rowW -le $neckW) { $neckW = $rowW; $neckRow = $y }
}
Write-Host "skull row=$skullRow w=$skullW   neck row=$neckRow w=$neckW"

# a little collar below the neck so the head is not floating
$y0 = [Math]::Max(0, $topRow - [int]($figH * 0.012))
$y1 = [Math]::Min($H - 1, $neckRow + [int]($figH * 0.022))

$hx0 = $W; $hx1 = -1
for ($y = $y0; $y -le $y1; $y++) {
  if ($rowMax[$y] -lt $rowMin[$y]) { continue }
  if ($rowMin[$y] -lt $hx0) { $hx0 = $rowMin[$y] }
  if ($rowMax[$y] -gt $hx1) { $hx1 = $rowMax[$y] }
}
$padX = [int](($hx1 - $hx0) * 0.10)
$hx0 = [Math]::Max(0, $hx0 - $padX)
$hx1 = [Math]::Min($W - 1, $hx1 + $padX)

$cw = $hx1 - $hx0 + 1
$ch = $y1 - $y0 + 1
Write-Host "head crop: ${cw}x${ch} at ($hx0,$y0)  [top=$topRow shoulder=$shoulderRow]"

$scale = $TargetHeight / [double]$ch
$ow = [int][Math]::Round($cw * $scale)
$oh = [int][Math]::Round($ch * $scale)

$dst = New-Object System.Drawing.Bitmap $ow, $oh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($dst)
$gfx.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$srcRect = New-Object System.Drawing.Rectangle $hx0, $y0, $cw, $ch
$dstRect = New-Object System.Drawing.Rectangle 0, 0, $ow, $oh
$gfx.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$gfx.Dispose()
$img.Dispose()

# Gentler lift than the body gets: the face already has tonal range and
# crushing it flat would cost the very features this crop exists to show.
$lut = New-Object byte[] 256
for ($i = 0; $i -lt 256; $i++) {
  $lut[$i] = [byte][Math]::Min(255, [Math]::Round(255.0 * [Math]::Pow($i / 255.0, $Gamma)))
}

$r2 = New-Object System.Drawing.Rectangle 0, 0, $ow, $oh
$d2 = $dst.LockBits($r2, [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ob = New-Object byte[] ($d2.Stride * $oh)
[System.Runtime.InteropServices.Marshal]::Copy($d2.Scan0, $ob, 0, $ob.Length)
for ($y = 0; $y -lt $oh; $y++) {
  $row = $y * $d2.Stride
  for ($x = 0; $x -lt $ow; $x++) {
    $o = $row + $x * 4
    if ($ob[$o + 3] -le 8) { $ob[$o] = 0; $ob[$o + 1] = 0; $ob[$o + 2] = 0; continue }
    $ob[$o] = $lut[$ob[$o]]
    $ob[$o + 1] = $lut[$ob[$o + 1]]
    $ob[$o + 2] = $lut[$ob[$o + 2]]
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($ob, 0, $d2.Scan0, $ob.Length)
$dst.UnlockBits($d2)

$outPath = Join-Path (Get-Location) $Out
New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null
$dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
Write-Host "wrote $Out  ${ow}x${oh}  $([int]((Get-Item $outPath).Length/1KB)) KB"
