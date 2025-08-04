# Update tasks/services/simple_persian_pdf.py - add these methods

import os
from django.conf import settings
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from bidi.algorithm import get_display
import arabic_reshaper
from django.http import HttpResponse


class FixedPersianInvoicePDFGenerator:
    def __init__(self, invoice):
        self.invoice = invoice
        self.order = invoice.order
        self.persian_font = 'Vazir'
        self.setup_fonts()

    def setup_fonts(self):
        """Setup Persian fonts"""
        try:
            font_path = os.path.join(settings.BASE_DIR, 'static', 'fonts', 'Vazir.ttf')
            if os.path.exists(font_path):
                pdfmetrics.registerFont(TTFont('Vazir', font_path))
            else:
                # Fallback to system fonts
                self.persian_font = 'Helvetica'
        except Exception as e:
            print(f"Font setup error: {e}")
            self.persian_font = 'Helvetica'

    def reshape_persian_text(self, text):
        """Handle Persian text shaping and direction"""
        if not text:
            return ""
        try:
            reshaped_text = arabic_reshaper.reshape(str(text))
            return get_display(reshaped_text)
        except:
            return str(text)

    def format_persian_number(self, number):
        """Convert English numbers to Persian"""
        if number is None:
            return ""

        english_to_persian = {
            '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴',
            '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹'
        }

        result = str(number)
        for eng, per in english_to_persian.items():
            result = result.replace(eng, per)
        return result

    def get_business_info(self):
        """Get business information from settings"""
        return {
            'name': getattr(settings, 'BUSINESS_NAME', 'شرکت دستیخت مادر بزرگ'),
            'national_id': getattr(settings, 'BUSINESS_NATIONAL_ID', ''),
            'economic_id': getattr(settings, 'BUSINESS_ECONOMIC_ID', ''),
            'address': getattr(settings, 'BUSINESS_ADDRESS', ''),
            'phone': getattr(settings, 'BUSINESS_PHONE', ''),
            'postal_code': getattr(settings, 'BUSINESS_POSTAL_CODE', ''),
        }

    def create_styled_table(self, data, col_widths, header_row=True):
        """Create a styled table"""
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

        table.setStyle(TableStyle(style_commands))
        return table

    def generate_official_invoice(self):
        """Generate official invoice with all required fields"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
            title=f"Official-Invoice-{self.invoice.invoice_number}"
        )

        elements = []
        business_info = self.get_business_info()

        # Title
        title_style = ParagraphStyle(
            'InvoiceTitle',
            fontName=self.persian_font,
            fontSize=20,
            alignment=1,  # Center
            textColor=colors.darkred,
            spaceAfter=20,
            spaceBefore=10
        )

        invoice_type = "فاکتور رسمی"
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
            spaceBefore=15
        )

        # Vendor Information (مشخصات فروشنده)
        elements.append(Paragraph(self.reshape_persian_text("مشخصات فروشنده"), section_style))

        vendor_data = [
            [self.reshape_persian_text("نام فروشنده:"), self.reshape_persian_text(business_info['name'])],
            [self.reshape_persian_text("شناسه ملی:"), self.format_persian_number(business_info['national_id'])],
            [self.reshape_persian_text("شناسه اقتصادی:"), self.format_persian_number(business_info['economic_id'])],
            [self.reshape_persian_text("آدرس:"), self.reshape_persian_text(business_info['address'])],
            [self.reshape_persian_text("شماره تماس:"), self.format_persian_number(business_info['phone'])],
            [self.reshape_persian_text("کد پستی:"), self.format_persian_number(business_info['postal_code'])],
        ]

        vendor_table = self.create_styled_table(vendor_data, [4 * cm, 10 * cm], header_row=False)
        elements.append(vendor_table)
        elements.append(Spacer(1, 15))

        # Customer Information (مشخصات خریدار)
        elements.append(Paragraph(self.reshape_persian_text("مشخصات خریدار"), section_style))

        customer = self.order.customer
        customer_data = [
            [self.reshape_persian_text("نام خریدار:"), self.reshape_persian_text(customer.name or "نامشخص")],
            [self.reshape_persian_text("شناسه ملی:"), self.format_persian_number(customer.national_id or "ندارد")],
            [self.reshape_persian_text("شناسه اقتصادی:"), self.format_persian_number(customer.economic_id or "ندارد")],
            [self.reshape_persian_text("آدرس کامل:"), self.reshape_persian_text(customer.complete_address or "ندارد")],
            [self.reshape_persian_text("شماره تماس:"), self.format_persian_number(customer.phone or "ندارد")],
            [self.reshape_persian_text("کد پستی:"), self.format_persian_number(customer.postal_code or "ندارد")],
            [self.reshape_persian_text("شرکت:"), self.reshape_persian_text(customer.company_name or "شخصی")],
        ]

        customer_table = self.create_styled_table(customer_data, [4 * cm, 10 * cm], header_row=False)
        elements.append(customer_table)
        elements.append(Spacer(1, 20))

        # Invoice Details
        self._add_invoice_details(elements, section_style)

        # Items Table
        self._add_items_table(elements, section_style)

        # Totals and signature
        self._add_totals_and_signature(elements)

        doc.build(elements)
        return buffer

    def generate_unofficial_invoice(self):
        """Generate unofficial invoice with minimal fields"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2 * cm,
            leftMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
            title=f"Unofficial-Invoice-{self.invoice.invoice_number}"
        )

        elements = []
        business_info = self.get_business_info()

        # Title
        title_style = ParagraphStyle(
            'InvoiceTitle',
            fontName=self.persian_font,
            fontSize=20,
            alignment=1,  # Center
            textColor=colors.darkblue,
            spaceAfter=20,
            spaceBefore=10
        )

        invoice_type = "فاکتور غیررسمی"
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
            spaceBefore=15
        )

        # Simple vendor info
        elements.append(Paragraph(self.reshape_persian_text("فروشنده"), section_style))
        vendor_simple = [
            [self.reshape_persian_text("نام فروشنده:"), self.reshape_persian_text(business_info['name'])],
        ]
        vendor_table = self.create_styled_table(vendor_simple, [4 * cm, 10 * cm], header_row=False)
        elements.append(vendor_table)
        elements.append(Spacer(1, 15))

        # Simple customer info
        elements.append(Paragraph(self.reshape_persian_text("خریدار"), section_style))
        customer = self.order.customer
        customer_simple = [
            [self.reshape_persian_text("نام خریدار:"), self.reshape_persian_text(customer.name or "نامشخص")],
        ]
        customer_table = self.create_styled_table(customer_simple, [4 * cm, 10 * cm], header_row=False)
        elements.append(customer_table)
        elements.append(Spacer(1, 15))

        # Date
        elements.append(Paragraph(self.reshape_persian_text("تاریخ"), section_style))
        try:
            issue_date = self.invoice.issued_at.strftime('%Y/%m/%d')
        except:
            issue_date = "نامشخص"

        date_data = [
            [self.reshape_persian_text("تاریخ صدور:"), self.format_persian_number(issue_date)],
        ]
        date_table = self.create_styled_table(date_data, [4 * cm, 10 * cm], header_row=False)
        elements.append(date_table)
        elements.append(Spacer(1, 20))

        # Items Table (simplified)
        self._add_items_table(elements, section_style, simplified=True)

        # Simple totals and signature
        self._add_totals_and_signature(elements, simplified=True)

        doc.build(elements)
        return buffer

    def _add_invoice_details(self, elements, section_style):
        """Add invoice details section"""
        elements.append(Paragraph(self.reshape_persian_text("جزئیات فاکتور"), section_style))

        try:
            issue_date = self.invoice.issued_at.strftime('%Y/%m/%d')
            order_date = self.order.created_at.strftime('%Y/%m/%d')
            due_date = self.invoice.due_date.strftime('%Y/%m/%d') if self.invoice.due_date else "تعیین نشده"
        except:
            issue_date = order_date = due_date = "نامشخص"

        invoice_type = "فاکتور رسمی" if self.order.business_invoice_type == 'official' else "فاکتور غیررسمی"

        details_data = [
            [self.reshape_persian_text("شماره سفارش:"), self.format_persian_number(str(self.order.id))],
            [self.reshape_persian_text("تاریخ سفارش:"), self.format_persian_number(order_date)],
            [self.reshape_persian_text("تاریخ صدور:"), self.format_persian_number(issue_date)],
            [self.reshape_persian_text("نوع فاکتور:"), self.reshape_persian_text(invoice_type)],
            [self.reshape_persian_text("سررسید:"),
             self.format_persian_number(due_date) if due_date != "تعیین نشده" else self.reshape_persian_text(due_date)]
        ]

        details_table = self.create_styled_table(details_data, [4 * cm, 10 * cm], header_row=False)
        elements.append(details_table)
        elements.append(Spacer(1, 20))

    def _add_items_table(self, elements, section_style, simplified=False):
        """Add items table"""
        elements.append(Paragraph(self.reshape_persian_text("اجناس خریداری شده"), section_style))

        if simplified:
            # Simplified table for unofficial invoice
            items_data = [[
                self.reshape_persian_text("ردیف"),
                self.reshape_persian_text("نام محصول"),
                self.reshape_persian_text("تعداد"),
                self.reshape_persian_text("مبلغ کل")
            ]]
            col_widths = [2 * cm, 6 * cm, 3 * cm, 3 * cm]
        else:
            # Full table for official invoice
            items_data = [[
                self.reshape_persian_text("ردیف"),
                self.reshape_persian_text("نام محصول"),
                self.reshape_persian_text("تعداد"),
                self.reshape_persian_text("قیمت واحد"),
                self.reshape_persian_text("مبلغ کل")
            ]]
            col_widths = [2 * cm, 5 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm]

        # Add items
        for index, item in enumerate(self.order.items.all(), 1):
            if simplified:
                row = [
                    self.format_persian_number(str(index)),
                    self.reshape_persian_text(item.product.name),
                    self.format_persian_number(str(item.final_quantity or item.requested_quantity)),
                    self.format_persian_number(f"{item.total_price:,.0f}")
                ]
            else:
                row = [
                    self.format_persian_number(str(index)),
                    self.reshape_persian_text(item.product.name),
                    self.format_persian_number(str(item.final_quantity or item.requested_quantity)),
                    self.format_persian_number(f"{item.quoted_unit_price:,.0f}"),
                    self.format_persian_number(f"{item.total_price:,.0f}")
                ]
            items_data.append(row)

        items_table = self.create_styled_table(items_data, col_widths)
        elements.append(items_table)
        elements.append(Spacer(1, 20))

    def _add_totals_and_signature(self, elements, simplified=False):
        """Add totals and signature section"""
        # Totals
        total_style = ParagraphStyle(
            'TotalStyle',
            fontName=self.persian_font,
            fontSize=14,
            alignment=2,
            spaceAfter=10
        )

        total_amount = self.invoice.payable_amount or self.invoice.total_amount
        total_text = f"مجموع کل: {self.format_persian_number(f'{total_amount:,.0f}')} تومان"
        elements.append(Paragraph(self.reshape_persian_text(total_text), total_style))

        if not simplified and self.invoice.tax_amount > 0:
            tax_text = f"مالیات: {self.format_persian_number(f'{self.invoice.tax_amount:,.0f}')} تومان"
            elements.append(Paragraph(self.reshape_persian_text(tax_text), total_style))

        elements.append(Spacer(1, 30))

        # Signature section
        signature_data = [
            [self.reshape_persian_text("مهر و امضای فروشنده"), self.reshape_persian_text("مهر و امضای خریدار")],
            ["", ""],  # Empty row for signatures
            ["", ""]  # Empty row for signatures
        ]

        signature_table = self.create_styled_table(signature_data, [7 * cm, 7 * cm], header_row=True)
        elements.append(signature_table)

    def generate_pdf(self):
        """Generate PDF based on invoice type"""
        if self.order.business_invoice_type == 'official':
            return self.generate_official_invoice()
        else:
            return self.generate_unofficial_invoice()

    def get_http_response(self):
        """Return HTTP response with PDF"""
        buffer = self.generate_pdf()

        filename = f"invoice_{self.invoice.invoice_number}_{self.order.business_invoice_type}.pdf"

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response