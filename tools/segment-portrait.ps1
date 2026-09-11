param(
  [string]$Src   = "E:\Portfolio\photos\ayaan-01.jpeg",
  [string]$Out   = "E:\Portfolio\ayaanis-me\public\avatar\ayaan-cloud.png",
  [string]$Debug = "",
  # generous box around the figure; the flood fill does the precise work
  [int]$CropX = 318, [int]$CropY = 498, [int]$CropW = 408, [int]$CropH = 782,
  [int]$OutW  = 190,
  [double]$BgLum  = 0.44,   # brighter than this is background-ish
  [double]$DimLum = 0.34,   # ...or this bright but desaturated (road, haze)
  [double]$DimSat = 0.20
)

<#
  Portrait -> subject-only RGBA, for the point-cloud hologram.

  Earlier versions classified each pixel independently ("dark = subject") and
  produced a mangled silhouette: the hair fragmented, and a bright wedge of
  building survived because it happened to sit inside the kept blob.

  This version segments by CONNECTIVITY. Background is whatever the image
  border can reach by walking through background-ish pixels; anything the
  flood cannot reach is subject. Dark hair stays attached to a dark suit, and
  a patch of sky fenced off by the body cannot be smuggled in.

  Implementation notes, both learned the hard way:
   * Everything is a FLAT array indexed y*W+x. PowerShell cannot parse a 2-D
     index inside a method-call argument, and multi-statement lines with 2-D
     assignments fail with CannotIndex.
   * Variable names are >1 char and distinct. PowerShell is case-insensitive,
     so a `$G` channel array silently aliases a `$g` Graphics handle.
#>

Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Src)
$OutH = [int][Math]::Round($OutW * $CropH / $CropW)
$total = $OutW * $OutH

