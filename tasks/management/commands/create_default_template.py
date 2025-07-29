# Create tasks/management/commands/create_default_template.py
from django.core.management.base import BaseCommand
from tasks.models import InvoiceTemplate, InvoiceTemplateField, InvoiceSection


class Command(BaseCommand):
    help = 'Create default Persian invoice template'

    def handle(self, *args, **options):
        # Create template
        template, created = InvoiceTemplate.objects.get_or_create(
            name='default_persian',
            defaults={
                'language': 'fa',
                'is_active': True,
                'company_info': {
                    'name': 'کیان تجارت پویا کویر',
                    'address': 'یزد، بلوار مدرس',
                    'phone': '021-12345678',
                    'email': 'gtc.1210770@gmail.com'
                },
                'font_family': 'Vazir',
                'page_size': 'A4'
            }
        )

        if created:
            self.stdout.write(self.style.SUCCESS('✅ Created default Persian invoice template'))
        else:
            self.stdout.write(self.style.WARNING('⚠️ Default template already exists'))

        return template