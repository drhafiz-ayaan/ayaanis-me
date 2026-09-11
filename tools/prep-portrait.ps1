<#
  Prepares a background-removed portrait PNG for the point cloud.

  The source already carries a correct alpha cutout, so there is no
  segmentation to do here (see segment-portrait.ps1 for the case where there
  isn't one). This script only does what the cloud builder needs:

    1. crop to the alpha bounding box, so world height maps to the figure
       rather than to empty margin,
    2. downscale to a sane decode cost — the builder strides the pixels
       anyway, so anything past ~1000px tall is bytes on the critical path
       for no extra points,
    3. lift the shadows. A black suit photographed on black sits at luminance
       15-30. The cloud's colour mapping puts that at its cyan emission floor,
       so every torso point comes out the same value and the figure reads as a
       flat slab. A gamma curve spreads those darks into a usable range and
       the lapels, folds and shoulder line survive into 3D.

  Alpha is carried through untouched; the builder thresholds it at 128.

  Usage: powershell -File tools/prep-portrait.ps1 -Src <in.png> [-Out <out.png>]
#>
param(
  [Parameter(Mandatory = $true)][string]$Src,
  [string]$Out = "public/avatar/ayaan-cloud-v2.png",
  [int]$TargetHeight = 1000,
  [double]$Gamma = 0.55
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Get-Pixels($bmp) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $d = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $buf = New-Object byte[] ($d.Stride * $bmp.Height)
  [System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $buf, 0, $buf.Length)
  $stride = $d.Stride
  $bmp.UnlockBits($d)
  return @{ buf = $buf; stride = $stride }
}

# NB: not $src - the [string]$Src parameter keeps its type constraint, so
# assigning a Bitmap to it silently coerces back to a string.
$img = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Src))
$W = $img.Width
$H = $img.Height
$p = Get-Pixels $img
$buf = $p.buf
$stride = $p.stride

# --- alpha bounding box -----------------------------------------------------
$x0 = $W; $y0 = $H; $x1 = -1; $y1 = -1
for ($y = 0; $y -lt $H; $y++) {
  $row = $y * $stride
  for ($x = 0; $x -lt $W; $x++) {
    if ($buf[$row + $x * 4 + 3] -gt 128) {
      if ($x -lt $x0) { $x0 = $x }
      if ($x -gt $x1) { $x1 = $x }
      if ($y -lt $y0) { $y0 = $y }
      if ($y -gt $y1) { $y1 = $y }
    }
  }
}
if ($x1 -lt $x0) { throw "source has no opaque pixels - is it actually cut out?" }

$pad = [int](($y1 - $y0) * 0.015)
$x0 = [Math]::Max(0, $x0 - $pad); $y0 = [Math]::Max(0, $y0 - $pad)
$x1 = [Math]::Min($W - 1, $x1 + $pad); $y1 = [Math]::Min($H - 1, $y1 + $pad)
$cw = $x1 - $x0 + 1
$ch = $y1 - $y0 + 1
Write-Host "silhouette bbox: ${cw}x${ch} at ($x0,$y0) of ${W}x${H}"

# --- crop + downscale -------------------------------------------------------
$scale = [Math]::Min(1.0, $TargetHeight / [double]$ch)
$ow = [int][Math]::Round($cw * $scale)
$oh = [int][Math]::Round($ch * $scale)

$dst = New-Object System.Drawing.Bitmap $ow, $oh, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($dst)
$gfx.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$srcRect = New-Object System.Drawing.Rectangle $x0, $y0, $cw, $ch
$dstRect = New-Object System.Drawing.Rectangle 0, 0, $ow, $oh
$gfx.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$gfx.Dispose()
$img.Dispose()

# --- shadow lift ------------------------------------------------------------
# 256-entry lookup rather than a pow() per subpixel: three million pow calls in
# PowerShell is minutes, the table is instant.
$lut = New-Object byte[] 256
for ($i = 0; $i -lt 256; $i++) {
  $lut[$i] = [byte][Math]::Min(255, [Math]::Round(255.0 * [Math]::Pow($i / 255.0, $Gamma)))
}

$rect = New-Object System.Drawing.Rectangle 0, 0, $ow, $oh
$d = $dst.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite,
  [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ob = New-Object byte[] ($d.Stride * $oh)
[System.Runtime.InteropServices.Marshal]::Copy($d.Scan0, $ob, 0, $ob.Length)

for ($y = 0; $y -lt $oh; $y++) {
  $row = $y * $d.Stride
  for ($x = 0; $x -lt $ow; $x++) {
    $o = $row + $x * 4
    if ($ob[$o + 3] -le 8) {
      # Clear RGB under full transparency. Resampling drags the old
      # background's colour into the fringe otherwise, and the builder reads
      # colour from pixels it keeps on alpha alone.
      $ob[$o] = 0; $ob[$o + 1] = 0; $ob[$o + 2] = 0
      continue
    }
    $ob[$o] = $lut[$ob[$o]]
    $ob[$o + 1] = $lut[$ob[$o + 1]]
    $ob[$o + 2] = $lut[$ob[$o + 2]]
  }
}

[System.Runtime.InteropServices.Marshal]::Copy($ob, 0, $d.Scan0, $ob.Length)
$dst.UnlockBits($d)

$outPath = Join-Path (Get-Location) $Out
New-Item -ItemType Directory -Force -Path (Split-Path $outPath) | Out-Null
$dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()

$kb = [int]((Get-Item $outPath).Length / 1KB)
Write-Host "wrote $Out  ${ow}x${oh}  ${kb} KB"
