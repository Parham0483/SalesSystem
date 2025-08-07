# tasks/services/unofficial_invoice_pdf.py
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
import os
import jdatetime


class UnofficialInvoicePDFGenerator:
    """Generator for unofficial invoices """

    def __init__(self, order, invoice=None):
        self.order = order
        self.invoice = invoice
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
            'signature': ParagraphStyle(
                'signature',
                fontName=self.persian_font,
                fontSize=10,
                alignment=TA_CENTER,
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
        """Add header section with title and date"""
        # Get invoice date (use invoice issued date or order creation date)
        if self.invoice and self.invoice.issued_at:
            invoice_date = jdatetime.date.fromgregorian(date=self.invoice.issued_at.date())
        else:
            invoice_date = jdatetime.date.fromgregorian(date=self.order.created_at.date())

        date_str = invoice_date.strftime('%Y/%m/%d')

        title = "فاکتور فروش شخصی"

        # Invoice number (use invoice number if available, otherwise order number)
        if self.invoice and self.invoice.invoice_number:
            serial_info_text = f"شماره فاکتور: {self.invoice.invoice_number}\nتاریخ: {date_str}"
        else:
            serial_info_text = f"شماره سفارش: {self.order.id}\nتاریخ: {date_str}"

        header_data = [[self._para(serial_info_text, 'default'), self._para(title, 'title')]]
        col_widths = [self.content_width * 0.5, self.content_width * 0.5]

        header_table = Table(header_data, colWidths=col_widths)
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('ALIGN', (0, 0), (0, 0), 'RIGHT'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 8 * mm))

    def add_parties_section(self, elements):
        """Add seller and buyer names in simple format"""
        # Seller name
        seller_name = settings.BUSINESS_NAME
        buyer_name = self.customer.name

        # Add company name if exists
        if getattr(self.customer, 'company_name', ''):
            buyer_name = f"{self.customer.company_name} ({self.customer.name})"

        parties_data = [
            [self._para(seller_name, 'default'),self._para("نام فروشنده:", 'default'),],
            [self._para(buyer_name, 'default'), self._para("نام خریدار:", 'default')]
        ]

        parties_table = Table(parties_data, colWidths=[self.content_width * 0.8, self.content_width * 0.2])
        parties_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ]))

        elements.append(parties_table)
        elements.append(Spacer(1, 8 * mm))

    def add_items_section(self, elements):
        """Add items (اجناس) section"""
        # Items header
        elements.append(self._para("اجناس:", 'default'))
        elements.append(Spacer(1, 3 * mm))

        # Simple items table
        headers = [
            "مبلغ کل (ریال)", "قیمت واحد (ریال)", "تعداد", "نام کالا", "ردیف"
        ]

        col_widths = [
            self.content_width * 0.22,  # مبلغ کل
            self.content_width * 0.22,  # قیمت واحد
            self.content_width * 0.12,  # تعداد
            self.content_width * 0.34,  # نام کالا
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
            ('FONTNAME', (0, 0), (-1, -1), self.persian_font),
        ]))
        elements.append(items_table)

    def add_signature_section(self, elements):
        """Add signature section (مهر و امضا)"""
        elements.append(Spacer(1, 15 * mm))

        # Signature boxes
        signature_data = [
            [self._para("مهر و امضای خریدار", 'signature'), self._para("مهر و امضای فروشنده", 'signature')]
        ]

        signature_table = Table(signature_data,
                                colWidths=[self.content_width * 0.5, self.content_width * 0.5],
                                rowHeights=[25 * mm])
        signature_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ]))

        elements.append(signature_table)

    def add_footer_note(self, elements):
        """Add footer note about unofficial invoice"""
        elements.append(Spacer(1, 8 * mm))

        note_text = "توجه: این فاکتور شخصی بوده و شامل مالیات بر ارزش افزوده نمی‌باشد"
        note_table = Table([[self._para(note_text, 'default')]],
                           colWidths=[self.content_width])
        note_table.setStyle(TableStyle([
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('BACKGROUND', (0, 0), (-1, -1), colors.lightgrey),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))

        elements.append(note_table)

    def generate_pdf(self):
        """Generate the complete unofficial invoice PDF"""
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            topMargin=45 * mm,  # Space for letterhead header
            bottomMargin=25 * mm,  # Space for letterhead footer
            rightMargin=self.margin,
            leftMargin=self.margin,
        )

        # Assemble all parts of the unofficial invoice
        elements = []
        self.add_header_section(elements)
        self.add_parties_section(elements)
        self.add_items_section(elements)
        self.add_signature_section(elements)
        self.add_footer_note(elements)

        # Build with background
        doc.build(elements, onFirstPage=self.draw_background, onLaterPages=self.draw_background)
        return buffer

    def get_http_response(self):
        """Return HTTP response with PDF"""
        buffer = self.generate_pdf()

        # Generate filename
        if self.invoice and self.invoice.invoice_number:
            filename = f"invoice_{self.invoice.invoice_number}_unofficial.pdf"
        else:
            filename = f"invoice_{self.order.id}_unofficial.pdf"

        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response