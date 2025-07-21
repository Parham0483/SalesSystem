# tasks/services/simple_pdf_generator.py - Simple fallback version
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.units import inch, cm
from django.http import HttpResponse
from io import BytesIO
from decimal import Decimal
from datetime import datetime


class SimpleInvoicePDFGenerator:
    def __init__(self, invoice):
        self.invoice = invoice
        self.order = invoice.order

    def format_price(self, amount):
        """Format price with Rial"""
        if not amount:
            return "0"
        formatted = f"{amount:,.0f}"
        return f"{formatted} Rial"

    def generate_pdf(self):
        """Generate simple English PDF invoice"""
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
        styles = getSampleStyleSheet()

        # Title
        title_style = ParagraphStyle(
            'InvoiceTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=20,
            alignment=1,
            textColor=colors.darkblue
        )

        elements.append(Paragraph(f"INVOICE {self.invoice.invoice_number}", title_style))
        elements.append(Spacer(1, 30))

        # Company and Customer Info Side by Side
        info_data = [
            ["FROM:", "TO:"],
            ["Yan Tejarat Puya Kavir", self.order.customer.name],
            ["Yazd, Modarres Blvd", self.order.customer.email],
            ["Phone: 021-12345678", f"Company: {self.order.customer.company_name or 'N/A'}"],
            ["gtc.1210770@gmail.com", f"Phone: {self.order.customer.phone or 'N/A'}"]
        ]

        info_table = Table(info_data, colWidths=[8 * cm, 8 * cm])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('FONTSIZE', (0, 0), (-1, 0), 12),  # Header row
            ('FONTWEIGHT', (0, 0), (-1, 0), 'BOLD'),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LINEBELOW', (0, 0), (-1, 0), 1, colors.black),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
        ]))

        elements.append(info_table)
        elements.append(Spacer(1, 30))

        # Invoice Details
        details_data = [
            ["Invoice Date:", self.invoice.issued_at.strftime('%B %d, %Y')],
            ["Order Date:", self.order.created_at.strftime('%B %d, %Y')],
            ["Invoice Type:", "Pre-Invoice" if self.invoice.invoice_type == 'pre_invoice' else "Final Invoice"],
            ["Payment Terms:", "Net 30 Days"]
        ]

        details_table = Table(details_data, colWidths=[4 * cm, 6 * cm])
        details_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))

        elements.append(details_table)
        elements.append(Spacer(1, 30))

        # Items Table
        items_data = [["DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"]]

        total_amount = Decimal('0.00')
        for item in self.order.items.all():
            item_total = item.total_price
            total_amount += item_total
            items_data.append([
                item.product.name,
                str(item.final_quantity),
                self.format_price(item.quoted_unit_price),
                self.format_price(item_total)
            ])

        items_table = Table(items_data, colWidths=[8 * cm, 2 * cm, 3 * cm, 3 * cm])
        items_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('ALIGN', (1, 1), (-1, -1), 'RIGHT'),  # Right align numbers
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTWEIGHT', (0, 0), (-1, 0), 'BOLD'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))

        elements.append(items_table)
        elements.append(Spacer(1, 20))

        # Totals
        totals_data = [
            ["Subtotal:", self.format_price(self.invoice.total_amount)],
            ["Discount:", self.format_price(self.invoice.discount)],
            ["Tax:", self.format_price(self.invoice.tax_amount)],
            ["", ""],  # Spacer row
            ["TOTAL:", self.format_price(self.invoice.payable_amount)]
        ]

        totals_table = Table(totals_data, colWidths=[10 * cm, 4 * cm])
        totals_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -2), 11),
            ('FONTSIZE', (0, -1), (-1, -1), 14),
            ('FONTWEIGHT', (0, -1), (-1, -1), 'BOLD'),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BACKGROUND', (0, -1), (-1, -1), colors.lightblue),
            ('LINEABOVE', (0, -1), (-1, -1), 2, colors.darkblue),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
        ]))

        elements.append(totals_table)

        # Comments
        if self.order.admin_comment:
            elements.append(Spacer(1, 30))
            elements.append(Paragraph("<b>Notes:</b>", styles['Normal']))
            elements.append(Spacer(1, 10))
            elements.append(Paragraph(self.order.admin_comment, styles['Normal']))

        # Footer
        elements.append(Spacer(1, 40))
        footer = Paragraph(
            "<i>Thank you for your business!</i>",
            ParagraphStyle('Footer', parent=styles['Normal'], alignment=1, textColor=colors.grey)
        )
        elements.append(footer)

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