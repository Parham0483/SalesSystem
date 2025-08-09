from .settings import *
import os

# Override settings for Docker deployment
DEBUG = False

# Production hosts
ALLOWED_HOSTS = [
    'gtc.market',
    'www.gtc.market',
    'localhost',
    '127.0.0.1',
    'backend',  # Docker internal
]

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

# CORS settings for production
CORS_ALLOWED_ORIGINS = [
    "https://gtc.market",
    "https://www.gtc.market",
    "http://gtc.market",  # If you allow HTTP redirects
    "http://www.gtc.market",
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:80",
    "http://127.0.0.1:80",
    "http://localhost:3000",  # For development
    "http://127.0.0.1:3000",
]

CORS_ALLOW_CREDENTIALS = True

# Update CSRF settings for production
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
    'x-requested-with',
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
MEDIA_ROOT = '/app/media'

# Security settings for production
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# Update frontend URL for production emails
FRONTEND_URL = 'https://gtc.market'

# Session settings
SESSION_COOKIE_SECURE = False  # Set to True when using HTTPS only
CSRF_COOKIE_SECURE = False     # Set to True when using HTTPS only
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