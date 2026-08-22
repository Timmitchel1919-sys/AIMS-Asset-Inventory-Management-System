param(
    [string]$SourcePath = (Join-Path $PSScriptRoot '..\public\App icon.png'),
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\public\icons')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$source = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $SourcePath))
try {
    if ($source.Width -ne $source.Height) {
        throw "The approved app icon must be square; received $($source.Width)x$($source.Height)."
    }

    New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
    $sizes = 16, 32, 48, 64, 96, 128, 144, 180, 192, 256, 384, 512, 1024

    foreach ($size in $sizes) {
        $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $bitmap.SetResolution(96, 96)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
                $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                $graphics.DrawImage($source, 0, 0, $size, $size)
            }
            finally {
                $graphics.Dispose()
            }

            $target = Join-Path $OutputDirectory "aims-$size.png"
            $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $bitmap.Dispose()
        }
    }

    # The approved artwork already keeps its emblem within the maskable safe zone.
    # Keep the artwork unchanged and use the 512px render as the dedicated maskable asset.
    Copy-Item -Force -LiteralPath (Join-Path $OutputDirectory 'aims-512.png') -Destination (Join-Path $OutputDirectory 'aims-maskable-512.png')
}
finally {
    $source.Dispose()
}
