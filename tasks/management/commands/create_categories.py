# tasks/management/commands/create_categories.py
from django.core.management.base import BaseCommand
from tasks.models import ProductCategory
from django.utils.text import slugify


class Command(BaseCommand):
    help = 'Create default product categories with Persian names'

    def handle(self, *args, **options):
        categories = [
            {
                'name': 'Coffee Related',
                'name_fa': 'محصولات قهوه',
                'description': 'Coffee beans, equipment, and related products',
                'order': 1
            },
            {
                'name': 'Seeds',
                'name_fa': 'دانه‌ها',
                'description': 'Various types of seeds and grains',
                'order': 2
            },
            {
                'name': 'Spices',
                'name_fa': 'ادویه‌جات',
                'description': 'Spices and seasonings from around the world',
                'order': 3
            },
            {
                'name': 'Nuts',
                'name_fa': 'آجیل',
                'description': 'Fresh and dried nuts varieties',
                'order': 4
            },
            {
                'name': 'Confectionery products',
                'name_fa': 'محصولات قنادی',
                'description': 'Sweets, confectionery, and baking ingredients',
                'order': 5
            },
        ]

        created_count = 0
        updated_count = 0

        for cat_data in categories:
            # Generate slug from English name
            slug = slugify(cat_data['name'])

            category, created = ProductCategory.objects.get_or_create(
                name=cat_data['name'],
                defaults={
                    'name_fa': cat_data['name_fa'],
                    'description': cat_data['description'],
                    'slug': slug,
                    'order': cat_data['order'],
                    'is_active': True
                }
            )

            if created:
                created_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f'✅ Created category: {category.name} ({category.name_fa})')
                )
            else:
                # Update existing category with Persian name if missing
                if not category.name_fa:
                    category.name_fa = cat_data['name_fa']
                    category.description = cat_data['description']
                    category.order = cat_data['order']
                    category.save()
                    updated_count += 1
                    self.stdout.write(
                        self.style.WARNING(f'⚠️ Updated category: {category.name} ({category.name_fa})')
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(f'⚠️ Category already exists: {category.name} ({category.name_fa})')
                    )

        self.stdout.write(
            self.style.SUCCESS(f'\n🎯 Summary: {created_count} created, {updated_count} updated')
        )

        # Show all categories
        self.stdout.write('\n📋 All categories:')
        for category in ProductCategory.objects.filter(is_active=True).order_by('order'):
            self.stdout.write(f'  {category.id}: {category.name} ({category.name_fa})')