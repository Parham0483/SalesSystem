from .settings import *
import os

# Override settings for Docker deployment
DEBUG = os.environ.get('DEBUG', '0') == '1'

# Production hosts
ALLOWED_HOSTS = [
    'gtc.market',
    'www.gtc.market',
    'localhost',
    '127.0.0.1',
    'backend',
]

# Database configuration for Docker
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DATABASE_NAME', 'salesDb'),
        'USER': os.environ.get('DATABASE_USER', 'salesuser'),
        'PASSWORD': os.environ.get('DATABASE_PASSWORD', 'parham.0770'),
        'HOST': os.environ.get('DATABASE_HOST', 'db'),
        'PORT': os.environ.get('DATABASE_PORT', '5432'),
    }
}

USE_HTTPS = os.environ.get('USE_HTTPS', 'True').lower() == 'true'
DJANGO_HANDLES_SSL = os.environ.get('DJANGO_HANDLES_SSL', 'False').lower() == 'true'

# SSL Configuration - separate redirect from security settings
if USE_HTTPS:
    # Always set security headers and cookie settings for HTTPS
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    # HSTS settings for security
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

    # Only redirect if Django is handling SSL directly
    if DJANGO_HANDLES_SSL:
        SECURE_SSL_REDIRECT = True
        USE_TLS = True
    else:
        SECURE_SSL_REDIRECT = False
        USE_TLS = False
else:
    # Development/HTTP settings
    SECURE_SSL_REDIRECT = False
    USE_TLS = False
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SECURE = False

CORS_ALLOWED_ORIGINS = [
    "https://gtc.market",
    "https://www.gtc.market",
    "http://gtc.market",  # Fallback for redirects
    "http://www.gtc.market",
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:80",
    "http://127.0.0.1:80",
    "http://localhost:3000",  # Development
    "http://127.0.0.1:3000",
]

# Update CSRF for HTTPS priority
CSRF_TRUSTED_ORIGINS = [
    "https://gtc.market",
    "https://www.gtc.market",
    "http://gtc.market",
    "http://www.gtc.market",
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:80",
    "http://127.0.0.1:80",
]

CORS_ALLOW_CREDENTIALS = True

# Enhanced CORS headers for production
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'access-control-allow-origin',
    'cache-control',
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# Static files for Docker
STATIC_ROOT = '/app/staticfiles'
MEDIA_URL =  '/media/'
MEDIA_ROOT = '/app/media'

FILE_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024  # 50MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024   # 50MB
ALLOWED_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']

# Security settings for production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Update frontend URL for production emails
FRONTEND_URL = 'https://gtc.market' if USE_HTTPS else 'http://localhost'

# Session settings
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

# Logging for debugging in production
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'tasks': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}