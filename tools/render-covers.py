#!/usr/bin/env python3
"""Shape bilingual text with Pango/HarfBuzz and emit portable SVG glyph outlines.

Only Python's standard library is required. Native libraries: Cairo, Pango,
librsvg, GLib, fontconfig (provided by Ubuntu and the documented CI workflow).
Input/output are JSON over stdin/stdout; failures are reported per book.
"""
import ctypes as C
import ctypes.util
import hashlib
import html
import io
import json
import re
import sys
from pathlib import Path


def library(name):
    path = ctypes.util.find_library(name)
    if not path:
        raise RuntimeError(f"Missing native library {name}; see AUTOMATIC_COVERS.md")
    return C.CDLL(path)


def function(lib, name, result, *arguments):
    call = getattr(lib, name)
    call.restype, call.argtypes = result, list(arguments)
    return call


class Renderer:
    def __init__(self, font_directory):
        p, i, d, b, s = C.c_void_p, C.c_int, C.c_double, C.c_int, C.c_char_p
        cairo, pango, pc, rsvg, gobject, fc = [library(n) for n in
            ("cairo", "pango-1.0", "pangocairo-1.0", "rsvg-2", "gobject-2.0", "fontconfig")]
        self.svg_surface = function(cairo, "cairo_svg_surface_create", p, s, d, d)
        self.image_surface = function(cairo, "cairo_image_surface_create", p, i, i, i)
        self.create = function(cairo, "cairo_create", p, p)
        self.destroy = function(cairo, "cairo_destroy", None, p)
        self.surface_destroy = function(cairo, "cairo_surface_destroy", None, p)
        self.finish = function(cairo, "cairo_surface_finish", None, p)
        self.surface_status = function(cairo, "cairo_surface_status", i, p)
        self.status = function(cairo, "cairo_status", i, p)
        self.png = function(cairo, "cairo_surface_write_to_png", i, p, s)
        self.move = function(cairo, "cairo_move_to", None, p, d, d)
        self.line_to = function(cairo, "cairo_line_to", None, p, d, d)
        self.rectangle = function(cairo, "cairo_rectangle", None, p, d, d, d, d)
        self.fill = function(cairo, "cairo_fill", None, p)
        self.stroke = function(cairo, "cairo_stroke", None, p)
        self.line_width = function(cairo, "cairo_set_line_width", None, p, d)
        self.source = function(cairo, "cairo_set_source_rgba", None, p, d, d, d, d)
        self.save = function(cairo, "cairo_save", None, p)
        self.restore = function(cairo, "cairo_restore", None, p)
        self.translate = function(cairo, "cairo_translate", None, p, d, d)
        self.scale = function(cairo, "cairo_scale", None, p, d, d)
        self.layout = function(pc, "pango_cairo_create_layout", p, p)
        self.layout_path = function(pc, "pango_cairo_layout_path", None, p, p)
        self.layout_context = function(pango, "pango_layout_get_context", p, p)
        self.base_dir = function(pango, "pango_context_set_base_dir", None, p, i)
        self.auto_dir = function(pango, "pango_layout_set_auto_dir", None, p, b)
        self.set_text = function(pango, "pango_layout_set_text", None, p, s, i)
        self.set_width = function(pango, "pango_layout_set_width", None, p, i)
        self.set_height = function(pango, "pango_layout_set_height", None, p, i)
        self.set_wrap = function(pango, "pango_layout_set_wrap", None, p, i)
        self.set_spacing = function(pango, "pango_layout_set_spacing", None, p, i)
        self.set_alignment = function(pango, "pango_layout_set_alignment", None, p, i)
        self.set_ellipsize = function(pango, "pango_layout_set_ellipsize", None, p, i)
        self.set_font = function(pango, "pango_layout_set_font_description", None, p, p)
        self.font = function(pango, "pango_font_description_from_string", p, s)
        self.font_size = function(pango, "pango_font_description_set_absolute_size", None, p, d)
        self.font_free = function(pango, "pango_font_description_free", None, p)
        self.line_count = function(pango, "pango_layout_get_line_count", i, p)
        self.pixel_size = function(pango, "pango_layout_get_pixel_size", None, p, C.POINTER(i), C.POINTER(i))
        self.unknown_glyphs = function(pango, "pango_layout_get_unknown_glyphs_count", i, p)
        self.handle = function(rsvg, "rsvg_handle_new_from_data", p, s, C.c_size_t, p)
        self.render_svg = function(rsvg, "rsvg_handle_render_cairo", b, p, p)
        self.unref = function(gobject, "g_object_unref", None, p)
        config = function(fc, "FcConfigGetCurrent", p)()
        add_font = function(fc, "FcConfigAppFontAddFile", b, p, s)
        for name in ("DejaVuSans.ttf", "DejaVuSans-Bold.ttf"):
            if not add_font(config, str(Path(font_directory) / name).encode()):
                raise RuntimeError(f"Could not load bundled font: {name}")

    def color(self, cr, color, alpha=1):
        self.source(cr, *(int(color[x:x + 2], 16) / 255 for x in (1, 3, 5)), alpha)

    def box(self, cr, x, y, width, height, color, alpha=1):
        self.color(cr, color, alpha)
        self.rectangle(cr, x, y, width, height)
        self.fill(cr)

    def prepare(self, cr, value, size, minimum, lines, rtl=False, bold=False, center=False):
        layout = self.layout(cr)
        self.base_dir(self.layout_context(layout), 1 if rtl else 0)
        self.auto_dir(layout, False)
        self.set_text(layout, value.encode(), -1)
        self.set_width(layout, 504 * 1024)
        self.set_wrap(layout, 2)  # WORD_CHAR also handles unbroken technical names.
        self.set_alignment(layout, 1 if center else (2 if rtl else 0))
        desc = self.font(b"DejaVu Sans Bold" if bold else b"DejaVu Sans")
        while True:
            self.font_size(desc, size * 1024)
            self.set_font(layout, desc)
            self.set_spacing(layout, int(size * .12 * 1024))
            if self.line_count(layout) <= lines or size <= minimum:
                break
            size -= 1
        truncated = self.line_count(layout) > lines
        self.set_height(layout, -lines)
        self.set_ellipsize(layout, 3)  # END. Full metadata remains in <desc> and HTML.
        w, h = C.c_int(), C.c_int()
        self.pixel_size(layout, C.byref(w), C.byref(h))
        self.font_free(desc)
        return {"layout": layout, "height": h.value, "size": size,
                "truncated": truncated, "unknown_glyphs": self.unknown_glyphs(layout)}

    def draw_text(self, cr, prepared, y, color):
        self.color(cr, color)
        self.move(cr, 48, y)
        self.layout_path(cr, prepared["layout"])
        self.fill(cr)

    def vector(self, cr, markup, x=0, y=0, scale_x=1, scale_y=1):
        encoded = markup.encode()
        handle = self.handle(encoded, len(encoded), None)
        if not handle:
            raise RuntimeError("Could not parse generated vector artwork")
        self.save(cr)
        self.translate(cr, x, y)
        self.scale(cr, scale_x, scale_y)
        success = self.render_svg(handle, cr)
        self.restore(cr)
        self.unref(handle)
        if not success:
            raise RuntimeError("Could not render generated vector artwork")

    def cover(self, item):
        model, destination = item["model"], Path(item["destination"])
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(".tmp.svg")
        surface = self.svg_surface(str(temporary).encode(), 600, 900)
        cr = self.create(surface)
        layouts = []
        try:
            bg, ink, accent = model["palette"]
            self.box(cr, 0, 0, 600, 900, bg)
            composition = model["composition"]
            if composition == 0:
                self.color(cr, ink, .23); self.line_width(cr, 1)
                self.rectangle(cr, 19, 19, 562, 862); self.stroke(cr)
            elif composition == 1:
                self.box(cr, 0, 0, 10, 900, accent)
                self.box(cr, 0, 0, 600, 5, accent)
            elif composition == 2:
                self.box(cr, 0, 864, 600, 36, ink, .12)
                self.box(cr, 35, 37, 32, 4, accent)
            else:
                self.box(cr, 552, 0, 48, 900, ink, .075)
                self.box(cr, 48, 875, 92, 3, accent)

            category = self.prepare(cr, model["category"], 19, 18, 1, rtl=True)
            label = self.prepare(cr, model["subject_en"], 13, 13, 1)
            layouts.extend([category, label])
            self.draw_text(cr, category, 35, ink)
            self.draw_text(cr, label, 61, ink)
            titles = []
            if model["title_ar"]:
                titles.append(self.prepare(cr, model["title_ar"], 39, 30, 4, rtl=True, bold=True, center=composition == 2))
            if model["title_en"]:
                titles.append(self.prepare(cr, model["title_en"], 27, 22, 4, center=composition == 2))
            if model["subtitle"]:
                titles.append(self.prepare(cr, model["subtitle"], 20, 19, 2, rtl=bool(re.search(r"[\u0600-\u06ff]", model["subtitle"]))))
            if model["edition"]:
                titles.append(self.prepare(cr, model["edition"], 18, 18, 1))
            authors = []
            if model["author_ar"]:
                authors.append(self.prepare(cr, model["author_ar"], 23, 20, 2, rtl=True))
            if model["author_en"]:
                authors.append(self.prepare(cr, model["author_en"], 21, 18, 3))
            layouts.extend(titles + authors)
            y = 103
            for title in titles:
                self.draw_text(cr, title, y, "#fffaf0" if title is titles[0] else ink)
                y += title["height"] + 12
            total_authors = sum(a["height"] + 8 for a in authors)
            author_top = 847 - total_authors
            art_top, art_bottom = y + 3, author_top - 33
            art_height = max(0, min(314, art_bottom - art_top))
            if art_height:
                self.vector(cr, item["artwork"], 24, art_top + max(0, (art_bottom - art_top - art_height) / 2), .92, art_height / 320)
            self.box(cr, 48, author_top - 17, 504, 1, ink, .32)
            for author in authors:
                self.draw_text(cr, author, author_top, "#fffaf0")
                author_top += author["height"] + 8
            footer = self.prepare(cr, "العلم بالعربي  ·  غلاف عرض أصلي", 13, 13, 1, rtl=True)
            layouts.append(footer)
            self.draw_text(cr, footer, 864, ink)
            if self.status(cr) or self.surface_status(surface):
                raise RuntimeError("Cairo reported a drawing error")
            self.finish(surface)
        finally:
            for layout in layouts:
                self.unref(layout["layout"])
            self.destroy(cr)
            self.surface_destroy(surface)
        svg = temporary.read_text()
        # Cairo's global surface IDs depend on generation order. Canonicalize them.
        identifiers = re.findall(r'\bid="([^"]+)"', svg)
        for index, identifier in enumerate(identifiers):
            svg = svg.replace(f'id="{identifier}"', f'id="c{index}"')
            svg = svg.replace(f'#{identifier}"', f'#c{index}"').replace(f'#{identifier})', f'#c{index})')
        # Two decimal vector coordinates retain subpixel precision at display size.
        def simplify_tag(match):
            return re.sub(r'(?<![A-Za-z#])[-+]?(?:\d+\.\d+(?:e[-+]?\d+)?|\d+e[-+]?\d+)',
                          lambda n: format(round(float(n[0]), 2), 'g'), match[0], flags=re.I)
        svg = re.sub(r'<(?![?!])[^>]+>', simplify_tag, svg)
        title = model["title_ar"] or model["title_en"]
        description = " | ".join(filter(None, [model["title_ar"], model["title_en"], model["author_ar"], model["author_en"], model["category"], "Original website display cover; not publisher artwork."]))
        svg = re.sub(r'(<svg\b[^>]*)(>)', r'\1 role="img" aria-labelledby="cover-title cover-desc"\2', svg, count=1)
        svg = re.sub(r'(<svg\b[^>]*>)', lambda m: m[0] + f'<title id="cover-title">{html.escape(title)}</title><desc id="cover-desc">{html.escape(description)}</desc>', svg, count=1)
        destination.write_text(svg)
        temporary.unlink()
        derivatives = {}
        try:
            from PIL import Image
        except ImportError:
            pass  # SVG stays usable; CI installs Pillow for compact WebP derivatives.
        else:
            png = destination.with_suffix('.preview.png')
            self.render_png(destination, png, 600, 900)
            with Image.open(png) as image:
                image = image.convert('RGB')
                for width, suffix in [(600, '.webp'), (360, '-360.webp')]:
                    file = destination.with_name(destination.stem + suffix)
                    scaled = image if width == 600 else image.resize((360, 540), Image.Resampling.LANCZOS)
                    buffer = io.BytesIO()
                    scaled.save(buffer, 'WEBP', quality=86, method=4)
                    payload = buffer.getvalue()
                    if not payload:
                        raise RuntimeError('WebP encoder returned an empty image')
                    staging = file.with_suffix('.tmp.webp')
                    staging.write_bytes(payload)
                    staging.replace(file)
                    derivatives[file.name] = hashlib.sha256(file.read_bytes()).hexdigest()
            png.unlink()
        return {"id": model["id"], "ok": True, "bytes": destination.stat().st_size,
                "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
                "derivatives": derivatives,
                "layout": {"title_bottom": y, "author_top": 847 - total_authors,
                           "art_height": art_height, "compact_title": any(t["truncated"] for t in titles),
                           "compact_authors": any(a["truncated"] for a in authors),
                           "unknown_glyphs": sum(a["unknown_glyphs"] for a in layouts),
                           "minimum_title_font": min(t["size"] for t in titles)}}

    def render_png(self, source, destination, width=300, height=450):
        surface = self.image_surface(0, width, height)
        cr = self.create(surface)
        try:
            self.vector(cr, Path(source).read_text(), 0, 0, width / 600, height / 900)
            if self.png(surface, str(destination).encode()):
                raise RuntimeError("Could not write cover preview PNG")
        finally:
            self.destroy(cr); self.surface_destroy(surface)


def main():
    request = json.load(sys.stdin)
    try:
        renderer = Renderer(request["font_directory"])
    except Exception as error:
        print(json.dumps({"results": [{"id": item["model"]["id"], "ok": False, "error": str(error)} for item in request.get("covers", [])]}))
        return
    results = []
    for item in request.get("covers", []):
        try:
            results.append(renderer.cover(item))
        except Exception as error:
            results.append({"id": item["model"]["id"], "ok": False, "error": str(error)})
    print(json.dumps({"results": results}))


if __name__ == "__main__":
    main()
