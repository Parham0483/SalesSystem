# Create tasks/services/__init__.py (empty file)

# Create tasks/services/persian_pdf_generator.py
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
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


class PersianInvoicePDFGenerator:
    def __init__(self, invoice):
        self.invoice = invoice
        self.order = invoice.order
        self.setup_persian_fonts()

    def setup_persian_fonts(self):
        """Setup Persian fonts for PDF generation"""
        # Try to load Persian font, fallback to default
        font_path = os.path.join(settings.MEDIA_ROOT, 'fonts', 'Vazir.ttf')
        if os.path.exists(font_path):
            try:
                pdfmetrics.registerFont(TTFont('Vazir', font_path))
                self.persian_font = 'Vazir'
            except:
                self.persian_font = 'Helvetica'
        else:
            self.persian_font = 'Helvetica'

    def reshape_persian_text(self, text):
        """Reshape Persian text for proper display"""
        if not text:
            return ""
        try:
            reshaped_text = arabic_reshaper.reshape(str(text))
            return get_display(reshaped_text)
        except:
            return str(text)

    def format_persian_number(self, number):
        """Convert numbers to Persian numerals"""
        persian_digits = '۰۱۲۳۴۵۶۷۸۹'
        english_digits = '0123456789'

        number_str = str(number)
        for i, digit in enumerate(english_digits):
            number_str = number_str.replace(digit, persian_digits[i])
        return number_str

    def format_price(self, amount):
        """Format price in Persian with Rial"""
        if not amount:
            return ""
        # Format with thousand separators
        formatted = f"{amount:,.0f}"
        # Convert to Persian numerals
        persian_amount = self.format_persian_number(formatted)
        return f"{persian_amount} ریال"

    def generate_pdf(self):
        """Generate Persian PDF invoice"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm
        )

        elements = []

        # Create Persian styles
        styles = getSampleStyleSheet()

        # Title style (RTL)
        title_style = ParagraphStyle(
            'PersianTitle',
            parent=styles['Heading1'],
            fontName=self.persian_font,
            fontSize=20,
            spaceAfter=20,
            alignment=2,  # Right alignment for RTL
            rightIndent=0,
            leftIndent=0
        )

        # Regular Persian style
        persian_style = ParagraphStyle(
            'Persian',
            parent=styles['Normal'],
            fontName=self.persian_font,
            fontSize=11,
            alignment=2,  # Right alignment
            rightIndent=0,
            leftIndent=0
        )

        # Add invoice header
        invoice_title = self.reshape_persian_text(f"فاکتور شماره {self.invoice.invoice_number}")
        elements.append(Paragraph(invoice_title, title_style))
        elements.append(Spacer(1, 20))

        # Company information
        company_info = self.reshape_persian_text("اطلاعات شرکت")
        elements.append(Paragraph(company_info, ParagraphStyle(
            'SectionHeader',
            parent=persian_style,
            fontSize=14,
            textColor=colors.darkblue,
            spaceAfter=10
        )))

        # Company details table
        company_data = [
            [self.reshape_persian_text("نام شرکت:"), self.reshape_persian_text("شرکت نمونه")],
            [self.reshape_persian_text("آدرس:"), self.reshape_persian_text("تهران، خیابان ولیعصر")],
            [self.reshape_persian_text("تلفن:"), self.format_persian_number("021-12345678")],
            [self.reshape_persian_text("ایمیل:"), "info@company.com"]
        ]

        company_table = Table(company_data, colWidths=[4 * cm, 8 * cm])
        company_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))

        elements.append(company_table)
        elements.append(Spacer(1, 20))

        # Customer information
        customer_info = self.reshape_persian_text("اطلاعات مشتری")
        elements.append(Paragraph(customer_info, ParagraphStyle(
            'SectionHeader',
            parent=persian_style,
            fontSize=14,
            textColor=colors.darkblue,
            spaceAfter=10
        )))

        customer_data = [
            [self.reshape_persian_text("نام مشتری:"), self.reshape_persian_text(self.order.customer.name)],
            [self.reshape_persian_text("ایمیل:"), self.order.customer.email],
            [self.reshape_persian_text("تلفن:"), self.format_persian_number(self.order.customer.phone or "ندارد")],
            [self.reshape_persian_text("نام شرکت:"),
             self.reshape_persian_text(self.order.customer.company_name or "ندارد")]
        ]

        customer_table = Table(customer_data, colWidths=[4 * cm, 8 * cm])
        customer_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))

        elements.append(customer_table)
        elements.append(Spacer(1, 20))

        # Invoice details
        invoice_details_header = self.reshape_persian_text("جزئیات فاکتور")
        elements.append(Paragraph(invoice_details_header, ParagraphStyle(
            'SectionHeader',
            parent=persian_style,
            fontSize=14,
            textColor=colors.darkblue,
            spaceAfter=10
        )))

        # Convert dates to Persian
        issue_date = self.invoice.issued_at.strftime('%Y/%m/%d')
        due_date = self.invoice.due_date.strftime('%Y/%m/%d') if self.invoice.due_date else "تعیین نشده"

        invoice_details_data = [
            [self.reshape_persian_text("تاریخ صدور:"), self.format_persian_number(issue_date)],
            [self.reshape_persian_text("تاریخ سفارش:"),
             self.format_persian_number(self.order.created_at.strftime('%Y/%m/%d'))],
            [self.reshape_persian_text("نوع فاکتور:"),
             self.reshape_persian_text("پیش‌فاکتور" if self.invoice.invoice_type == 'pre_invoice' else "فاکتور نهایی")],
            [self.reshape_persian_text("سررسید:"), self.format_persian_number(due_date)]
        ]

        details_table = Table(invoice_details_data, colWidths=[4 * cm, 8 * cm])
        details_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))

        elements.append(details_table)
        elements.append(Spacer(1, 30))

        # Order items
        items_header = self.reshape_persian_text("اقلام سفارش")
        elements.append(Paragraph(items_header, ParagraphStyle(
            'SectionHeader',
            parent=persian_style,
            fontSize=14,
            textColor=colors.darkblue,
            spaceAfter=10
        )))

        # Items table header
        items_data = [[
            self.reshape_persian_text("نام محصول"),
            self.reshape_persian_text("تعداد"),
            self.reshape_persian_text("قیمت واحد"),
            self.reshape_persian_text("جمع کل")
        ]]

        # Add items
        for item in self.order.items.all():
            items_data.append([
                self.reshape_persian_text(item.product.name),
                self.format_persian_number(item.final_quantity),
                self.format_price(item.quoted_unit_price),
                self.format_price(item.total_price)
            ])

        items_table = Table(items_data, colWidths=[6 * cm, 2 * cm, 3 * cm, 3 * cm])
        items_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 0), (-1, 0), self.persian_font),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
        ]))

        elements.append(items_table)
        elements.append(Spacer(1, 20))

        # Totals section
        totals_data = [
            [self.reshape_persian_text("جمع کل:"), self.format_price(self.invoice.total_amount)],
            [self.reshape_persian_text("تخفیف:"), self.format_price(self.invoice.discount)],
            [self.reshape_persian_text("مالیات:"), self.format_price(self.invoice.tax_amount)],
            [self.reshape_persian_text("مبلغ قابل پرداخت:"), self.format_price(self.invoice.payable_amount)]
        ]

        totals_table = Table(totals_data, colWidths=[8 * cm, 4 * cm])
        totals_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -2), self.persian_font),
            ('FONTNAME', (0, -1), (-1, -1), self.persian_font),
            ('FONTSIZE', (0, 0), (-1, -2), 11),
            ('FONTSIZE', (0, -1), (-1, -1), 13),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightblue),
            ('LINEBELOW', (0, -1), (-1, -1), 2, colors.darkblue),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))

        elements.append(totals_table)

        # Add comments if any
        if self.order.admin_comment:
            elements.append(Spacer(1, 20))
            comments_header = self.reshape_persian_text("توضیحات:")
            elements.append(Paragraph(comments_header, ParagraphStyle(
                'SectionHeader',
                parent=persian_style,
                fontSize=12,
                textColor=colors.darkblue,
                spaceAfter=5
            )))

            comment_text = self.reshape_persian_text(self.order.admin_comment)
            elements.append(Paragraph(comment_text, persian_style))

        # Build PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer

    def get_http_response(self, filename=None):
        """Return HTTP response with PDF"""
        if not filename:
            filename = f"invoice_{self.invoice.invoice_number}.pdf"

        pdf_buffer = self.generate_pdf()
        response = HttpResponse(pdf_buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response