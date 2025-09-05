# management/commands/regenerate_broken_images.py
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage
from tasks.models import ProductImage
import os


class Command(BaseCommand):
    help = 'Regenerate thumbnails and compressed images for broken ProductImages'

    def add_arguments(self, parser):
        parser.add_argument(
            '--check-only',
            action='store_true',
            help='Only check which images are broken, do not fix',
        )

    def handle(self, *args, **options):
        check_only = options['check_only']

        # Find all product images
        all_images = ProductImage.objects.all()

        broken_images = []
        fixed_count = 0

        for image in all_images:
            is_broken = False
            issues = []

            # Check if thumbnail exists and is accessible
            if image.thumbnail:
                if not default_storage.exists(image.thumbnail.name):
                    is_broken = True
                    issues.append(f"Thumbnail missing: {image.thumbnail.name}")
            else:
                issues.append("No thumbnail field")

            # Check if compressed image exists and is accessible
            if image.compressed_image:
                if not default_storage.exists(image.compressed_image.name):
                    is_broken = True
                    issues.append(f"Compressed missing: {image.compressed_image.name}")
            else:
                issues.append("No compressed field")

            # Check if original image exists
            if image.image:
                if not default_storage.exists(image.image.name):
                    is_broken = True
                    issues.append(f"Original missing: {image.image.name}")
            else:
                is_broken = True
                issues.append("No original image")

            if is_broken or not image.thumbnail or not image.compressed_image:
                broken_images.append({
                    'id': image.id,
                    'product_name': image.product.name if image.product else 'No product',
                    'issues': issues,
                    'image': image
                })

        self.stdout.write(f"Found {len(broken_images)} broken/incomplete images:")

        for broken in broken_images:
            self.stdout.write(f"  Image {broken['id']} ({broken['product_name']}): {', '.join(broken['issues'])}")

        if check_only:
            return

        # Fix the broken images
        self.stdout.write(f"\nAttempting to regenerate {len(broken_images)} images...")

        for broken in broken_images:
            image = broken['image']

            try:
                # Only regenerate if we have an original image
                if image.image and default_storage.exists(image.image.name):
                    self.stdout.write(f"Regenerating image {image.id}...")

                    # Clear existing compressed versions
                    image.compressed_image = None
                    image.thumbnail = None

                    # Regenerate
                    image.generate_compressed_versions()
                    image.save()

                    fixed_count += 1
                    self.stdout.write(self.style.SUCCESS(f"✅ Fixed image {image.id}"))
                else:
                    self.stdout.write(self.style.ERROR(f"❌ Cannot fix image {image.id} - no original file"))

            except Exception as e:
                self.stdout.write(self.style.ERROR(f"❌ Error fixing image {image.id}: {str(e)}"))

        self.stdout.write(f"\n✅ Successfully regenerated {fixed_count} images")