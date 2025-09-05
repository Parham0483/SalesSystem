from PIL import Image
import io
import os
from django.core.files.base import ContentFile


class ImageOptimizer:
    @staticmethod
    def create_optimized_versions(original_image_field):
        """
        Create optimized versions directly from ImageField
        Returns dict with ContentFile objects that can be assigned to ImageFields
        """
        if not original_image_field:
            return None

        try:
            # Open the original image
            img = Image.open(original_image_field)

            # Convert to RGB if needed
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background

            # 1. Create thumbnail (150x150)
            thumbnail_img = img.copy()
            thumbnail_img.thumbnail((250, 250), Image.Resampling.LANCZOS)

            thumb_io = io.BytesIO()
            thumbnail_img.save(thumb_io, format='JPEG', quality=85, optimize=True)
            thumb_io.seek(0)

            # 2. Create compressed version (max 1200px width)
            compressed_img = img.copy()
            if compressed_img.width > 1200:
                ratio = 1200 / compressed_img.width
                new_height = int(compressed_img.height * ratio)
                compressed_img = compressed_img.resize((1200, new_height), Image.Resampling.LANCZOS)

            comp_io = io.BytesIO()
            compressed_img.save(comp_io, format='JPEG', quality=85, optimize=True)
            comp_io.seek(0)

            # Get original filename without extension
            base_name = os.path.splitext(os.path.basename(original_image_field.name))[0]

            # FIXED: Let Django's upload_to handle the path - don't duplicate it
            thumbnail_file = ContentFile(
                thumb_io.getvalue(),
                name=f"{base_name}_thumb.jpg"  # Just the filename - Django adds upload_to path
            )

            compressed_file = ContentFile(
                comp_io.getvalue(),
                name=f"{base_name}_comp.jpg"  # Just the filename - Django adds upload_to path
            )

            return {
                'thumbnail': thumbnail_file,
                'compressed': compressed_file,
                'original_size': original_image_field.size if hasattr(original_image_field, 'size') else 0,
                'thumbnail_size': len(thumb_io.getvalue()),
                'compressed_size': len(comp_io.getvalue())
            }

        except Exception as e:
            print(f"Error creating optimized versions: {e}")
            return None