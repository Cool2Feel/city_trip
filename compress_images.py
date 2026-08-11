#!/usr/bin/env python3
"""Compress theme images for WeChat Mini Program (main package 2MB limit)"""
import os
from PIL import Image

images_dir = r"D:\dwl\work\todo\city_trip\miniprogram\assets\images"

# Compression config: (filename, max_width, max_height, quality, save_format)
configs = [
    ("home-banner.png", 750, 375, 85, "JPEG"),    # 首页banner: 750x375 JPEG
    ("route-art.png", 400, 300, 85, "JPEG"),       # 文艺路线封面: 400x300 JPEG
    ("route-romance.png", 400, 300, 85, "JPEG"),   # 情侣路线封面: 400x300 JPEG
    ("route-family.png", 400, 300, 85, "JPEG"),    # 亲子路线封面: 400x300 JPEG
    ("logo.png", 200, 200, 90, "PNG"),             # Logo: 200x200 PNG (保留透明通道)
]

print("=" * 60)
print("WeChat Mini Program Image Compression")
print("=" * 60)

total_before = 0
total_after = 0

for filename, max_w, max_h, quality, fmt in configs:
    filepath = os.path.join(images_dir, filename)
    if not os.path.exists(filepath):
        print(f"  SKIP: {filename} not found")
        continue

    size_before = os.path.getsize(filepath)
    total_before += size_before

    img = Image.open(filepath)
    # Handle RGBA -> RGB for JPEG
    if fmt == "JPEG" and img.mode in ("RGBA", "LA", "P"):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        bg.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
        img = bg

    # Resize maintaining aspect ratio, fitting within max_w x max_h
    img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

    # Save
    if fmt == "JPEG":
        img.save(filepath.rsplit(".", 1)[0] + ".jpg", "JPEG", quality=quality, optimize=True)
        # Remove original PNG
        if filename.endswith(".png"):
            os.remove(filepath)
        new_file = filename.rsplit(".", 1)[0] + ".jpg"
    else:
        img.save(filepath, "PNG", optimize=True)
        new_file = filename

    new_path = os.path.join(images_dir, new_file)
    size_after = os.path.getsize(new_path)
    total_after += size_after

    ratio = (1 - size_after / size_before) * 100
    print(f"  {filename:25s} {size_before/1024:8.1f}KB -> {new_file:25s} {size_after/1024:8.1f}KB  (-{ratio:.0f}%)")

print("-" * 60)
print(f"  Total: {total_before/1024/1024:.2f}MB -> {total_after/1024/1024:.2f}MB  (-{(1-total_after/total_before)*100:.0f}%)")
print(f"  Main package budget: 2.00MB  |  Images: {total_after/1024/1024:.2f}MB  |  Status: {'OK' if total_after < 1.5*1024*1024 else 'WARN'}")
print("=" * 60)

# List final images
print("\nFinal images:")
for f in sorted(os.listdir(images_dir)):
    fpath = os.path.join(images_dir, f)
    print(f"  {f:30s} {os.path.getsize(fpath)/1024:.1f}KB")
