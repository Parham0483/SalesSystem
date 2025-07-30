# mysite/settings.py - Updated email settings

import os
import ssl
import certifi
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = 'django-insecure-ggs@f%*u5l%^k%#--3lc!ww$ujs+(pe^d38@mqf(!)7k6qz15l'

DEBUG = True

ALLOWED_HOSTS = ['*']

# Custom user model
AUTH_USER_MODEL = 'tasks.Customer'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt',  # Added explicitly
    'corsheaders',
    'tasks',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'mysite.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'mysite.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'salesDb',
        'USER': 'salesuser',
        'PASSWORD': 'yourpassword',
        'HOST': '127.0.0.1',
        'PORT': '5432',
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.FormParser',
        'rest_framework.parsers.MultiPartParser',
    ],
}

# JWT Configuration - Simplified to avoid blacklist issues
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=24),  # Extended for development
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,  # Disabled to avoid blacklist dependency
    'BLACKLIST_AFTER_ROTATION': False,  # Disabled blacklist completely
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'TOKEN_OBTAIN_SERIALIZER': 'rest_framework_simplejwt.serializers.TokenObtainPairSerializer',
    'TOKEN_REFRESH_SERIALIZER': 'rest_framework_simplejwt.serializers.TokenRefreshSerializer',
    'TOKEN_VERIFY_SERIALIZER': 'rest_framework_simplejwt.serializers.TokenVerifySerializer',
}

# CORS Configuration
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
CORS_ALLOW_CREDENTIALS = True

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
]

CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]

# CSRF Configuration
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False
CSRF_USE_SESSIONS = False

# Logging Configuration for debugging JWT issues
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'tasks.services.google_oauth_service': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'tasks.views.google_auth': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    }
}

#Google
# settings.py
GOOGLE_OAUTH_CLIENT_ID = os.environ.get('GOOGLE_OAUTH_CLIENT_ID')
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET')

#Media
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

#EMAIL SETTINGS
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_USE_SSL = False
EMAIL_HOST_USER = 'parham.g1383@gmail.com'
EMAIL_HOST_PASSWORD = 'hxhabmcfltseioto'
DEFAULT_FROM_EMAIL = 'parham.g1383@gmail.com'

# Email Configuration
ADMIN_EMAIL_LIST = ['parham.g1383@gmail.com']
FRONTEND_URL = 'http://localhost:3000'
SUPPORT_EMAIL = 'parham.g1383@gmail.com'

# For development - disable SSL certificate verification
import ssl
ssl._create_default_https_context = ssl._create_unverified_context

if DEBUG:
    import ssl
    ssl._create_default_https_context = ssl._create_unverified_context
    os.environ['SSL_CERT_FILE'] = certifi.where()

    KAVENEGAR_API_KEY = '45716874386B306854636F50762B6E4A645039536F703970784239495146586C304C73326E514752776C6F3D'

    # Sender numbers based on your account info
    KAVENEGAR_SENDER_DOMESTIC = '2000660110'  # آزمایشی - برای ایران
    KAVENEGAR_SENDER_INTERNATIONAL = '0018018949161'  # بین المللی - برای 148 کشور

    # Default sender (use domestic for Iran)
    KAVENEGAR_SENDER = KAVENEGAR_SENDER_DOMESTIC

    # Enable/Disable SMS notifications
    SMS_NOTIFICATIONS_ENABLED = True

    # SMS Configuration (removed timeout references)
    SMS_CONFIG = {
        'max_message_length': 70,  # Persian SMS character limit
        'retry_failed_sms': True,
        'log_all_sms': True,
        'use_test_mode': False,  # Set to True for testing
    }

    # Message templates for different scenarios
    SMS_TEMPLATES = {
        'order_submitted': 'سلام {customer_name}\nسفارش #{order_id} با موفقیت ثبت شد.\nمنتظر قیمت‌گذاری باشید.\nکیان تجارت پویا کویر',

        'pricing_ready': 'سلام {customer_name}\nقیمت سفارش #{order_id} آماده است.\nمبلغ: {total_amount:,.0f} ریال\nلطفا وارد سایت شوید.\nکیان تجارت پویا کویر',

        'order_confirmed': 'سلام {customer_name}\nسفارش #{order_id} تایید شد!\nمبلغ: {total_amount:,.0f} ریال\nدر حال آماده‌سازی است.\nکیان تجارت پویا کویر',

        'order_rejected': 'سلام {customer_name}\nمتاسفانه سفارش #{order_id} لغو شد.\nبرای اطلاعات بیشتر تماس بگیرید.\nکیان تجارت پویا کویر',

        'order_completed': 'سلام {customer_name}\nسفارش #{order_id} تکمیل شد!\nاز خرید شما متشکریم.\nکیان تجارت پویا کویر',

        'dealer_assigned': 'سلام {dealer_name}\nسفارش #{order_id} به شما تخصیص داده شد.\nمشتری: {customer_name}\nکمیسیون: {commission_rate}%\nوارد پنل شوید.\nکیان تجارت پویا کویر',

        'dealer_removed': 'سلام {dealer_name}\nسفارش #{order_id} از شما حذف شد.\n{reason}\nکیان تجارت پویا کویر',

        'new_arrival': 'سلام {customer_name}\nمحموله جدید "{announcement_title}" رسید!\nبرای مشاهده وارد سایت شوید.\nکیان تجارت پویا کویر',

        'otp_verification': 'کد تایید شما: {otp_code}\nکیان تجارت پویا کویر',
    }

    # Kavenegar OTP Templates (if you create them in your Kavenegar panel)
    KAVENEGAR_OTP_TEMPLATES = {
        'verification': 'verify',  # Template name in Kavenegar panel
        'password_reset': 'reset-pass',
        'login_verification': 'login-verify',
    }

    # SMS Rate Limiting (to avoid spam)
    SMS_RATE_LIMITING = {
        'enabled': True,
        'max_sms_per_customer_per_hour': 5,
        'max_sms_per_customer_per_day': 20,
        'cooldown_between_sms': 30,  # seconds
    }

    # SMS Logging Configuration
    SMS_LOGGING = {
        'log_successful_sms': True,
        'log_failed_sms': True,
        'log_sms_content': True,  # Set to False for privacy in production
        'retention_days': 90,  # How long to keep SMS logs
    }

    # Development/Testing Settings
    if DEBUG:
        # In development, you might want to use test numbers
        SMS_CONFIG['use_test_mode'] = False  # Set to True to only log SMS without sending
        SMS_CONFIG['test_phone_numbers'] = ['9809902614909']  # Your test number with country code

        # You might want to log SMS instead of sending in development
        SMS_CONFIG['log_instead_of_send'] = False  # Set to True to only log SMS    