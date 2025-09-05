# management/commands/generate_lazy_loading_images.py

from django.core.management.base import BaseCommand
from django.db import transaction
from tasks.models import ProductImage
from tasks.utils.image_optimizer import ImageOptimizer
import os


class Command(BaseCommand):
    help = 'Generate compressed and thumbnail versions for existing product images'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate images even if they already exist',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=50,
            help='Number of images to process at once (default: 50)',
        )
        parser.add_argument(
            '--product-id',
            type=int,
            help='Process images for specific product ID only',
        )

    def handle(self, *args, **options):
        force = options['force']
        batch_size = options['batch_size']
        product_id = options['product_id']

        # Build queryset
        if product_id:
            images = ProductImage.objects.filter(product_id=product_id)
            self.stdout.write(f'Processing images for product ID {product_id}...')
        else:
            images = ProductImage.objects.all()
            self.stdout.write('Processing all product images...')

        # Filter based on force flag
        if not force:
            images = images.filter(
                models.Q(compressed_image='') | models.Q(thumbnail='')
            )
            self.stdout.write('Only processing images without compressed versions...')

        total = images.count()
        if total == 0:
            self.stdout.write(self.style.WARNING('No images to process.'))
            return

        self.stdout.write(f'Found {total} images to process.')

        processed = 0
        errors = 0
        total_original_size = 0
        total_compressed_size = 0

        # Process in batches
        for i in range(0, total, batch_size):
            batch = images[i:i + batch_size]

            with transaction.atomic():
                for image in batch:
                    try:
                        # Skip if image file doesn't exist
                        if not image.image or not image.image.name:
                            self.stdout.write(
                                self.style.WARNING(f'Skipping {image.id}: No image file')
                            )
                            continue

                        # Check if file exists on disk
                        if not os.path.exists(image.image.path):
                            self.stdout.write(
                                self.style.WARNING(f'Skipping {image.id}: File not found on disk')
                            )
                            continue

                        self.stdout.write(f'Processing image {image.id}: {image.alt_text}')

                        # Generate compressed versions
                        image.generate_compressed_versions()
                        image.save(update_fields=[
                            'compressed_image', 'thumbnail', 'original_size',
                            'compressed_size', 'thumbnail_size', 'compression_ratio'
                        ])

                        processed += 1

                        # Track size savings
                        if image.original_size and image.compressed_size:
                            total_original_size += image.original_size
                            total_compressed_size += image.compressed_size

                        self.stdout.write(
                            self.style.SUCCESS(f'✅ Processed {image.id} - Compression: {image.compression_ratio}%')
                        )

                    except Exception as e:
                        errors += 1
                        self.stdout.write(
                            self.style.ERROR(f'❌ Error processing {image.id}: {str(e)}')
                        )

                # Progress update
                self.stdout.write(f'Batch completed. Progress: {min(i + batch_size, total)}/{total}')

        # Final summary
        self.stdout.write('\n' + '=' * 50)
        self.stdout.write(f'Processing completed!')
        self.stdout.write(f'✅ Successfully processed: {processed} images')
        if errors > 0:
            self.stdout.write(f'❌ Errors: {errors} images')

        # Size savings summary
        if total_original_size > 0 and total_compressed_size > 0:
            total_saved = total_original_size - total_compressed_size
            savings_percent = (total_saved / total_original_size) * 100

            self.stdout.write(f'\n📊 Storage savings:')
            self.stdout.write(f'Original size: {self.format_bytes(total_original_size)}')
            self.stdout.write(f'Compressed size: {self.format_bytes(total_compressed_size)}')
            self.stdout.write(f'Space saved: {self.format_bytes(total_saved)} ({savings_percent:.1f}%)')

        self.stdout.write('=' * 50)

    def format_bytes(self, bytes_value):
        """Format bytes into human readable format"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if bytes_value < 1024:
                return f"{bytes_value:.1f} {unit}"
            bytes_value /= 1024
        return f"{bytes_value:.1f} TB"