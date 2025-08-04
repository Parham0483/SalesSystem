# tasks/services/fixed_persian_pdf_generator.py
# This version fixes the Persian text rendering issues

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch, cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from django.http import HttpResponse
from django.conf import settings
from io import BytesIO
import os
import arabic_reshaper
from bidi.algorithm import get_display
from decimal import Decimal
from datetime import datetime


class FixedPersianInvoicePDFGenerator:
    def __init__(self, invoice):
        self.invoice = invoice
        self.order = invoice.order
        self.persian_font = self.setup_persian_fonts()

    def setup_persian_fonts(self):
        """Setup Persian fonts - try multiple approaches"""
        # Method 1: Try to load a proper Persian font
        font_paths = [
            # Add your own font paths here
            os.path.join(settings.MEDIA_ROOT, 'fonts', 'NotoSansFarsi-Regular.ttf'),
            os.path.join(settings.MEDIA_ROOT, 'fonts', 'Vazir-Regular.ttf'),
            os.path.join(settings.MEDIA_ROOT, 'fonts', 'BNazanin.ttf'),
            os.path.join(settings.BASE_DIR, 'static', 'fonts', 'Vazir.ttf'),
            # Common system paths
            '/usr/share/fonts/truetype/vazir/Vazir-Regular.ttf',
            '/System/Library/Fonts/Arial.ttf',  # macOS
        ]

        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    font_name = 'PersianFont'
                    pdfmetrics.registerFont(TTFont(font_name, font_path))
                    print(f"✅ Successfully loaded Persian font: {font_path}")
                    return font_name
                except Exception as e:
                    print(f"❌ Failed to load font {font_path}: {e}")
                    continue

        # Method 2: Use built-in fonts that support Unicode
        try:
            # Try to use Helvetica (which has some Unicode support)
            return 'Helvetica'
        except:
            print("⚠️ Using default font")
            return 'Helvetica'

    def reshape_persian_text(self, text):
        """Properly reshape Persian text to fix rendering issues"""
        if not text:
            return ""

        try:
            # Convert to string first
            text_str = str(text)

            # Don't reshape English text, numbers, or special characters
            if self.is_english_only(text_str):
                return text_str

            # Reshape Persian/Arabic text
            reshaped = arabic_reshaper.reshape(
                text_str,
                delete_harakat=False,  # Keep diacritics
                shift_harakat_position=False
            )

            # Apply bidirectional algorithm
            display_text = get_display(reshaped)
            return display_text

        except Exception as e:
            print(f"❌ Error reshaping text '{text}': {e}")
            # Fallback: return original text
            return str(text)

    def is_english_only(self, text):
        """Check if text contains only English characters, numbers, and symbols"""
        if not text:
            return True

        # Check if text contains Persian/Arabic characters
        for char in text:
            # Persian/Arabic Unicode ranges
            if '\u0600' <= char <= '\u06FF' or '\u0750' <= char <= '\u077F':
                return False
        return True

    def format_persian_number(self, number):
        """Convert English numbers to Persian numerals"""
        if not number:
            return ""

        # Persian digits mapping
        persian_digits = {
            '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
            '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹'
        }

        number_str = str(number)
        persian_number = ""

        for char in number_str:
            if char in persian_digits:
                persian_number += persian_digits[char]
            else:
                persian_number += char  # Keep non-digit characters (like commas, dots)

        return persian_number

    def format_price(self, amount):
        """Format price with Persian numerals and Rial"""
        if not amount or amount == 0:
            return self.reshape_persian_text("تماس بگیرید")

        try:
            # Format with thousand separators
            formatted = f"{float(amount):,.0f}"
            # Convert to Persian numerals
            persian_amount = self.format_persian_number(formatted)
            # Add currency
            return f"{persian_amount} {self.reshape_persian_text('ریال')}"
        except:
            return self.reshape_persian_text("تماس بگیرید")

    def add_letterhead(self, elements):
        """Add letterhead image"""
        try:
            # Look for letterhead in multiple locations
            letterhead_paths = [
                os.path.join(settings.MEDIA_ROOT, 'letterhead.jpg'),
                os.path.join(settings.MEDIA_ROOT, 'letterhead.png'),
                os.path.join(settings.MEDIA_ROOT, 'images', 'letterhead.jpg'),
                os.path.join(settings.BASE_DIR, 'static', 'images', 'letterhead.jpg'),
            ]

            letterhead_path = None
            for path in letterhead_paths:
                if os.path.exists(path):
                    letterhead_path = path
                    break

            if letterhead_path:
                # Add letterhead with proper sizing
                letterhead_img = Image(letterhead_path)
                # Scale to fit page width
                page_width = A4[0] - 4 * cm
                img_width, img_height = letterhead_img.drawWidth, letterhead_img.drawHeight

                if img_width > page_width:
                    scale = page_width / img_width
                    letterhead_img = Image(letterhead_path,
                                           width=page_width,
                                           height=img_height * scale)

                elements.append(letterhead_img)
                elements.append(Spacer(1, 20))
                print("✅ Letterhead added successfully")
            else:
                self.add_text_header(elements)

        except Exception as e:
            print(f"❌ Error adding letterhead: {e}")
            self.add_text_header(elements)

    def add_text_header(self, elements):
        """Fallback text header"""
        header_style = ParagraphStyle(
            'CompanyHeader',
            fontName=self.persian_font,
            fontSize=16,
            alignment=1,  # Center
            textColor=colors.darkblue,
            spaceAfter=20
        )

        company_name = self.reshape_persian_text("شرکت کیان تجارت پویا کاویر")
        elements.append(Paragraph(company_name, header_style))

    def create_styled_table(self, data, col_widths, header_row=True):
        """Create a properly styled table with Persian text"""
        table = Table(data, colWidths=col_widths)

        style_commands = [
            ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]

        if header_row:
            style_commands.extend([
                ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
            ])
        else:
            style_commands.append(
                ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey)
            )

        table.setStyle(TableStyle(style_commands))
        return table

    def generate_pdf(self):
        """Generate the PDF invoice"""
        buffer = BytesIO()

        # Create document with proper page setup
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

        # Add letterhead
        self.add_letterhead(elements)

        # Invoice title
        title_style = ParagraphStyle(
            'InvoiceTitle',
            fontName=self.persian_font,
            fontSize=20,
            alignment=1,  # Center
            textColor=colors.darkred,
            spaceAfter=30,
            spaceBefore=10
        )

        invoice_type = "پیش‌فاکتور" if self.invoice.invoice_type == 'pre_invoice' else "فاکتور نهایی"
        title_text = f"{invoice_type} شماره {self.format_persian_number(self.invoice.invoice_number)}"
        elements.append(Paragraph(self.reshape_persian_text(title_text), title_style))

        # Section header style
        section_style = ParagraphStyle(
            'SectionHeader',
            fontName=self.persian_font,
            fontSize=14,
            textColor=colors.darkblue,
            alignment=2,  # Right align
            spaceAfter=10,
            spaceBefore=20
        )

        # Customer Information
        elements.append(Paragraph(self.reshape_persian_text("اطلاعات مشتری"), section_style))

        customer_data = [
            [self.reshape_persian_text("نام مشتری:"), self.reshape_persian_text(self.order.customer.name or "نامشخص")],
            [self.reshape_persian_text("ایمیل:"), self.order.customer.email or "ندارد"],
            [self.reshape_persian_text("تلفن:"), self.format_persian_number(
                self.order.customer.phone) if self.order.customer.phone else self.reshape_persian_text("ندارد")],
            [self.reshape_persian_text("شرکت:"), self.reshape_persian_text(self.order.customer.company_name or "شخصی")]
        ]

        customer_table = self.create_styled_table(customer_data, [4 * cm, 10 * cm], header_row=False)
        elements.append(customer_table)
        elements.append(Spacer(1, 20))

        # Invoice Details
        elements.append(Paragraph(self.reshape_persian_text("جزئیات فاکتور"), section_style))

        # Format dates properly
        try:
            issue_date = self.invoice.issued_at.strftime('%Y/%m/%d')
            order_date = self.order.created_at.strftime('%Y/%m/%d')
            due_date = self.invoice.due_date.strftime('%Y/%m/%d') if self.invoice.due_date else "تعیین نشده"
        except:
            issue_date = order_date = due_date = "نامشخص"

        invoice_details_data = [
            [self.reshape_persian_text("شماره سفارش:"), self.format_persian_number(str(self.order.id))],
            [self.reshape_persian_text("تاریخ سفارش:"), self.format_persian_number(order_date)],
            [self.reshape_persian_text("تاریخ صدور:"), self.format_persian_number(issue_date)],
            [self.reshape_persian_text("نوع فاکتور:"), self.reshape_persian_text(invoice_type)],
            [self.reshape_persian_text("سررسید:"),
             self.format_persian_number(due_date) if due_date != "تعیین نشده" else self.reshape_persian_text(due_date)]
        ]

        details_table = self.create_styled_table(invoice_details_data, [4 * cm, 10 * cm], header_row=False)
        elements.append(details_table)
        elements.append(Spacer(1, 30))

        # Order Items
        elements.append(Paragraph(self.reshape_persian_text("اقلام سفارش"), section_style))

        # Items table
        items_data = [[
            self.reshape_persian_text("ردیف"),
            self.reshape_persian_text("نام محصول"),
            self.reshape_persian_text("تعداد"),
            self.reshape_persian_text("قیمت واحد"),
            self.reshape_persian_text("جمع کل")
        ]]

        # Add items
        for idx, item in enumerate(self.order.items.all(), 1):
            items_data.append([
                self.format_persian_number(str(idx)),
                self.reshape_persian_text(item.product.name),
                self.format_persian_number(str(item.final_quantity)),
                self.format_price(item.quoted_unit_price),
                self.format_price(item.total_price)
            ])

        items_table = self.create_styled_table(items_data, [1.5 * cm, 6 * cm, 2 * cm, 3 * cm, 3.5 * cm],
                                               header_row=True)
        elements.append(items_table)
        elements.append(Spacer(1, 30))

        # Financial Summary
        elements.append(Paragraph(self.reshape_persian_text("خلاصه مالی"), section_style))

        totals_data = [
            [self.reshape_persian_text("جمع کل:"), self.format_price(self.invoice.total_amount)],
            [self.reshape_persian_text("تخفیف:"), self.format_price(self.invoice.discount)],
            [self.reshape_persian_text("مالیات:"), self.format_price(self.invoice.tax_amount)],
            [self.reshape_persian_text("مبلغ قابل پرداخت:"), self.format_price(self.invoice.payable_amount)]
        ]

        totals_table = Table(totals_data, colWidths=[8 * cm, 6 * cm])
        totals_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
            ('FONTSIZE', (0, 0), (-1, -2), 11),
            ('FONTSIZE', (0, -1), (-1, -1), 14),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightblue),
            ('LINEBELOW', (0, -1), (-1, -1), 2, colors.darkblue),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))

        elements.append(totals_table)

        # Comments if any
        if self.order.admin_comment:
            elements.append(Spacer(1, 20))
            elements.append(Paragraph(self.reshape_persian_text("توضیحات:"), section_style))

            comment_style = ParagraphStyle(
                'Comments',
                fontName=self.persian_font,
                fontSize=10,
                alignment=2,  # Right align
                textColor=colors.black
            )

            elements.append(Paragraph(self.reshape_persian_text(self.order.admin_comment), comment_style))

        # Footer
        elements.append(Spacer(1, 40))
        footer_style = ParagraphStyle(
            'Footer',
            fontName=self.persian_font,
            fontSize=9,
            alignment=1,  # Center
            textColor=colors.grey
        )

        current_time = datetime.now()
        footer_text = f"تاریخ تولید: {self.format_persian_number(current_time.strftime('%Y/%m/%d'))} - ساعت: {self.format_persian_number(current_time.strftime('%H:%M'))}"
        elements.append(Paragraph(self.reshape_persian_text(footer_text), footer_style))

        # Build PDF
        try:
            doc.build(elements)
            print("✅ PDF generated successfully")
        except Exception as e:
            print(f"❌ Error building PDF: {e}")
            raise

        buffer.seek(0)
        return buffer

    def get_http_response(self, filename=None):
        """Return HTTP response with PDF"""
        if not filename:
            filename = f"invoice_{self.invoice.invoice_number}.pdf"

        try:
            pdf_buffer = self.generate_pdf()
            response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        except Exception as e:
            print(f"❌ Error generating PDF response: {e}")
            # Return a simple error PDF
            error_buffer = BytesIO()
            error_doc = SimpleDocTemplate(error_buffer, pagesize=A4)
            error_elements = [Paragraph("Error generating invoice", getSampleStyleSheet()['Normal'])]
            error_doc.build(error_elements)
            error_buffer.seek(0)

            response = HttpResponse(error_buffer.getvalue(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="error_{filename}"'
            return response


# Update your Invoice model (tasks/models.py) to use this generator:
"""
def generate_pdf(self):
    generator = FixedPersianInvoicePDFGenerator(self)
    pdf_buffer = generator.generate_pdf()

    filename = f"invoice_{self.invoice_number}.pdf"
    self.pdf_file.save(filename, ContentFile(pdf_buffer.getvalue()))
    return self.pdf_file

def download_pdf_response(self):
    generator = FixedPersianInvoicePDFGenerator(self)
    return generator.get_http_response()
"""