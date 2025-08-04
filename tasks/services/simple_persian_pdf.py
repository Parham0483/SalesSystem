# Complete simple_persian_pdf.py with proper font integration:

from io import BytesIO
import os
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from django.conf import settings
from django.http import HttpResponse
import arabic_reshaper
from bidi.algorithm import get_display


class EnhancedPersianInvoicePDFGenerator:
    def __init__(self, invoice):
        self.invoice = invoice
        self.order = invoice.order
        self.persian_font = 'Helvetica'  # Default fallback
        self.setup_fonts()

    def setup_fonts(self):
        """Setup Persian fonts with better error handling"""
        try:
            # Try multiple potential font locations
            possible_paths = [
                # Static files locations
                os.path.join(settings.BASE_DIR, 'static', 'fonts', 'Vazir.ttf'),
                os.path.join(settings.BASE_DIR, 'staticfiles', 'fonts', 'Vazir.ttf'),
            ]

            # Add STATIC_ROOT if it exists
            if hasattr(settings, 'STATIC_ROOT') and settings.STATIC_ROOT:
                possible_paths.append(os.path.join(settings.STATIC_ROOT, 'fonts', 'Vazir.ttf'))

            # Add STATICFILES_DIRS if it exists
            if hasattr(settings, 'STATICFILES_DIRS') and settings.STATICFILES_DIRS:
                for static_dir in settings.STATICFILES_DIRS:
                    possible_paths.append(os.path.join(static_dir, 'fonts', 'Vazir.ttf'))

            font_registered = False
            for font_path in possible_paths:
                if os.path.exists(font_path):
                    try:
                        # Check if font is already registered
                        if 'Vazir' not in pdfmetrics.getRegisteredFontNames():
                            pdfmetrics.registerFont(TTFont('Vazir', font_path))
                        self.persian_font = 'Vazir'
                        font_registered = True
                        print(f"✅ Font registered successfully: {font_path}")
                        break
                    except Exception as e:
                        print(f"❌ Failed to register font {font_path}: {str(e)}")
                        continue

            if not font_registered:
                print("⚠️ Vazir font not found, using Helvetica as fallback")
                print(f"Searched paths: {possible_paths}")
                self.persian_font = 'Helvetica'

        except Exception as e:
            print(f"❌ Font setup error: {str(e)}")
            self.persian_font = 'Helvetica'

    def reshape_persian_text(self, text):
        """Reshape Persian text for proper display"""
        if not text:
            return ""
        try:
            text_str = str(text)
            if any('\u0600' <= char <= '\u06FF' for char in text_str):
                reshaped_text = arabic_reshaper.reshape(text_str)
                return get_display(reshaped_text)
            else:
                return text_str
        except Exception as e:
            print(f"❌ Text reshaping error: {str(e)}")
            return str(text)

    def format_persian_number(self, number):
        """Convert English numbers to Persian"""
        try:
            persian_digits = '۰۱۲۳۴۵۶۷۸۹'
            english_digits = '0123456789'

            number_str = str(number)
            for eng, per in zip(english_digits, persian_digits):
                number_str = number_str.replace(eng, per)
            return number_str
        except Exception:
            return str(number)

    def create_paragraph_style(self, name, **kwargs):
        """Create paragraph style with safe defaults"""
        defaults = {
            'fontName': self.persian_font,
            'fontSize': 12,
            'alignment': 2,  # Right align for Persian
        }
        defaults.update(kwargs)
        return ParagraphStyle(name, **defaults)

    def generate_pdf(self):
        """Generate PDF with comprehensive error handling"""
        try:
            is_official = self.order.business_invoice_type == 'official'

            buffer = BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=A4,
                rightMargin=2 * cm,
                leftMargin=2 * cm,
                topMargin=2 * cm,
                bottomMargin=2 * cm,
                title=f"Invoice-{self.invoice.invoice_number}"
            )

            elements = []

            # Company Header
            self.add_company_header(elements)

            # Invoice Header
            self.add_invoice_header(elements, is_official)

            # Customer Info
            self.add_customer_info(elements, is_official)

            # Items Table
            self.add_items_table(elements, is_official)

            # Totals
            self.add_totals_section(elements, is_official)

            # Signature
            self.add_signature_section(elements)

            doc.build(elements)
            return buffer

        except Exception as e:
            print(f"❌ PDF generation error: {str(e)}")
            return self.create_fallback_pdf()

    def add_company_header(self, elements):
        """Add company header"""
        try:
            # Title
            title_style = self.create_paragraph_style(
                'CompanyTitle',
                fontSize=18,
                alignment=1,  # Center
                textColor=colors.darkblue,
                spaceAfter=10
            )

            elements.append(Paragraph("GOLMOHAMMADI TRADING CO.",
                                      ParagraphStyle('EnglishTitle', fontName='Helvetica-Bold', fontSize=16,
                                                     alignment=1)))
            elements.append(
                Paragraph(self.reshape_persian_text("شرکت تولیدی بازرگانی گلمحمدی کیان تجارت پویا کویر"), title_style))
            elements.append(Spacer(1, 20))

            # Contact info table
            contact_data = [
                [self.reshape_persian_text("آدرس: یزد، بلوار مدرس شماره ۱۳"),
                 "Address: No 13, Modares Blvd, Yazd, Iran"],
                [self.reshape_persian_text("تلفن: ۰۳۵-۹۱۰۰۷۷۱۱"), "Tel: 035-91007711"],
                [self.reshape_persian_text("موبایل: ۰۹۹۸۹۱۲۱۲۱۰۷۷۰"), "Mobile: 0098 9121210770"],
                ["Email: gtc1210770@gmail.com", "Web: https://gtc.market/home_ktc"]
            ]

            contact_table = Table(contact_data, colWidths=[8 * cm, 8 * cm])
            contact_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('PADDING', (0, 0), (-1, -1), 4),
            ]))

            elements.append(contact_table)
            elements.append(Spacer(1, 20))

        except Exception as e:
            print(f"❌ Company header error: {str(e)}")
            elements.append(Paragraph("GOLMOHAMMADI TRADING CO.",
                                      ParagraphStyle('Fallback', fontName='Helvetica-Bold', fontSize=16, alignment=1)))

    def add_invoice_header(self, elements, is_official):
        """Add invoice header"""
        try:
            invoice_type = "صورتحساب فروش کالا و خدمات" if is_official else "فاکتور فروش"

            title_style = self.create_paragraph_style(
                'InvoiceType',
                fontSize=16,
                alignment=1,
                textColor=colors.darkred if is_official else colors.darkblue,
                spaceAfter=15
            )

            elements.append(Paragraph(self.reshape_persian_text(invoice_type), title_style))

            # Invoice details table
            info_data = [
                [
                    self.reshape_persian_text("شماره فاکتور:"),
                    self.format_persian_number(str(self.invoice.invoice_number)),
                    self.reshape_persian_text("تاریخ:"),
                    self.reshape_persian_text(self.invoice.issued_at.strftime('%Y/%m/%d'))
                ]
            ]

            info_table = Table(info_data, colWidths=[3 * cm, 4 * cm, 2 * cm, 3 * cm])
            info_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('PADDING', (0, 0), (-1, -1), 6),
            ]))

            elements.append(info_table)
            elements.append(Spacer(1, 15))

        except Exception as e:
            print(f"❌ Invoice header error: {str(e)}")

    def add_customer_info(self, elements, is_official):
        """Add customer information"""
        try:
            if is_official:
                # Detailed customer info for official invoice
                customer_data = [
                    [self.reshape_persian_text("مشخصات خریدار"), ""],
                    [self.reshape_persian_text("نام:"), self.reshape_persian_text(self.order.customer.name)],
                    [self.reshape_persian_text("کد ملی:"),
                     self.reshape_persian_text(getattr(self.order.customer, 'national_id', '') or 'ثبت نشده')],
                    [self.reshape_persian_text("آدرس:"),
                     self.reshape_persian_text(getattr(self.order.customer, 'complete_address', '') or 'ثبت نشده')],
                ]
            else:
                # Simple customer info for unofficial invoice
                customer_data = [
                    [self.reshape_persian_text("خریدار:"), self.reshape_persian_text(self.order.customer.name)]
                ]

            customer_table = Table(customer_data, colWidths=[4 * cm, 10 * cm])
            customer_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('PADDING', (0, 0), (-1, -1), 6),
                ('BACKGROUND', (0, 0), (1, 0), colors.lightgrey),
            ]))

            elements.append(customer_table)
            elements.append(Spacer(1, 15))

        except Exception as e:
            print(f"❌ Customer info error: {str(e)}")

    def add_items_table(self, elements, is_official):
        """Add items table"""
        try:
            if is_official:
                headers = [
                    self.reshape_persian_text("کد کالا"),
                    self.reshape_persian_text("شرح کالا"),
                    self.reshape_persian_text("تعداد"),
                    self.reshape_persian_text("قیمت واحد"),
                    self.reshape_persian_text("مبلغ کل"),
                    self.reshape_persian_text("مالیات"),
                    self.reshape_persian_text("جمع با مالیات")
                ]
                col_widths = [2 * cm, 4 * cm, 1.5 * cm, 2 * cm, 2 * cm, 1.5 * cm, 2 * cm]
            else:
                headers = [
                    self.reshape_persian_text("کالا"),
                    self.reshape_persian_text("تعداد"),
                    self.reshape_persian_text("قیمت واحد"),
                    self.reshape_persian_text("مبلغ کل")
                ]
                col_widths = [6 * cm, 2 * cm, 3 * cm, 3 * cm]

            items_data = [headers]

            for item in self.order.items.all():
                unit_price = item.quoted_unit_price or 0
                quantity = item.final_quantity or item.requested_quantity
                total_price = unit_price * quantity

                if is_official:
                    tax_amount = total_price * 0.09
                    total_with_tax = total_price + tax_amount

                    row = [
                        self.reshape_persian_text(str(getattr(item.product, 'sku', '') or item.product.id)),
                        self.reshape_persian_text(item.product.name),
                        self.format_persian_number(str(quantity)),
                        self.format_persian_number(f"{unit_price:,.0f}"),
                        self.format_persian_number(f"{total_price:,.0f}"),
                        self.format_persian_number(f"{tax_amount:,.0f}"),
                        self.format_persian_number(f"{total_with_tax:,.0f}")
                    ]
                else:
                    row = [
                        self.reshape_persian_text(item.product.name),
                        self.format_persian_number(str(quantity)),
                        self.format_persian_number(f"{unit_price:,.0f}"),
                        self.format_persian_number(f"{total_price:,.0f}")
                    ]

                items_data.append(row)

            items_table = Table(items_data, colWidths=col_widths)
            items_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('PADDING', (0, 0), (-1, -1), 4),
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ]))

            elements.append(items_table)
            elements.append(Spacer(1, 15))

        except Exception as e:
            print(f"❌ Items table error: {str(e)}")

    def add_totals_section(self, elements, is_official):
        """Add totals section"""
        try:
            total_style = self.create_paragraph_style(
                'Total',
                fontSize=14,
                alignment=2,
                spaceAfter=10
            )

            total_amount = self.invoice.total_amount
            elements.append(Paragraph(
                self.reshape_persian_text(f"مجموع: {self.format_persian_number(f'{total_amount:,.0f}')} تومان"),
                total_style
            ))

            if is_official:
                tax_amount = total_amount * 0.09
                total_with_tax = total_amount + tax_amount

                elements.append(Paragraph(
                    self.reshape_persian_text(f"مالیات (۹٪): {self.format_persian_number(f'{tax_amount:,.0f}')} تومان"),
                    total_style
                ))
                elements.append(Paragraph(
                    self.reshape_persian_text(
                        f"مبلغ نهایی: {self.format_persian_number(f'{total_with_tax:,.0f}')} تومان"),
                    total_style
                ))

            elements.append(Spacer(1, 20))

        except Exception as e:
            print(f"❌ Totals error: {str(e)}")

    def add_signature_section(self, elements):
        """Add signature section"""
        try:
            signature_data = [
                [self.reshape_persian_text("مهر و امضای فروشنده"), self.reshape_persian_text("مهر و امضای خریدار")],
                ["", ""],
                ["", ""]
            ]

            signature_table = Table(signature_data, colWidths=[8 * cm, 8 * cm], rowHeights=[1 * cm, 2 * cm, 1 * cm])
            signature_table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ]))

            elements.append(signature_table)

        except Exception as e:
            print(f"❌ Signature error: {str(e)}")

    def create_fallback_pdf(self):
        """Create simple fallback PDF if main generation fails"""
        buffer = BytesIO()
        doc = SimpleDocDocument(buffer, pagesize=A4)

        elements = [
            Paragraph(f"Invoice #{self.invoice.invoice_number}",
                      ParagraphStyle('Fallback', fontName='Helvetica-Bold', fontSize=16)),
            Spacer(1, 20),
            Paragraph(f"Customer: {self.order.customer.name}",
                      ParagraphStyle('Normal', fontName='Helvetica', fontSize=12)),
            Paragraph(f"Total: {self.invoice.total_amount:,.0f} Toman",
                      ParagraphStyle('Normal', fontName='Helvetica', fontSize=12)),
        ]

        doc.build(elements)
        return buffer

    def get_http_response(self):
        """Return HTTP response with PDF"""
        buffer = self.generate_pdf()

        invoice_type = "official" if self.order.business_invoice_type == 'official' else "unofficial"
        filename = f"invoice_{self.invoice.invoice_number}_{invoice_type}.pdf"

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response