$small = New-Object System.Drawing.Bitmap($OutW, $OutH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($small)
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gfx.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gfx.DrawImage($img, (New-Object System.Drawing.Rectangle(0,0,$OutW,$OutH)), $CropX, $CropY, $CropW, $CropH, [System.Drawing.GraphicsUnit]::Pixel)
$gfx.Dispose(); $img.Dispose()

# ---------- read pixels once, via LockBits (GetPixel per-pixel is far too slow) ----------
$rect = New-Object System.Drawing.Rectangle(0, 0, $OutW, $OutH)
$data = $small.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$bytes = New-Object byte[] ($data.Stride * $OutH)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$small.UnlockBits($data)
$stride = $data.Stride
$small.Dispose()

$chR = New-Object byte[] $total
$chG = New-Object byte[] $total
$chB = New-Object byte[] $total
$isBgish = New-Object bool[] $total

for ($y = 0; $y -lt $OutH; $y++) {
  $row = $y * $stride
  $base = $y * $OutW
  for ($x = 0; $x -lt $OutW; $x++) {
    $o = $row + $x * 4          # BGRA
    $bb = $bytes[$o]; $gg = $bytes[$o+1]; $rr = $bytes[$o+2]
    $i = $base + $x
    $chR[$i] = $rr; $chG[$i] = $gg; $chB[$i] = $bb

    $rf = $rr / 255.0; $gf = $gg / 255.0; $bf = $bb / 255.0
    $lum = 0.2126*$rf + 0.7152*$gf + 0.0722*$bf
    $mx = [Math]::Max($rf, [Math]::Max($gf, $bf))
    $mn = [Math]::Min($rf, [Math]::Min($gf, $bf))
    $sat = 0.0
    if ($mx -gt 0) { $sat = ($mx - $mn) / $mx }
    # Anything where green leads and there is real colour is vegetation,
    # however dark. Shadowed trees are too dim for a luminance test but they
    # are never neutral, and the suit is neutral however dark it gets.
    $foliage = ($gf -ge $rf) -and ($gf -ge $bf) -and ($sat -gt 0.10)

    # Sunlit skin is brighter than BgLum, so without this guard the face and
    # hands classify as background and the flood eats them out of the figure.
    # Must be tight: beige render and reddish paving also satisfy a loose
    # R>G>B test, and letting them through turns most of the frame into
    # "subject". Real skin has a much wider red-blue gap and real saturation.
    $skin = ($rf -gt 0.30) -and ($rf -lt 0.93) -and
            (($rf - $gf) -gt 0.10) -and (($gf - $bf) -gt 0.02) -and
            (($rf - $bf) -gt 0.18) -and ($sat -gt 0.20)

    $isBgish[$i] = (-not $skin) -and (
      ($lum -gt $BgLum) -or $foliage -or (($lum -gt $DimLum) -and ($sat -lt $DimSat))
    )
  }
}

# ---------- flood the background in from the border ----------
# The bottom edge is NOT seeded: the figure stands on it, so seeding there
# would let the fill walk straight up through the legs.
$isBg = New-Object bool[] $total
$st = New-Object System.Collections.Generic.Stack[int]
for ($x = 0; $x -lt $OutW; $x++) { $st.Push($x) }
for ($y = 0; $y -lt $OutH; $y++) { $st.Push($y*$OutW); $st.Push($y*$OutW + $OutW - 1) }
# Seed the bottom corners only. Ground in the corners needs a way in, but the
# middle of the bottom edge is where the figure stands — seeding there lets
# the fill climb the legs and hollow out the body.
$bottom = ($OutH - 1) * $OutW
for ($x = 0; $x -lt [int]($OutW * 0.26); $x++) { $st.Push($bottom + $x) }
for ($x = [int]($OutW * 0.74); $x -lt $OutW; $x++) { $st.Push($bottom + $x) }

while ($st.Count -gt 0) {
  $i = $st.Pop()
  if ($isBg[$i] -or -not $isBgish[$i]) { continue }
  $isBg[$i] = $true
  $cx = $i % $OutW
  $cy = [int][Math]::Floor($i / $OutW)
  if ($cx -gt 0)          { $st.Push($i - 1) }
  if ($cx -lt $OutW - 1)  { $st.Push($i + 1) }
  if ($cy -gt 0)          { $st.Push($i - $OutW) }
  if ($cy -lt $OutH - 1)  { $st.Push($i + $OutW) }
}

# ---------- subject = whatever the flood never reached ----------
# Interior holes fill themselves: a bright shirt highlight is not
# border-connected, so it stays part of the subject.
$lab = New-Object int[] $total
$bestLab = 0; $bestN = -1; $next = 0
for ($i = 0; $i -lt $total; $i++) {
  if ($isBg[$i] -or $lab[$i] -ne 0) { continue }
  $next++; $n = 0
  $s2 = New-Object System.Collections.Generic.Stack[int]
  $s2.Push($i)
  while ($s2.Count -gt 0) {
    $j = $s2.Pop()
    if ($isBg[$j] -or $lab[$j] -ne 0) { continue }
    $lab[$j] = $next; $n++
    $jx = $j % $OutW
    $jy = [int][Math]::Floor($j / $OutW)
    if ($jx -gt 0)         { $s2.Push($j - 1) }
    if ($jx -lt $OutW - 1) { $s2.Push($j + 1) }
    if ($jy -gt 0)         { $s2.Push($j - $OutW) }
    if ($jy -lt $OutH - 1) { $s2.Push($j + $OutW) }
  }
  if ($n -gt $bestN) { $bestN = $n; $bestLab = $next }
}

# ---------- write RGBA out via LockBits as well ----------
$outBmp = New-Object System.Drawing.Bitmap($OutW, $OutH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$od = $outBmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ob = New-Object byte[] ($od.Stride * $OutH)

$dbgBytes = $null
if ($Debug) { $dbgBytes = New-Object byte[] ($od.Stride * $OutH) }

$kept = 0
for ($y = 0; $y -lt $OutH; $y++) {
  $row = $y * $od.Stride
  $base = $y * $OutW
  for ($x = 0; $x -lt $OutW; $x++) {
    $i = $base + $x
    $o = $row + $x * 4
    $inSub = ($lab[$i] -eq $bestLab)
    if ($inSub) {
      $ob[$o]   = $chB[$i]; $ob[$o+1] = $chG[$i]; $ob[$o+2] = $chR[$i]; $ob[$o+3] = 255
      $kept++
      if ($dbgBytes) { $dbgBytes[$o] = 140; $dbgBytes[$o+1] = 230; $dbgBytes[$o+2] = 60; $dbgBytes[$o+3] = 255 }
    } else {
      $ob[$o] = 0; $ob[$o+1] = 0; $ob[$o+2] = 0; $ob[$o+3] = 0
      if ($dbgBytes) { $dbgBytes[$o] = $chB[$i]; $dbgBytes[$o+1] = $chG[$i]; $dbgBytes[$o+2] = $chR[$i]; $dbgBytes[$o+3] = 255 }
    }
  }
}
[System.Runtime.InteropServices.Marshal]::Copy($ob, 0, $od.Scan0, $ob.Length)
$outBmp.UnlockBits($od)

$dir = Split-Path $Out -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$outBmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$outBmp.Dispose()

if ($dbgBytes) {
  $dbgBmp = New-Object System.Drawing.Bitmap($OutW, $OutH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $dd = $dbgBmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  [System.Runtime.InteropServices.Marshal]::Copy($dbgBytes, 0, $dd.Scan0, $dbgBytes.Length)
  $dbgBmp.UnlockBits($dd)
  $dbgBmp.Save($Debug, [System.Drawing.Imaging.ImageFormat]::Png)
  $dbgBmp.Dispose()
}

Write-Output ("grid {0}x{1}  subject {2} px ({3:P1})  png {4} KB" -f `
  $OutW, $OutH, $kept, ($kept/[double]$total), [int]((Get-Item $Out).Length/1KB))
