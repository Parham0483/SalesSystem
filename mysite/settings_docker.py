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
    'backend',  # Docker internal
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

if USE_HTTPS or not DEBUG:
    # HTTPS configuration
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    USE_TLS = True

    # Update session and CSRF cookies for HTTPS
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    # HSTS settings for security
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

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
if USE_HTTPS or not DEBUG:
    MEDIA_URL = 'https://gtc.market/media/'
else:
    MEDIA_URL = '/media/'


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
