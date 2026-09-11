param(
  [string]$Src = "E:\Portfolio\photos\ayaan-01.jpeg",
  [string]$Out = "E:\Portfolio\ayaanis-me\public\avatar\ayaan-cloud.png",
  [string]$Debug = "C:\Users\MSI\AppData\Local\Temp\claude\E--Portfolio\b3bda2ab-07c6-4d8c-8374-fc8fcf5e3e2f\scratchpad\cloud-debug.png",
  [int]$CropX = 338, [int]$CropY = 508, [int]$CropW = 368, [int]$CropH = 772,
  [int]$OutW = 180,
  [double]$DarkLum = 0.30      # below this = suit / hair
)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile($Src)
Write-Output ("source: {0} x {1}" -f $img.Width, $img.Height)

$OutH = [int][Math]::Round($OutW * $CropH / $CropW)

# downsample the crop to the point-grid resolution
$small = New-Object System.Drawing.Bitmap($OutW, $OutH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($small)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.DrawImage($img, (New-Object System.Drawing.Rectangle(0,0,$OutW,$OutH)), $CropX, $CropY, $CropW, $CropH, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose(); $img.Dispose()

# ---- classify subject vs background ----
# The suit and hair are far darker than sky/building/road, and skin is caught
# by a standard R>G>B chroma rule. Everything else is background.
$mask = New-Object 'bool[,]' $OutW, $OutH
for ($y = 0; $y -lt $OutH; $y++) {
  for ($x = 0; $x -lt $OutW; $x++) {
    $p = $small.GetPixel($x, $y)
    $r = [double]$p.R; $gr = [double]$p.G; $b = [double]$p.B
    $lum = (0.2126*$r + 0.7152*$gr + 0.0722*$b) / 255.0
    $mx = [Math]::Max($r, [Math]::Max($gr, $b))
    $mn = [Math]::Min($r, [Math]::Min($gr, $b))

    # Foliage is dark enough to pass a pure luminance test, so reject anything
    # green-dominant first. The suit is near-neutral, so it survives this.
    $isFoliage = (($gr - $r) -gt 7) -and (($gr - $b) -gt 7)

    $isDark = ($lum -lt $DarkLum) -and (-not $isFoliage)
    $isSkin = ($r -gt 80) -and ($gr -gt 35) -and ($b -gt 15) -and
              (($mx - $mn) -gt 14) -and ($r -gt $gr) -and ($gr -ge $b) -and
              (($r - $gr) -gt 8) -and ($lum -lt 0.82)
    $mask[$x,$y] = $isDark -or $isSkin
  }
}

# ---- keep only the largest connected blob (drops sky specks, shadows, bins) ----
$label = New-Object 'int[,]' $OutW, $OutH
$sizes = @{}
$next = 0
for ($y = 0; $y -lt $OutH; $y++) {
  for ($x = 0; $x -lt $OutW; $x++) {
    if (-not $mask[$x,$y] -or $label[$x,$y] -ne 0) { continue }
    $next++
    $n = 0
    $stack = New-Object System.Collections.Generic.Stack[int[]]
    $stack.Push(@($x,$y))
    while ($stack.Count -gt 0) {
      $c = $stack.Pop(); $cx = $c[0]; $cy = $c[1]
      if ($cx -lt 0 -or $cy -lt 0 -or $cx -ge $OutW -or $cy -ge $OutH) { continue }
      if (-not $mask[$cx,$cy] -or $label[$cx,$cy] -ne 0) { continue }
      $label[$cx,$cy] = $next; $n++
      $stack.Push(@(($cx+1),$cy)); $stack.Push(@(($cx-1),$cy))
      $stack.Push(@($cx,($cy+1))); $stack.Push(@($cx,($cy-1)))
    }
    $sizes[$next] = $n
  }
}
$best = 0; $bestN = -1
foreach ($k in $sizes.Keys) { if ($sizes[$k] -gt $bestN) { $bestN = $sizes[$k]; $best = $k } }
Write-Output ("blobs: {0}; largest = {1} px ({2:P1} of frame)" -f $next, $bestN, ($bestN / [double]($OutW*$OutH)))

# ---- per-row trim ----
# Shadowed foliage down the left edge is dark enough to classify as subject and
# touches the figure at the top, so it survives blob selection. The figure,
# however, always crosses the centre of the frame. Keep only horizontal runs
# that reach the core band; detached side strips disappear.
$loBand = [int]($OutW * 0.24)
$hiBand = [int]($OutW * 0.76)
$trimmed = 0
for ($y = 0; $y -lt $OutH; $y++) {
  $x = 0
  while ($x -lt $OutW) {
    if ($label[$x,$y] -ne $best) { $x++; continue }
    $s = $x
    while ($x -lt $OutW -and $label[$x,$y] -eq $best) { $x++ }
    $e = $x - 1
    if ($e -lt $loBand -or $s -gt $hiBand) {
      for ($k = $s; $k -le $e; $k++) { $label[$k,$y] = -1; $trimmed++ }
    }
  }
}
Write-Output ("per-row trim removed {0} px" -f $trimmed)

# ---- write RGBA: subject keeps its colour, background goes transparent ----
$outBmp = New-Object System.Drawing.Bitmap($OutW, $OutH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$dbg    = New-Object System.Drawing.Bitmap($OutW, $OutH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$kept = 0
for ($y = 0; $y -lt $OutH; $y++) {
  for ($x = 0; $x -lt $OutW; $x++) {
    $inSubject = ($label[$x,$y] -eq $best)
    $p = $small.GetPixel($x, $y)
    if ($inSubject) {
      $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
      $dbg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 60, 230, 140))
      $kept++
    } else {
      $outBmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      $dbg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
    }
  }
}
$small.Dispose()

$dir = Split-Path $Out -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$outBmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$dbg.Save($Debug, [System.Drawing.Imaging.ImageFormat]::Png)
$outBmp.Dispose(); $dbg.Dispose()

Write-Output ("grid {0}x{1}; subject points = {2}; png = {3} KB" -f $OutW, $OutH, $kept, [int]((Get-Item $Out).Length/1KB))
