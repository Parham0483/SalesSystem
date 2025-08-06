# tasks/services/pre_invoice_pdf.py
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from bidi.algorithm import get_display
import arabic_reshaper
from django.http import HttpResponse
from django.conf import settings
from datetime import datetime, timedelta
import os
import jdatetime


class PreInvoicePDFGenerator:
    """Generator for pre-invoices with 48-hour validity"""

    def __init__(self, order):
        self.order = order
        self.customer = self.order.customer
        self.persian_font = 'Vazir'

        self.page_width, self.page_height = A4
        self.margin = 10 * mm
        self.content_width = self.page_width - (2 * self.margin)

        self.setup_font()
        self.setup_styles()

    def setup_font(self):
        """Register Persian font - same as enhanced generator"""
        font_path = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'Vazir.ttf')
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont('Vazir', font_path))
                print("✅ Vazir font registered successfully.")
            except Exception as e:
                print(f"❌ Font registration error: {e}")
                self.persian_font = 'Helvetica'
        else:
            print("❌ Vazir font not found at 'static/fonts/Vazir.ttf'.")
            self.persian_font = 'Helvetica'

    def setup_styles(self):
        """Setup paragraph styles - same pattern as enhanced generator"""
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
            'warning': ParagraphStyle(
                'warning',
                fontName=self.persian_font,
                fontSize=10,
                alignment=TA_CENTER,
                textColor=colors.red,
            ),
        }

    def _para(self, text, style='table_cell'):
        """Create Persian paragraph with proper reshaping - same as enhanced generator"""
        if not text:
            text = ""
        try:
            reshaped_text = get_display(arabic_reshaper.reshape(str(text)))
            return Paragraph(reshaped_text, self.styles[style])
        except Exception as e:
            print(f"Text reshaping error: {e}")
            return Paragraph(str(text), self.styles[style])

    def draw_background(self, canvas, doc):
        """Draw background letterhead - same pattern as enhanced generator"""
        letterhead_path = os.path.join(settings.BASE_DIR, 'static', 'images', 'letterhead.jpg')
        if os.path.exists(letterhead_path):
            try:
                canvas.drawImage(
                    letterhead_path, 0, 0,
                    width=self.page_width, height=self.page_height,
                    preserveAspectRatio=True, mask='auto'
                )
            except Exception as e:
                print(f"❌ Error drawing letterhead: {e}")
        else:
            print("⚠️ Letterhead image not found at 'static/images/letterhead.jpg'.")

    def add_header_section(self, elements):
        """Add header with pre-invoice title and validity warning"""
        # Current date in Shamsi calendar
        current_date = jdatetime.date.today()

        # Expiry date (48 hours from now)
        expiry_datetime = datetime.now() + timedelta(hours=48)
        expiry_date = jdatetime.date.fromgregorian(date=expiry_datetime.date())

        date_str = current_date.strftime('%Y/%m/%d')
        expiry_str = expiry_date.strftime('%Y/%m/%d')

        title = "پیش فاکتور فروش کالا و خدمات"
        serial_info_text = f"شماره سفارش: {self.order.id}\nتاریخ صدور: {date_str}"

        header_data = [[self._para(serial_info_text, 'default'), self._para(title, 'title')]]
        col_widths = [self.content_width * 0.5, self.content_width * 0.5]

        header_table = Table(header_data, colWidths=col_widths)
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'RIGHT'),
        ]))
        elements.append(header_table)

        # Validity warning
        validity_warning = f"⚠️ این پیش فاکتور تا تاریخ {expiry_str} (۴۸ ساعت) معتبر است"
        elements.append(Spacer(1, 5 * mm))
        elements.append(self._para(validity_warning, 'warning'))
        elements.append(Spacer(1, 5 * mm))

    def add_parties_info(self, elements):
        """Add seller and buyer information - simplified for pre-invoice"""

        def create_party_table(title, party_data):
            table_content = [
                [self._para(title, style='table_header')],
                [self._para(f"نام: {party_data.get('name', '')}")],
                [self._para(f"تلفن: {party_data.get('phone', '')}")],
            ]

            # Add company name if exists
            if party_data.get('company_name'):
                table_content.append([self._para(f"شرکت: {party_data.get('company_name')}")])

            party_table = Table(table_content, colWidths=[self.content_width])
            party_table.setStyle(TableStyle([
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('BACKGROUND', (0, 0), (0, 0), colors.darkslategray),
                ('ALIGN', (0, 1), (0, -1), 'RIGHT'),
                ('RIGHTPADDING', (0, 1), (0, -1), 5),
            ]))
            return party_table

        seller_info = {
            "name": settings.BUSINESS_NAME,
            "phone": settings.BUSINESS_PHONE
        }

        customer_info = {
            "name": self.customer.name,
            "phone": getattr(self.customer, 'phone', ''),
            "company_name": getattr(self.customer, 'company_name', '')
        }

        elements.append(Spacer(1, 4 * mm))
        elements.append(create_party_table("مشخصات فروشنده", seller_info))
        elements.append(Spacer(1, 4 * mm))
        elements.append(create_party_table("مشخصات خریدار", customer_info))
        elements.append(Spacer(1, 4 * mm))

    def add_items_table(self, elements):
        """Add items table with pricing"""
        headers = [
            "مبلغ کل (ریال)", "مبلغ واحد (ریال)", "تعداد", "شرح کالا", "ردیف"
        ]

        col_widths = [
            self.content_width * 0.20,  # مبلغ کل
            self.content_width * 0.20,  # مبلغ واحد
            self.content_width * 0.15,  # تعداد
            self.content_width * 0.35,  # شرح کالا
            self.content_width * 0.10  # ردیف
        ]

        table_data = [[self._para(h, 'table_header') for h in headers]]

        items = list(self.order.items.all())
        grand_total = 0

        for i, item in enumerate(items, 1):
            unit_price = int(item.quoted_unit_price or 0)
            quantity = int(item.final_quantity or item.requested_quantity or 0)
            total_price = unit_price * quantity
            grand_total += total_price

            row = [
                self._para(f"{total_price:,}"),
                self._para(f"{unit_price:,}"),
                self._para(str(quantity)),
                self._para(item.product.name),
                self._para(str(i))
            ]
            table_data.append(row)

        # Add total row
        totals_row = [
            self._para(f"{grand_total:,}"),
            "",
            "",
            self._para("جمع کل"),
            ""
        ]
        table_data.append(totals_row)

        items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
        items_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkslategray),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightgrey),
        ]))
        elements.append(items_table)

    def add_footer(self, elements):
        """Add footer with terms and conditions"""
        terms_text = "⚠️ شرایط و ضوابط:\n" \
                     "• این پیش فاکتور قابل تبدیل به فاکتور رسمی است\n" \
                     "• پس از تایید سفارش و پرداخت، فاکتور نهایی صادر خواهد شد\n" \
                     "• قیمت‌ها شامل مالیات بر ارزش افزوده نمی‌باشد (در صورت درخواست فاکتور رسمی، مالیات اضافه خواهد شد)"

        terms_table = Table([[self._para(terms_text, 'default')]],
                            colWidths=[self.content_width],
                            rowHeights=[25 * mm])
        terms_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.lightyellow),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ]))

        elements.append(Spacer(1, 5 * mm))
        elements.append(terms_table)

    def generate_pdf(self):
        """Generate the complete pre-invoice PDF"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            topMargin=45 * mm,  # Space for letterhead header
            bottomMargin=25 * mm,  # Space for letterhead footer
            rightMargin=self.margin,
            leftMargin=self.margin,
        )

        # Assemble all parts of the pre-invoice
        elements = []
        self.add_header_section(elements)
        self.add_parties_info(elements)
        self.add_items_table(elements)
        self.add_footer(elements)

        # Build with background
        doc.build(elements, onFirstPage=self.draw_background, onLaterPages=self.draw_background)
        return buffer

    def get_http_response(self):
        """Return HTTP response with PDF"""
        buffer = self.generate_pdf()
        filename = f"pre_invoice_{self.order.id}.pdf"
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response