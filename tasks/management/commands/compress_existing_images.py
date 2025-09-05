from django.core.management.base import BaseCommand
from tasks.models import ProductImage



class Command(BaseCommand):
    help = 'Compress existing product images'

    def handle(self, *args, **options):
        images = ProductImage.objects.filter(compressed_image='')
        total = images.count()

        self.stdout.write(f'Processing {total} images...')

        for i, image in enumerate(images, 1):
            try:
                image.generate_compressed_versions()
                self.stdout.write(f'Processed {i}/{total}: {image.alt_text}')
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'Error processing {image.id}: {e}')
                )

        self.stdout.write(
            self.style.SUCCESS('Successfully compressed all images!')
        )