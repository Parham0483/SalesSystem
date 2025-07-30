# Create a data migration file
# Run: python manage.py makemigrations --empty tasks
# Then replace the content with this:

from django.db import migrations


def create_default_categories(apps, schema_editor):
    ProductCategory = apps.get_model('tasks', 'ProductCategory')

    categories = [
        {
            'name': 'Coffee Related',
            'slug': 'coffee-related',
            'description': 'Coffee beans, coffee makers, and coffee accessories',
            'order': 1
        },
        {
            'name': 'Seeds',
            'slug': 'seeds',
            'description': 'Various types of seeds for planting and consumption',
            'order': 2
        },
        {
            'name': 'Spices',
            'slug': 'spices',
            'description': 'Spices and seasonings from around the world',
            'order': 3
        },
        {
            'name': 'Nuts',
            'slug': 'nuts',
            'description': 'Various types of nuts and dried fruits',
            'order': 4
        },
        {
            'name': 'Confectionery ',

            'slug': 'confectionery',
            'description': 'Confectionery products',
            'order': 5
        }

    ]

    for cat_data in categories:
        ProductCategory.objects.get_or_create(
            slug=cat_data['slug'],
            defaults=cat_data
        )


def remove_default_categories(apps, schema_editor):
    ProductCategory = apps.get_model('tasks', 'ProductCategory')
    slugs = ['coffee-related', 'seeds', 'spices', 'nuts']
    ProductCategory.objects.filter(slug__in=slugs).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('tasks', '0001_initial'),  # Replace with your latest migration
    ]

    operations = [
        migrations.RunPython(create_default_categories, remove_default_categories),
    ]