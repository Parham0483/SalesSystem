# tasks/services/enhanced_persian_pdf.py - Final Corrected Version
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from bidi.algorithm import get_display
import arabic_reshaper
from django.http import HttpResponse
from django.conf import settings
import os
import jdatetime


class EnhancedPersianInvoicePDFGenerator:
    def __init__(self, invoice):
        self.invoice = invoice
        self.order = invoice.order
        self.customer = self.order.customer
        self.persian_font = 'Vazir'

        self.page_width, self.page_height = A4
        self.margin = 10 * mm
        self.content_width = self.page_width - (2 * self.margin)

        self.setup_font()
        self.setup_styles()

    def setup_font(self):
        font_path = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'Vazir.ttf')
        if os.path.exists(font_path):
            pdfmetrics.registerFont(TTFont('Vazir', font_path))
            print("✅ Vazir font registered successfully.")
        else:
            print("❌ Vazir font not found at 'static/fonts/Vazir.ttf'.")
            self.persian_font = 'Helvetica'

    def setup_styles(self):
        self.styles = {
            'default': ParagraphStyle(
                'default',
                fontName=self.persian_font,
                fontSize=9,
                alignment=TA_RIGHT,
            ),
            'title': ParagraphStyle(
                'title',
                fontName=self.persian_font,
                fontSize=16,
                alignment=TA_CENTER,
            ),
            'table_header': ParagraphStyle(
                'table_header',
                fontName=self.persian_font,
                fontSize=8,
                alignment=TA_CENTER,
                textColor=colors.whitesmoke,
            ),
            'table_cell': ParagraphStyle(
                'table_cell',
                fontName=self.persian_font,
                fontSize=8,
                alignment=TA_CENTER,
                leading=10,
            ),
        }

    def _para(self, text, style='table_cell'):
        """Create Persian paragraph with robust error handling"""
        if not text:
            text = ""

        try:
            # Clean problematic Unicode control characters
            cleaned_text = str(text)
            for char in ['\u2068', '\u2069', '\u061C', '\u202A', '\u202B', '\u202C', '\u202D', '\u202E']:
                cleaned_text = cleaned_text.replace(char, '')

            # Reshape Arabic/Persian characters
            reshaped_text = arabic_reshaper.reshape(cleaned_text)

            # Apply bidi with fallback
            try:
                display_text = get_display(reshaped_text)
            except (ValueError, UnicodeError) as e:
                if "FSI" in str(e) or "isolate" in str(e).lower():
                    # Use reshaped text without bidi
                    display_text = reshaped_text
                else:
                    raise e

            return Paragraph(display_text, self.styles[style])

        except Exception as e:
            print(f"Text processing error for '{text[:50]}...': {e}")
            # Final fallback: original text
            return Paragraph(str(text), self.styles[style])

    def draw_background(self, canvas, doc):
        letterhead_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'letterhead.jpg')
        if os.path.exists(letterhead_path):
            canvas.drawImage(
                letterhead_path, 0, 0, width=self.page_width, height=self.page_height,
                preserveAspectRatio=True, mask='auto'
            )
        else:
            print("⚠️ Letterhead image not found at 'static/images/letterhead.jpg'.")

    def add_footer(self, elements):
        """Adds the explanations and signature boxes as flowable elements."""
        explanations_text = f"توضیحات: {getattr(self.invoice, 'notes', '') or ''}"
        explanations_table = Table([[self._para(explanations_text, 'default')]], colWidths=[self.content_width],
                                   rowHeights=[15 * mm])
        explanations_table.setStyle(
            TableStyle([('GRID', (0, 0), (-1, -1), 1, colors.black), ('VALIGN', (0, 0), (-1, -1), 'TOP')]))

        payment_text = self._para("شرایط و نحوه فروش:     [  ] نقدی     [  ] غیر نقدی", 'default')
        signatures_table = Table(
            [[self._para("مهر و امضای خریدار"), self._para("مهر و امضای فروشنده"), payment_text]],
            colWidths=[self.content_width * 0.3, self.content_width * 0.3, self.content_width * 0.4],
            rowHeights=[20 * mm]
        )
        signatures_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ]))

        elements.append(Spacer(1, 5 * mm))  # Add some space before the footer
        elements.append(explanations_table)
        elements.append(Spacer(1, 2 * mm))
        elements.append(signatures_table)

    def draw_footer(self, canvas, doc):
        explanations_text = f"توضیحات: {getattr(self.invoice, 'notes', '') or ''}"
        explanations_table = Table([[self._para(explanations_text, 'default')]], colWidths=[self.content_width], rowHeights=[15 * mm])
        explanations_table.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 1, colors.black), ('VALIGN', (0, 0), (-1, -1), 'TOP')]))

        payment_text = self._para("شرایط و نحوه فروش:     [  ] نقدی     [  ] غیر نقدی", 'default')
        signatures_table = Table(
            [[self._para("مهر و امضای خریدار"), self._para("مهر و امضای فروشنده"), payment_text]],
            colWidths=[self.content_width * 0.3, self.content_width * 0.3, self.content_width * 0.4], rowHeights=[20 * mm]
        )
        signatures_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black), ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ]))

        explanations_table.wrapOn(canvas, self.content_width, 20 * mm)
        explanations_table.drawOn(canvas, self.margin, 45 * mm)

        signatures_table.wrapOn(canvas, self.content_width, 25 * mm)
        signatures_table.drawOn(canvas, self.margin, 20 * mm)

    def draw_static_content(self, canvas, doc):
        self.draw_background(canvas, doc)
        self.draw_footer(canvas, doc)

    def add_header_section(self, elements):
        title = "صورتحساب فروش کالا و خدمات"
        date_str = jdatetime.date.fromgregorian(date=self.invoice.issued_at.date()).strftime('%Y/%m/%d')
        serial_info_text = f"شماره سریال: {self.invoice.invoice_number}\nتاریخ: {date_str}"

        header_data = [[self._para(serial_info_text, 'default'), self._para(title, 'title')]]
        col_widths = [self.content_width * 0.5, self.content_width * 0.5]

        header_table = Table(header_data, colWidths=col_widths)
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (0, 0), (0, 0), 'RIGHT'),
        ]))
        elements.append(header_table)

    def add_parties_info(self, elements):
        def create_party_table(title, party_data):
            table_content = [
                [self._para(title, style='table_header')],
                [self._para(f"نام شخص حقیقی / حقوقی: {party_data.get('name', '')}")],
                [self._para(f"استان: {party_data.get('province', '')} - شهرستان: {party_data.get('city', '')}")],
                [self._para(f"نشانی: {party_data.get('address', '')}")],
                [self._para(f"کد پستی ۱۰ رقمی: {party_data.get('postal_code', '')}")],
                [self._para(f"شماره اقتصادی: {party_data.get('economic_id', '')}")],
                [self._para(f"شماره ثبت/ملی: {party_data.get('national_id', '')}")],
                [self._para(f"شماره تلفن/نمابر: {party_data.get('phone', '')}")]
            ]
            party_table = Table(table_content, colWidths=[self.content_width])
            party_table.setStyle(TableStyle([
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('BACKGROUND', (0, 0), (0, 0), colors.darkslategray),
                ('ALIGN', (0, 1), (0, -1), 'RIGHT'), ('RIGHTPADDING', (0, 1), (0, -1), 5),
            ]))
            return party_table

        seller_info = {
            "name": settings.BUSINESS_NAME, "province": settings.BUSINESS_PROVINCE, "city": settings.BUSINESS_CITY,
            "address": settings.BUSINESS_ADDRESS, "postal_code": settings.BUSINESS_POSTAL_CODE,
            "economic_id": settings.BUSINESS_ECONOMIC_ID, "national_id": settings.BUSINESS_NATIONAL_ID,
            "phone": settings.BUSINESS_PHONE
        }
        customer_info = {
            "name": self.customer.name, "province": getattr(self.customer, 'province', ''),
            "city": getattr(self.customer, 'city', ''), "address": getattr(self.customer, 'address', ''),
            "postal_code": self.customer.postal_code, "economic_id": self.customer.economic_id,
            "national_id": self.customer.national_id, "phone": self.customer.phone
        }

        elements.append(Spacer(1, 4 * mm))
        elements.append(create_party_table("مشخصات فروشنده", seller_info))
        elements.append(Spacer(1, 4 * mm))
        elements.append(create_party_table("مشخصات خریدار", customer_info))
        elements.append(Spacer(1, 4 * mm))

    def add_items_table(self, elements):
        """Add items table with product-specific tax rates"""
        headers = [
            "جمع کل بعلاوه مالیات (ریال)", "مالیات (ریال)", "نرخ مالیات (%)",
            "جمع پس از تخفیف (ریال)", "تخفیف (ریال)", "مبلغ کل (ریال)",
            "مبلغ واحد (ریال)", "واحد", "تعداد", "شرح کالا یا خدمات", "کد کالا", "ردیف"
        ]

        col_widths = [
            self.content_width * 0.12,  # جمع کل بعلاوه مالیات
            self.content_width * 0.09,  # مالیات
            self.content_width * 0.07,  # نرخ مالیات
            self.content_width * 0.10,  # جمع پس از تخفیف
            self.content_width * 0.07,  # تخفیف
            self.content_width * 0.09,  # مبلغ کل
            self.content_width * 0.09,  # مبلغ واحد
            self.content_width * 0.06,  # واحد
            self.content_width * 0.06,  # تعداد
            self.content_width * 0.15,  # شرح کالا
            self.content_width * 0.06,  # کد کالا
            self.content_width * 0.04  # ردیف
        ]

        table_data = [[self._para(h, 'table_header') for h in headers]]

        items = list(self.order.items.all())
        grand_total_final, grand_total_tax, grand_total_after_discount = 0, 0, 0

        for i, item in enumerate(items, 1):
            unit_price = int(item.quoted_unit_price or 0)
            quantity = int(item.final_quantity or 0)
            total_price = unit_price * quantity
            discount = 0
            total_after_discount = total_price - discount

            # CRITICAL CHANGE: Use product-specific tax rate instead of global DEFAULT_TAX_RATE
            product_tax_rate = float(item.product.tax_rate)  # Get from product, not settings
            tax_amount = int(total_after_discount * (product_tax_rate / 100))
            final_amount = total_after_discount + tax_amount

            grand_total_final += final_amount
            grand_total_tax += tax_amount
            grand_total_after_discount += total_after_discount

            row = [
                self._para(f"{final_amount:,}"),  # جمع کل بعلاوه مالیات
                self._para(f"{tax_amount:,}"),  # مالیات
                self._para(f"{product_tax_rate:.1f}%"),  # نرخ مالیات (SHOW INDIVIDUAL RATE)
                self._para(f"{total_after_discount:,}"),  # جمع پس از تخفیف
                self._para(f"{discount:,}"),  # تخفیف
                self._para(f"{total_price:,}"),  # مبلغ کل
                self._para(f"{unit_price:,}"),  # مبلغ واحد
                self._para("عدد"),  # واحد
                self._para(str(quantity)),  # تعداد
                self._para(item.product.name),  # شرح کالا
                self._para(str(getattr(item.product, 'sku', ''))),  # کد کالا
                self._para(str(i))  # ردیف
            ]
            table_data.append(row)

        # Calculate weighted average tax rate for totals row
        avg_tax_rate = (grand_total_tax / grand_total_after_discount * 100) if grand_total_after_discount > 0 else 0

        # Add totals row
        totals_row = [
            self._para(f"{grand_total_final:,}"),  # جمع کل بعلاوه مالیات
            self._para(f"{grand_total_tax:,}"),  # مالیات
            self._para(f"{avg_tax_rate:.1f}%"),  # نرخ مالیات میانگین
            self._para(f"{grand_total_after_discount:,}"),  # جمع پس از تخفیف
            "",  # تخفیف
            "",  # مبلغ کل
            "",  # مبلغ واحد
            "",  # واحد
            "",  # تعداد
            self._para("جمع کل"),  # شرح کالا
            "",  # کد کالا
            ""  # ردیف
        ]
        table_data.append(totals_row)

        items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        items_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkslategray),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
            ('SPAN', (3, -1), (8, -1)),
        ]))
        elements.append(items_table)

    def generate_pdf(self, *args, **kwargs):
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            # --- Final margins to define the "writable area" ---
            topMargin=45 * mm,    # Increased to leave space for letterhead header
            bottomMargin=60 * mm, # Increased to leave space for letterhead footer
            rightMargin=self.margin,
            leftMargin=self.margin,
        )

        # Assemble all parts of the invoice as a single list of content
        elements = []
        self.add_header_section(elements)
        self.add_parties_info(elements)
        self.add_items_table(elements)
        self.add_footer(elements) # Add the footer as a standard element

        # The 'onFirstPage' hook now only draws the background
        doc.build(elements, onFirstPage=self.draw_background, onLaterPages=self.draw_background)
        return buffer

    def get_http_response(self):
        buffer = self.generate_pdf()
        filename = f"invoice_{self.invoice.invoice_number}_official.pdf"
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response