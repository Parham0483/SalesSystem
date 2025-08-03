from .settings import *
import os

# Override settings for Docker deployment
DEBUG = False
ALLOWED_HOSTS = ['*']  # For now, we'll restrict this later

# Database configuration for Docker
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DATABASE_NAME', 'salesDb'),
        'USER': os.environ.get('DATABASE_USER', 'salesuser'),
        'PASSWORD': os.environ.get('DATABASE_PASSWORD', 'yourpassword'),
        'HOST': os.environ.get('DATABASE_HOST', 'db'),
        'PORT': os.environ.get('DATABASE_PORT', '5432'),
    }
}

# CORS settings for Docker
CORS_ALLOWED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:80",
    "http://127.0.0.1:80",
]

CORS_ALLOW_ALL_ORIGINS = True  # For development - we'll restrict this later
CORS_ALLOW_CREDENTIALS = True

# Update CSRF settings
CSRF_TRUSTED_ORIGINS = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:80",
    "http://127.0.0.1:80",
]

# Static files for Docker
STATIC_ROOT = '/app/staticfiles'
MEDIA_ROOT = '/app/media'
