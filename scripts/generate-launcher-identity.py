#!/usr/bin/env python3

from pathlib import Path
import argparse
import math
import binascii
import struct
import zlib


PNG_SIG = b"\x89PNG\r\n\x1a\n"
BG = (15, 23, 42, 255)


def paeth(a, b, c):
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)

    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def read_rgba_png(path):
    raw = path.read_bytes()

    if raw[:8] != PNG_SIG:
        raise RuntimeError(f"PNG inválido: {path}")

    pos = 8
    width = height = None
    bit = color_type = interlace = None
    idat = bytearray()

    while pos < len(raw):
        length = struct.unpack(">I", raw[pos:pos + 4])[0]
        typ = raw[pos + 4:pos + 8]
        payload = raw[pos + 8:pos + 8 + length]
        pos += 12 + length

        if typ == b"IHDR":
            (
                width,
                height,
                bit,
                color_type,
                _compression,
                _filter,
                interlace,
            ) = struct.unpack(">IIBBBBB", payload)
        elif typ == b"IDAT":
            idat.extend(payload)
        elif typ == b"IEND":
            break

    if (
        width is None
        or height is None
        or bit != 8
        or color_type != 6
        or interlace != 0
    ):
        raise RuntimeError(
            "Master deve ser PNG RGBA 8-bit não entrelaçado."
        )

    bpp = 4
    stride = width * bpp
    decoded = zlib.decompress(bytes(idat))

    if len(decoded) != height * (stride + 1):
        raise RuntimeError("Payload PNG inesperado.")

    rows = []
    previous = bytearray(stride)
    cursor = 0

    for _ in range(height):
        filter_type = decoded[cursor]
        cursor += 1

        scan = bytearray(decoded[cursor:cursor + stride])
        cursor += stride

        recon = bytearray(stride)

        for x in range(stride):
            left = recon[x - bpp] if x >= bpp else 0
            up = previous[x]
            upper_left = previous[x - bpp] if x >= bpp else 0
            value = scan[x]

            if filter_type == 0:
                out = value
            elif filter_type == 1:
                out = (value + left) & 255
            elif filter_type == 2:
                out = (value + up) & 255
            elif filter_type == 3:
                out = (value + ((left + up) // 2)) & 255
            elif filter_type == 4:
                out = (value + paeth(left, up, upper_left)) & 255
            else:
                raise RuntimeError(
                    f"Filtro PNG não suportado: {filter_type}"
                )

            recon[x] = out

        rows.append(recon)
        previous = recon

    return width, height, b"".join(rows)


def png_chunk(kind, payload):
    return (
        struct.pack(">I", len(payload))
        + kind
        + payload
        + struct.pack(
            ">I",
            binascii.crc32(kind + payload) & 0xFFFFFFFF,
        )
    )


def write_rgba_png(path, width, height, pixels):
    path.parent.mkdir(parents=True, exist_ok=True)

    stride = width * 4
    raw = bytearray()

    for y in range(height):
        raw.append(0)
        start = y * stride
        raw.extend(pixels[start:start + stride])

    data = (
        PNG_SIG
        + png_chunk(
            b"IHDR",
            struct.pack(
                ">IIBBBBB",
                width,
                height,
                8,
                6,
                0,
                0,
                0,
            ),
        )
        + png_chunk(
            b"IDAT",
            zlib.compress(bytes(raw), 9),
        )
        + png_chunk(b"IEND", b"")
    )

    path.write_bytes(data)


def _cubic_weight(value):
    # Catmull-Rom (a = -0.5).
    # Preserva contornos melhor que o upscale bilinear,
    # sem alterar escala ou geometria do artwork.
    a = -0.5
    x = abs(value)

    if x <= 1:
        return (
            (a + 2) * x * x * x
            - (a + 3) * x * x
            + 1
        )

    if x < 2:
        return (
            a * x * x * x
            - 5 * a * x * x
            + 8 * a * x
            - 4 * a
        )

    return 0.0


def resize_bicubic(src, sw, sh, dw, dh):
    out = bytearray(dw * dh * 4)

    for y in range(dh):
        sy = ((y + 0.5) * sh / dh) - 0.5
        iy = math.floor(sy)

        for x in range(dw):
            sx = ((x + 0.5) * sw / dw) - 0.5
            ix = math.floor(sx)

            dst = (y * dw + x) * 4

            for channel in range(4):
                total = 0.0
                weight_total = 0.0

                for oy in range(-1, 3):
                    py = min(
                        sh - 1,
                        max(0, iy + oy),
                    )

                    wy = _cubic_weight(
                        sy - (iy + oy)
                    )

                    for ox in range(-1, 3):
                        px = min(
                            sw - 1,
                            max(0, ix + ox),
                        )

                        wx = _cubic_weight(
                            sx - (ix + ox)
                        )

                        weight = wx * wy

                        src_index = (
                            (py * sw + px) * 4
                            + channel
                        )

                        total += (
                            src[src_index] * weight
                        )

                        weight_total += weight

                if abs(weight_total) < 1e-12:
                    value = 0
                else:
                    value = round(
                        total / weight_total
                    )

                out[dst + channel] = max(
                    0,
                    min(255, value),
                )

    return out


def resize_bilinear(src, sw, sh, dw, dh):
    # Nome mantido por compatibilidade interna.
    # Desde V14.5 o launcher usa bicúbica Catmull-Rom.
    return resize_bicubic(
        src,
        sw,
        sh,
        dw,
        dh,
    )

def alpha_bbox(pixels, width, height, threshold=8):
    left = width
    top = height
    right = -1
    bottom = -1

    for y in range(height):
        for x in range(width):
            alpha = pixels[(y * width + x) * 4 + 3]

            if alpha > threshold:
                left = min(left, x)
                top = min(top, y)
                right = max(right, x)
                bottom = max(bottom, y)

    if right < left or bottom < top:
        raise RuntimeError("Master sem conteúdo visível.")

    return left, top, right + 1, bottom + 1


def crop_rgba(pixels, width, box):
    left, top, right, bottom = box
    cw = right - left
    ch = bottom - top
    out = bytearray(cw * ch * 4)

    for y in range(ch):
        src = ((top + y) * width + left) * 4
        dst = y * cw * 4
        out[dst:dst + cw * 4] = pixels[src:src + cw * 4]

    return cw, ch, out


def fit_transparent(src, sw, sh, size):
    scale = min(size / sw, size / sh)
    dw = max(1, round(sw * scale))
    dh = max(1, round(sh * scale))

    resized = resize_bilinear(src, sw, sh, dw, dh)
    canvas = bytearray((0, 0, 0, 0) * (size * size))

    left = (size - dw) // 2
    top = (size - dh) // 2

    for y in range(dh):
        src_start = y * dw * 4
        dst_start = ((top + y) * size + left) * 4

        canvas[
            dst_start:dst_start + dw * 4
        ] = resized[
            src_start:src_start + dw * 4
        ]

    return canvas


def flatten(src, width, height, background=BG):
    out = bytearray(width * height * 4)

    for i in range(width * height):
        p = i * 4
        alpha = src[p + 3] / 255.0

        out[p] = round(
            src[p] * alpha
            + background[0] * (1 - alpha)
        )
        out[p + 1] = round(
            src[p + 1] * alpha
            + background[1] * (1 - alpha)
        )
        out[p + 2] = round(
            src[p + 2] * alpha
            + background[2] * (1 - alpha)
        )
        out[p + 3] = 255

    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--master", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    master = Path(args.master)
    output = Path(args.output)
    output.mkdir(parents=True, exist_ok=True)

    width, height, pixels = read_rgba_png(master)

    if width != height:
        raise RuntimeError("Master precisa ser quadrado.")

    box = alpha_bbox(pixels, width, height)
    cw, ch, cropped = crop_rgba(pixels, width, box)

    size = 1024

    #
    # IMPORTANTE:
    # não existe mais multiplicador 0.72/0.80.
    # A área VISÍVEL do master ocupa o máximo possível do canvas.
    #
    foreground = fit_transparent(
        cropped,
        cw,
        ch,
        size,
    )

    background = bytearray(
        BG * (size * size)
    )

    full = flatten(
        foreground,
        size,
        size,
    )

    write_rgba_png(
        output / "icon-foreground.png",
        size,
        size,
        foreground,
    )

    write_rgba_png(
        output / "icon-background.png",
        size,
        size,
        background,
    )

    write_rgba_png(
        output / "icon.png",
        size,
        size,
        full,
    )

    write_rgba_png(
        output / "icon-maskable-1024x1024.png",
        size,
        size,
        full,
    )

    visible = alpha_bbox(
        foreground,
        size,
        size,
    )

    print(f"MASTER: {width}x{height}")
    print(f"MASTER ALPHA BBOX: {box}")
    print(f"CROPPED: {cw}x{ch}")
    print(f"FOREGROUND BBOX 1024: {visible}")
    print("SHRINK ARTIFICIAL: 0%")
    print("LAUNCHER ASSETS: OK")


if __name__ == "__main__":
    main()
