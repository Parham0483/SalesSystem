from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.conf import settings
import os


class Command(BaseCommand):
    help = 'Setup production environment for password reset functionality'

    def handle(self, *args, **options):
        self.stdout.write('Setting up production environment...')

        # Create cache table if using database cache
        if 'DatabaseCache' in str(settings.CACHES['default']['BACKEND']):
            self.stdout.write('Creating cache table...')
            try:
                call_command('createcachetable')
                self.stdout.write(self.style.SUCCESS('✅ Cache table created successfully'))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'❌ Error creating cache table: {e}'))

        # Check required environment variables
        required_env_vars = [
            'EMAIL_HOST_USER',
            'EMAIL_HOST_PASSWORD',
            'SECRET_KEY',
        ]

        missing_vars = []
        for var in required_env_vars:
            if not os.environ.get(var):
                missing_vars.append(var)

        if missing_vars:
            self.stdout.write(self.style.ERROR(f'❌ Missing required environment variables: {", ".join(missing_vars)}'))
        else:
            self.stdout.write(self.style.SUCCESS('✅ All required environment variables are set'))

        # Check optional SMS settings
        if not os.environ.get('KAVENEGAR_API_KEY'):
            self.stdout.write(self.style.WARNING('⚠️ KAVENEGAR_API_KEY not set - SMS notifications will be disabled'))

        self.stdout.write(self.style.SUCCESS('✅ Production setup completed'))