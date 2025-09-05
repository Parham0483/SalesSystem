# management/commands/fix_image_paths.py
from django.core.management.base import BaseCommand
from django.db import transaction
from django.core.files.storage import default_storage
from tasks.models import ProductImage
import os
import shutil


class Command(BaseCommand):
    help = 'Fix ProductImage paths that are missing directory structure'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without actually changing anything',
        )
        parser.add_argument(
            '--fix-thumbnails',
            action='store_true',
            help='Fix thumbnail paths specifically',
        )
        parser.add_argument(
            '--fix-compressed',
            action='store_true',
            help='Fix compressed image paths specifically',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        fix_thumbnails = options['fix_thumbnails']
        fix_compressed = options['fix_compressed']

        if not fix_thumbnails and not fix_compressed:
            self.stdout.write("Please specify --fix-thumbnails or --fix-compressed")
            return

        # Find images with incorrect paths
        problematic_images = ProductImage.objects.all()

        if fix_thumbnails:
            self.stdout.write("Checking thumbnail paths...")
            self.fix_field_paths(
                problematic_images,
                'thumbnail',
                'products/thumbnails/',
                dry_run
            )

        if fix_compressed:
            self.stdout.write("Checking compressed image paths...")
            self.fix_field_paths(
                problematic_images,
                'compressed_image',
                'products/compressed/',
                dry_run
            )

    def fix_field_paths(self, queryset, field_name, correct_prefix, dry_run):
        fixed_count = 0
        error_count = 0

        for image in queryset:
            field_value = getattr(image, field_name)

            if not field_value:
                continue

            current_path = field_value.name

            # Check if path is missing the correct prefix
            if current_path and not current_path.startswith(correct_prefix):
                # Extract just the filename
                filename = os.path.basename(current_path)
                new_path = f"{correct_prefix}{filename}"

                self.stdout.write(
                    f"Image {image.id}: '{current_path}' -> '{new_path}'"
                )

                if not dry_run:
                    try:
                        # Check if old file exists
                        if default_storage.exists(current_path):
                            # Ensure directory exists
                            new_dir = os.path.dirname(new_path)
                            if not default_storage.exists(new_dir):
                                # Create directory structure
                                os.makedirs(
                                    os.path.join(default_storage.location, new_dir),
                                    exist_ok=True
                                )

                            # Move file to correct location
                            old_file_path = default_storage.path(current_path)
                            new_file_path = default_storage.path(new_path)

                            # Copy file to new location
                            shutil.copy2(old_file_path, new_file_path)

                            # Update database record
                            setattr(image, field_name, new_path)
                            image.save(update_fields=[field_name])

                            # Remove old file
                            default_storage.delete(current_path)

                            fixed_count += 1
                            self.stdout.write(
                                self.style.SUCCESS(f"✅ Fixed image {image.id}")
                            )
                        else:
                            # File doesn't exist - just update database
                            setattr(image, field_name, new_path)
                            image.save(update_fields=[field_name])
                            fixed_count += 1
                            self.stdout.write(
                                self.style.WARNING(f"⚠️ File not found, updated DB only: {image.id}")
                            )

                    except Exception as e:
                        error_count += 1
                        self.stdout.write(
                            self.style.ERROR(f"❌ Error fixing image {image.id}: {str(e)}")
                        )

        # Summary
        self.stdout.write("\n" + "=" * 50)
        if dry_run:
            self.stdout.write("DRY RUN - No changes made")
        else:
            self.stdout.write(f"✅ Fixed: {fixed_count} images")
            if error_count > 0:
                self.stdout.write(f"❌ Errors: {error_count} images")
        self.stdout.write("=" * 50)