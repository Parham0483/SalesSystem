# tasks/services/pre_invoice_pdf.py - ENHANCED WITH CONDITIONAL TAX DISPLAY
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
    """Enhanced generator for pre-invoices with conditional tax display"""

    def __init__(self, order):
        self.order = order
        self.customer = self.order.customer
        self.persian_font = 'Vazir'

        # Determine if this is for official invoice (with tax) or unofficial (without tax)
        self.is_official = self.order.business_invoice_type == 'official'

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
        """Setup paragraph styles - enhanced with more options"""
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
            'invoice_type': ParagraphStyle(
                'invoice_type',
                fontName=self.persian_font,
                fontSize=12,
                alignment=TA_CENTER,
                textColor=colors.blue,
            ),
        }

    def _para(self, text, style='table_cell'):
        """Create Persian paragraph with proper reshaping"""
        if not text:
            text = ""
        try:
            reshaped_text = get_display(arabic_reshaper.reshape(str(text)))
            return Paragraph(reshaped_text, self.styles[style])
        except Exception as e:
            print(f"Text reshaping error: {e}")
            return Paragraph(str(text), self.styles[style])

    def draw_background(self, canvas, doc):
        """Draw background letterhead"""
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
        """Add header with pre-invoice title and invoice type"""
        # Current date in Shamsi calendar
        current_date = jdatetime.date.today()

        # Expiry date (48 hours from now)
        expiry_datetime = datetime.now()
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

        # Invoice type indicator
        invoice_type_text = "فاکتور رسمی (شامل مالیات)" if self.is_official else "فاکتور شخصی (بدون مالیات)"
        elements.append(Spacer(1, 3 * mm))
        elements.append(self._para(f"نوع فاکتور درخواستی: {invoice_type_text}", 'invoice_type'))

        # Validity warning
        validity_warning = f"⚠️ این پیش فاکتور تا تاریخ {expiry_str} (تا انتها روز کاری) معتبر است"
        elements.append(Spacer(1, 5 * mm))
        elements.append(self._para(validity_warning, 'warning'))
        elements.append(Spacer(1, 5 * mm))

    def add_parties_info(self, elements):
        """Add seller and buyer information - enhanced for official invoices"""

        def create_party_table(title, party_data):
            table_content = [
                [self._para(title, style='table_header')],
                [self._para(f"نام: {party_data.get('name', '')}")],
                [self._para(f"تلفن: {party_data.get('phone', '')}")],
            ]

            # Add company name if exists
            if party_data.get('company_name'):
                table_content.append([self._para(f"شرکت: {party_data.get('company_name')}")])

            # For official invoices, show additional customer requirements
            if self.is_official and title == "مشخصات خریدار":
                # Check if customer info is complete for official invoice
                is_valid, missing_fields = self.customer.validate_for_official_invoice()

                if not is_valid:
                    missing_text = ", ".join(missing_fields)
                    table_content.append([
                        self._para(f"⚠️ برای فاکتور رسمی نیاز به تکمیل: {missing_text}", 'warning')
                    ])
                else:
                    table_content.append([
                        self._para("✅ اطلاعات برای فاکتور رسمی کامل است", 'default')
                    ])

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
        """Add items table with conditional tax calculation"""
        if self.is_official:
            # Headers for official invoice (with tax columns)
            headers = [
                "جمع کل (ریال)", "مالیات (ریال)", "نرخ مالیات (%)",
                "مبلغ کل", "مبلغ واحد (ریال)", "تعداد", "شرح کالا", "ردیف"
            ]

            col_widths = [
                self.content_width * 0.15,  # جمع کل
                self.content_width * 0.12,  # مالیات
                self.content_width * 0.10,  # نرخ مالیات
                self.content_width * 0.15,  # مبلغ کل
                self.content_width * 0.15,  # مبلغ واحد
                self.content_width * 0.08,  # تعداد
                self.content_width * 0.20,  # شرح کالا
                self.content_width * 0.05  # ردیف
            ]
        else:
            # Headers for unofficial invoice (without tax columns)
            headers = [
                "مبلغ کل (ریال)", "مبلغ واحد (ریال)", "تعداد", "شرح کالا", "ردیف"
            ]

            col_widths = [
                self.content_width * 0.25,  # مبلغ کل
                self.content_width * 0.25,  # مبلغ واحد
                self.content_width * 0.15,  # تعداد
                self.content_width * 0.25,  # شرح کالا
                self.content_width * 0.10  # ردیف
            ]

        table_data = [[self._para(h, 'table_header') for h in headers]]

        items = list(self.order.items.filter(is_active=True))
        grand_total = 0
        grand_total_tax = 0

        for i, item in enumerate(items, 1):
            unit_price = int(item.quoted_unit_price or 0)
            quantity = int(item.final_quantity or item.requested_quantity or 0)
            total_price = unit_price * quantity

            if self.is_official:
                # Calculate tax for official invoice using product-specific tax rate
                product_tax_rate = float(getattr(item.product, 'tax_rate', settings.DEFAULT_TAX_RATE * 100))
                tax_amount = int(total_price * (product_tax_rate / 100))
                total_with_tax = total_price + tax_amount

                grand_total += total_with_tax
                grand_total_tax += tax_amount

                row = [
                    self._para(f"{total_with_tax:,}"),  # جمع کل با مالیات
                    self._para(f"{tax_amount:,}"),  # مالیات
                    self._para(f"{product_tax_rate:.1f}%"),  # نرخ مالیات
                    self._para(f"{total_price:,}"),  # مبلغ کل بدون مالیات
                    self._para(f"{unit_price:,}"),  # مبلغ واحد
                    self._para(str(quantity)),  # تعداد
                    self._para(item.product.name),  # شرح کالا
                    self._para(str(i))  # ردیف
                ]
            else:
                # Simple calculation for unofficial invoice
                grand_total += total_price

                row = [
                    self._para(f"{total_price:,}"),  # مبلغ کل
                    self._para(f"{unit_price:,}"),  # مبلغ واحد
                    self._para(str(quantity)),  # تعداد
                    self._para(item.product.name),  # شرح کالا
                    self._para(str(i))  # ردیف
                ]

            table_data.append(row)

        # Add totals row
        if self.is_official:
            # Calculate weighted average tax rate for display
            avg_tax_rate = (
                        grand_total_tax / (grand_total - grand_total_tax) * 100) if grand_total > grand_total_tax else 0

            totals_row = [
                self._para(f"{grand_total:,}"),  # جمع کل با مالیات
                self._para(f"{grand_total_tax:,}"),  # مجموع مالیات
                self._para(f"{avg_tax_rate:.1f}%"),  # نرخ میانگین
                self._para(f"{grand_total - grand_total_tax:,}"),  # مجموع بدون مالیات
                "",  # مبلغ واحد
                "",  # تعداد
                self._para("جمع کل"),  # شرح
                ""  # ردیف
            ]
        else:
            totals_row = [
                self._para(f"{grand_total:,}"),  # جمع کل
                "",  # مبلغ واحد
                "",  # تعداد
                self._para("جمع کل"),  # شرح کالا
                ""  # ردیف
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
        """Add footer with terms and conditions - corrected for proper RTL display"""
        elements.append(Spacer(1, 20))

        if self.is_official:
            # Define terms as separate lines for better control
            terms_lines = [
                "⚠️ شرایط و ضوابط فاکتور رسمی:",
                "• این پیش فاکتور قابل تبدیل به فاکتور رسمی است",
                "• پس از تایید سفارش و پرداخت، فاکتور نهایی صادر خواهد شد",
                "• قیمت‌های نمایش داده شده شامل مالیات بر ارزش افزوده می‌باشد",
                "• برای صدور فاکتور رسمی، اطلاعات کامل شرکت/شخص الزامی است",
                "• فاکتور رسمی قابل استفاده برای کسر مالیات و تسویه حساب می‌باشد"
            ]
        else:
            terms_lines = [
                "⚠️ شرایط و ضوابط فاکتور شخصی:",
                "• این پیش فاکتور قابل تبدیل به فاکتور نهایی است",
                "• پس از تایید سفارش و پرداخت، فاکتور نهایی صادر خواهد شد",
                "• قیمت‌ها بدون مالیات بر ارزش افزوده می‌باشد",
                "• این نوع فاکتور برای خریدهای شخصی مناسب است",
                "• قابل استفاده برای تسویه حساب اشخاص حقیقی"
            ]

        # Create custom paragraph method for footer with proper RTL handling
        def create_rtl_paragraph(text, style_name='default'):
            """Create RTL paragraph with proper directional formatting"""
            try:
                # First reshape the Arabic/Persian text
                reshaped_text = arabic_reshaper.reshape(str(text))
                # Then apply RTL display
                display_text = get_display(reshaped_text)
                # Add RTL embedding after reshaping
                final_text = f"\u202B{display_text}\u202C"
                return Paragraph(final_text, self.styles[style_name])
            except Exception as e:
                print(f"RTL paragraph creation error: {e}")
                return Paragraph(str(text), self.styles[style_name])

        # Join all terms with proper line breaks for single paragraph approach
        terms_text = "\n".join(terms_lines)

        # Alternative 1: Single paragraph with manual RTL handling
        terms_paragraph = create_rtl_paragraph(terms_text, 'default')

        # Alternative 2: Use Table with individual rows (more reliable)
        # Create table data with each line as a separate row
        table_data = []
        for line in terms_lines:
            table_data.append([create_rtl_paragraph(line, 'default')])

        # Use the table approach (more reliable for complex RTL text)
        terms_table = Table(table_data, colWidths=[self.content_width])

        # Set background color based on invoice type
        bg_color = colors.lightcyan if self.is_official else colors.lightyellow

        terms_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),  # Right align for RTL
            ('BACKGROUND', (0, 0), (-1, -1), bg_color),
            ('LEFTPADDING', (0, 0), (-1, -1), 10),
            ('RIGHTPADDING', (0, 0), (-1, -1), 10),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))

        elements.append(Spacer(1, 5 * mm))
        elements.append(terms_table)

    # Alternative method - modify your existing _para method
    def _para_rtl(self, text, style='table_cell'):
        """Enhanced Persian paragraph with better RTL control"""
        if not text:
            text = ""
        try:
            # First reshape Arabic/Persian characters
            reshaped_text = arabic_reshaper.reshape(str(text))
            # Then apply bidi algorithm
            display_text = get_display(reshaped_text)
            # Add explicit RTL embedding for problematic cases
            if any(ord(c) > 127 for c in text):  # Contains non-ASCII (Persian/Arabic)
                final_text = f"\u202B{display_text}\u202C"
            else:
                final_text = display_text
            return Paragraph(final_text, self.styles[style])
        except Exception as e:
            print(f"Text reshaping error: {e}")
            return Paragraph(str(text), self.styles[style])

    def generate_pdf(self):
        """Generate the complete pre-invoice PDF with conditional formatting"""
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
        invoice_type_suffix = "official" if self.is_official else "unofficial"
        filename = f"pre_invoice_{self.order.id}_{invoice_type_suffix}.pdf"
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response