# management/commands/fix_double_paths.py
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage
from tasks.models import ProductImage
import os
import shutil


class Command(BaseCommand):
    help = 'Fix double path issue in ProductImage thumbnails and compressed images'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without actually changing anything',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        self.stdout.write("Scanning for double-path issues...")

        problematic_images = []

        # Check all ProductImages
        for image in ProductImage.objects.all():
            issues = []

            # Check thumbnail field
            if image.thumbnail and image.thumbnail.name:
                thumb_path = image.thumbnail.name
                if thumb_path.count('products/thumbnails/') > 1:
                    issues.append({
                        'field': 'thumbnail',
                        'current_path': thumb_path,
                        'correct_path': thumb_path.replace('products/thumbnails/products/thumbnails/',
                                                           'products/thumbnails/'),
                        'file_exists': default_storage.exists(thumb_path)
                    })

            # Check compressed image field
            if image.compressed_image and image.compressed_image.name:
                comp_path = image.compressed_image.name
                if comp_path.count('products/compressed/') > 1:
                    issues.append({
                        'field': 'compressed_image',
                        'current_path': comp_path,
                        'correct_path': comp_path.replace('products/compressed/products/compressed/',
                                                          'products/compressed/'),
                        'file_exists': default_storage.exists(comp_path)
                    })

            if issues:
                problematic_images.append({
                    'image': image,
                    'issues': issues
                })

        if not problematic_images:
            self.stdout.write(self.style.SUCCESS("No double-path issues found!"))
            return

        self.stdout.write(f"Found {len(problematic_images)} images with double-path issues:")

        fixed_count = 0
        error_count = 0

        for problem in problematic_images:
            image = problem['image']

            self.stdout.write(f"\nImage {image.id} (Product: {image.product.name if image.product else 'None'}):")

            for issue in problem['issues']:
                field_name = issue['field']
                current_path = issue['current_path']
                correct_path = issue['correct_path']
                file_exists = issue['file_exists']

                self.stdout.write(f"  {field_name}: {current_path} -> {correct_path}")

                if not dry_run:
                    try:
                        if file_exists:
                            # File exists at the double path - move it to correct location

                            # Ensure target directory exists
                            target_dir = os.path.dirname(correct_path)
                            target_dir_full = os.path.join(default_storage.location, target_dir)
                            os.makedirs(target_dir_full, exist_ok=True)

                            # Check if correct path already has a file
                            if default_storage.exists(correct_path):
                                # Remove the correct file (we'll replace it)
                                default_storage.delete(correct_path)

                            # Move file to correct location
                            current_full_path = default_storage.path(current_path)
                            correct_full_path = default_storage.path(correct_path)

                            shutil.move(current_full_path, correct_full_path)

                            self.stdout.write(f"    ✅ Moved file from {current_path} to {correct_path}")
                        else:
                            self.stdout.write(f"    ⚠️ File doesn't exist at {current_path}, updating DB only")

                        # Update database field
                        setattr(image, field_name, correct_path)
                        image.save(update_fields=[field_name])

                        fixed_count += 1

                    except Exception as e:
                        error_count += 1
                        self.stdout.write(
                            self.style.ERROR(f"    ❌ Error fixing {field_name}: {str(e)}")
                        )
                else:
                    self.stdout.write(f"    [DRY RUN] Would fix: {current_path} -> {correct_path}")

        # Summary
        self.stdout.write("\n" + "=" * 60)
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN COMPLETED - No changes made"))
        else:
            self.stdout.write(f"✅ Fixed: {fixed_count} fields")
            if error_count > 0:
                self.stdout.write(f"❌ Errors: {error_count} fields")

        self.stdout.write(f"Total images with issues: {len(problematic_images)}")
        self.stdout.write("=" * 60)