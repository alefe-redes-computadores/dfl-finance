#!/usr/bin/env python3

from __future__ import annotations

from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "branding" / "dfl-finance-icon-master.png"
PUBLIC = ROOT / "public"

PNG_SIG = b"\x89PNG\r\n\x1a\n"


def paeth(a: int, b: int, c: int) -> int:
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def read_rgba_png(path: Path):
    raw = path.read_bytes()

    if raw[:8] != PNG_SIG:
        raise RuntimeError(f"{path}: PNG inválido")

    pos = 8
    width = height = None
    bit_depth = color_type = interlace = None
    idat = bytearray()

    while pos < len(raw):
        length = struct.unpack(">I", raw[pos:pos + 4])[0]
        typ = raw[pos + 4:pos + 8]
        data = raw[pos + 8:pos + 8 + length]

        if typ == b"IHDR":
            (
                width,
                height,
                bit_depth,
                color_type,
                _compression,
                _filter,
                interlace,
            ) = struct.unpack(">IIBBBBB", data)
        elif typ == b"IDAT":
            idat.extend(data)
        elif typ == b"IEND":
            break

        pos += 12 + length

    if width is None or height is None:
        raise RuntimeError("IHDR ausente")

    if bit_depth != 8 or color_type != 6 or interlace != 0:
        raise RuntimeError(
            "O gerador requer PNG RGBA 8-bit não entrelaçado."
        )

    decoded = zlib.decompress(bytes(idat))

    bpp = 4
    stride = width * bpp
    expected = height * (stride + 1)

    if len(decoded) != expected:
        raise RuntimeError(
            f"Dados PNG inesperados: {len(decoded)} != {expected}"
        )

    rows = []
    previous = bytearray(stride)
    cursor = 0

    for _y in range(height):
        filter_type = decoded[cursor]
        cursor += 1

        scan = bytearray(decoded[cursor:cursor + stride])
        cursor += stride

        recon = bytearray(stride)

        for x in range(stride):
            left = recon[x - bpp] if x >= bpp else 0
            up = previous[x]
            up_left = previous[x - bpp] if x >= bpp else 0

            value = scan[x]

            if filter_type == 0:
                recon[x] = value
            elif filter_type == 1:
                recon[x] = (value + left) & 255
            elif filter_type == 2:
                recon[x] = (value + up) & 255
            elif filter_type == 3:
                recon[x] = (value + ((left + up) // 2)) & 255
            elif filter_type == 4:
                recon[x] = (value + paeth(left, up, up_left)) & 255
            else:
                raise RuntimeError(f"Filtro PNG não suportado: {filter_type}")

        rows.append(recon)
        previous = recon

    pixels = bytearray().join(rows)

    return width, height, pixels


def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(
            ">I",
            zlib.crc32(chunk_type + data) & 0xFFFFFFFF,
        )
    )


def write_rgba_png(path: Path, width: int, height: int, pixels: bytes):
    stride = width * 4
    raw = bytearray()

    for y in range(height):
        raw.append(0)
        start = y * stride
        raw.extend(pixels[start:start + stride])

    ihdr = struct.pack(
        ">IIBBBBB",
        width,
        height,
        8,
        6,
        0,
        0,
        0,
    )

    encoded = (
        PNG_SIG
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + png_chunk(b"IEND", b"")
    )

    path.write_bytes(encoded)


def resize_bilinear(src: bytes, sw: int, sh: int, dw: int, dh: int):
    dst = bytearray(dw * dh * 4)

    if dw == sw and dh == sh:
        return bytearray(src)

    x_scale = sw / dw
    y_scale = sh / dh

    for y in range(dh):
        sy = (y + 0.5) * y_scale - 0.5
        y0 = max(0, min(sh - 1, math.floor(sy)))
        y1 = max(0, min(sh - 1, y0 + 1))
        fy = max(0.0, min(1.0, sy - y0))

        for x in range(dw):
            sx = (x + 0.5) * x_scale - 0.5
            x0 = max(0, min(sw - 1, math.floor(sx)))
            x1 = max(0, min(sw - 1, x0 + 1))
            fx = max(0.0, min(1.0, sx - x0))

            indexes = (
                (y0 * sw + x0) * 4,
                (y0 * sw + x1) * 4,
                (y1 * sw + x0) * 4,
                (y1 * sw + x1) * 4,
            )

            out_i = (y * dw + x) * 4

            for c in range(4):
                top = src[indexes[0] + c] * (1 - fx) + src[indexes[1] + c] * fx
                bottom = src[indexes[2] + c] * (1 - fx) + src[indexes[3] + c] * fx
                value = top * (1 - fy) + bottom * fy
                dst[out_i + c] = max(0, min(255, round(value)))

    return dst


def alpha_composite_on_background(
    pixels: bytes,
    width: int,
    height: int,
    rgb=(15, 23, 42),
):
    out = bytearray(pixels)

    for i in range(0, len(out), 4):
        a = out[i + 3] / 255.0

        out[i] = round(out[i] * a + rgb[0] * (1 - a))
        out[i + 1] = round(out[i + 1] * a + rgb[1] * (1 - a))
        out[i + 2] = round(out[i + 2] * a + rgb[2] * (1 - a))
        out[i + 3] = 255

    return out


def place_centered(
    src: bytes,
    sw: int,
    sh: int,
    size: int,
    scale: float,
    background=(15, 23, 42, 255),
):
    canvas = bytearray(background * (size * size))

    inner = max(1, round(size * scale))
    resized = resize_bilinear(src, sw, sh, inner, inner)

    offset = (size - inner) // 2

    for y in range(inner):
        for x in range(inner):
            si = (y * inner + x) * 4
            di = ((y + offset) * size + (x + offset)) * 4

            sa = resized[si + 3] / 255.0
            da = canvas[di + 3] / 255.0
            out_a = sa + da * (1 - sa)

            if out_a <= 0:
                canvas[di] = 0
                canvas[di + 1] = 0
                canvas[di + 2] = 0
                canvas[di + 3] = 0
                continue

            for c in range(3):
                src_c = resized[si + c] / 255.0
                dst_c = canvas[di + c] / 255.0

                out_c = (
                    src_c * sa
                    + dst_c * da * (1 - sa)
                ) / out_a

                canvas[di + c] = round(out_c * 255)

            canvas[di + 3] = round(out_a * 255)

    return canvas


def make_standard(name: str, size: int):
    pixels = resize_bilinear(MASTER_PIXELS, MASTER_W, MASTER_H, size, size)
    write_rgba_png(PUBLIC / name, size, size, pixels)


def make_maskable(name: str, size: int):
    # Maskable precisa fornecer uma superfície completamente opaca.
    # O launcher pode recortar essa superfície em círculo, squircle etc.
    # O símbolo permanece dentro da zona segura, mas o exterior recebe
    # o mesmo fundo dark usado pelo manifest/PWA em vez de transparência.
    pixels = place_centered(
        MASTER_PIXELS,
        MASTER_W,
        MASTER_H,
        size,
        0.80,
        background=(15, 23, 42, 255),
    )
    write_rgba_png(PUBLIC / name, size, size, pixels)


def make_notification_badge():
    size = 96
    small = resize_bilinear(MASTER_PIXELS, MASTER_W, MASTER_H, size, size)
    out = bytearray(size * size * 4)

    # Badge monocromático simples derivado do conteúdo luminoso do master.
    # Pixels mais claros se tornam brancos; fundo/tons escuros ficam transparentes.
    for i in range(0, len(small), 4):
        r, g, b, a = small[i:i + 4]
        luminance = (
            0.2126 * r
            + 0.7152 * g
            + 0.0722 * b
        )

        alpha = 0

        if a > 20 and luminance >= 145:
            alpha = round(min(255, max(0, (luminance - 120) * 2.8)))

        out[i] = 255
        out[i + 1] = 255
        out[i + 2] = 255
        out[i + 3] = alpha

    write_rgba_png(
        PUBLIC / "notification-badge.png",
        size,
        size,
        out,
    )


def make_ico():
    png = (PUBLIC / "favicon-32x32.png").read_bytes()

    header = struct.pack(
        "<HHH",
        0,
        1,
        1,
    )

    directory = struct.pack(
        "<BBBBHHII",
        32,
        32,
        0,
        0,
        1,
        32,
        len(png),
        6 + 16,
    )

    (PUBLIC / "favicon.ico").write_bytes(
        header + directory + png
    )


MASTER_W, MASTER_H, MASTER_PIXELS = read_rgba_png(SOURCE)

if MASTER_W != MASTER_H:
    raise RuntimeError("Master deve ser quadrado")

PUBLIC.mkdir(parents=True, exist_ok=True)

make_standard("favicon-16x16.png", 16)
make_standard("favicon-32x32.png", 32)
make_standard("apple-touch-icon.png", 180)
make_standard("icon-192x192.png", 192)
make_standard("icon-512x512.png", 512)

make_maskable("icon-maskable-192x192.png", 192)
make_maskable("icon-maskable-512x512.png", 512)

make_standard("notification-icon.png", 192)
make_notification_badge()
make_ico()

print("Ícones DFL Finance gerados:")
for filename in (
    "favicon.ico",
    "favicon-16x16.png",
    "favicon-32x32.png",
    "apple-touch-icon.png",
    "icon-192x192.png",
    "icon-512x512.png",
    "icon-maskable-192x192.png",
    "icon-maskable-512x512.png",
    "notification-icon.png",
    "notification-badge.png",
):
    print(" -", PUBLIC / filename)
