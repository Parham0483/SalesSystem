# tasks/management/commands/setup_fonts.py
# Django management command to setup Persian fonts

import os
import urllib.request
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Setup Persian fonts for PDF generation'

    def handle(self, *args, **options):
        self.stdout.write("🔄 Setting up Persian fonts...")

        # Create fonts directory
        fonts_dir = os.path.join(settings.MEDIA_ROOT, 'fonts')
        os.makedirs(fonts_dir, exist_ok=True)
        self.stdout.write(f"📁 Fonts directory: {fonts_dir}")

        # Persian fonts to download
        fonts_to_download = {
            'Vazir-Regular.ttf': 'https://github.com/rastikerdar/vazir-font/raw/master/dist/Vazir-Regular.ttf',
            'NotoSansArabic-Regular.ttf': 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l-PI_SGM.ttf'
        }

        for font_name, font_url in fonts_to_download.items():
            font_path = os.path.join(fonts_dir, font_name)

            if os.path.exists(font_path):
                self.stdout.write(f"✅ Font already exists: {font_name}")
                continue

            try:
                self.stdout.write(f"📥 Downloading {font_name}...")
                urllib.request.urlretrieve(font_url, font_path)
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Downloaded: {font_name}")
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"❌ Failed to download {font_name}: {e}")
                )

        # Test font loading
        self.test_font_loading(fonts_dir)

        # Test Persian text reshaping
        self.test_persian_text_reshaping()

        self.stdout.write(
            self.style.SUCCESS('🎯 Persian fonts setup completed!')
        )

    def test_font_loading(self, fonts_dir):
        """Test if Persian fonts can be loaded properly"""
        self.stdout.write("\n🧪 Testing font loading...")

        try:
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont

            for font_file in os.listdir(fonts_dir):
                if font_file.endswith('.ttf'):
                    font_path = os.path.join(fonts_dir, font_file)
                    try:
                        pdfmetrics.registerFont(TTFont('TestFont', font_path))
                        self.stdout.write(f"✅ {font_file} - Loaded successfully")
                    except Exception as e:
                        self.stdout.write(f"❌ {font_file} - Failed to load: {e}")
        except ImportError:
            self.stdout.write("❌ ReportLab not installed")

    def test_persian_text_reshaping(self):
        """Test Persian text reshaping"""
        self.stdout.write("\n🧪 Testing Persian text reshaping...")

        try:
            import arabic_reshaper
            from bidi.algorithm import get_display

            test_text = "سلام دنیا - این یک تست است"
            reshaped = arabic_reshaper.reshape(test_text)
            final_text = get_display(reshaped)

            self.stdout.write("✅ Persian text reshaping works")
            self.stdout.write(f"   Original: {test_text}")
            self.stdout.write(f"   Reshaped: {final_text}")

        except ImportError as e:
            self.stdout.write(f"❌ Persian text reshaping libraries not installed: {e}")
            self.stdout.write("💡 Install with: pip install arabic-reshaper python-bidi")
        except Exception as e:
            self.stdout.write(f"❌ Error testing Persian text reshaping: {e}")