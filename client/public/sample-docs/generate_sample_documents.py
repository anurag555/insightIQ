import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
import docx

docs_dir = os.path.dirname(os.path.abspath(__file__))

# 1. Q3 Strategic Business Review PDF
pdf_path = os.path.join(docs_dir, "Q3_Strategic_Business_Review.pdf")
doc = SimpleDocTemplate(pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
styles = getSampleStyleSheet()

title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontSize=20, leading=24, textColor=colors.HexColor('#0c3d6f'))
h2_style = ParagraphStyle('Heading2', parent=styles['Heading2'], fontSize=14, leading=18, textColor=colors.HexColor('#026bc9'))
body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=10, leading=14, textColor=colors.HexColor('#1e293b'))

story = []
story.append(Paragraph("InsightIQ Strategic Enterprise Review — Q3/Q4 Performance", title_style))
story.append(Spacer(1, 15))
story.append(Paragraph("<b>Executive Summary:</b> During the third quarter of 2024, our global omnichannel enterprise achieved strong gross revenue growth across North America and EMEA. Electronics and Software & Cloud business units contributed over 58% of aggregate quarterly profits. The strategic shift toward multi-year enterprise subscriptions resulted in a 24% uplift in customer lifetime value (LTV).", body_style))
story.append(Spacer(1, 10))

story.append(Paragraph("Key Strategic Pillars and Pricing Strategy", h2_style))
story.append(Paragraph("1. <b>Volume Discounting Thresholds:</b> Enterprise orders exceeding 5 units receive an automated 15% discount. However, discretionary discounting above 20% requires formal VP authorization to safeguard gross margins.", body_style))
story.append(Spacer(1, 5))
story.append(Paragraph("2. <b>Regional Channel Distribution:</b> North America remains our largest gross margin generator with average transaction sizes of $1,240. EMEA witnessed rapid adoption of Ergonomic Furniture and Smart Monitors, growing 18% QoQ.", body_style))
story.append(Spacer(1, 5))
story.append(Paragraph("3. <b>Supply Chain & Lead Times:</b> Average warehouse lead time for Central Hub (EU) stands at 8.4 days, while Warehouse Alpha (US-East) achieved 4.2 days. Stock reorder points are strictly set at 50 units across high-velocity SKUs.", body_style))
story.append(Spacer(1, 10))

story.append(Paragraph("Quarterly Risk Assessment & Forecasts", h2_style))
story.append(Paragraph("Potential risk factors identified include currency fluctuations in Latin America and seasonal freight surcharges in Q4. For the upcoming fiscal year, product management plans to sunset legacy single-user software tiers in favor of unified Team Collaboration Pro plans.", body_style))

doc.build(story)
print(f"Generated {pdf_path}")

# 2. Customer Support SLA and Refund Policy DOCX
docx_path = os.path.join(docs_dir, "Customer_Support_SLA_and_Refund_Policy.docx")
wdoc = docx.Document()
wdoc.add_heading('InsightIQ Customer Support SLA & Warranty Guidelines', 0)

wdoc.add_heading('1. Service Level Agreements (SLA) by Account Tier', level=1)
p1 = wdoc.add_paragraph('Enterprise Tier: Guaranteed 1-hour initial response time for Critical (P1) incidents with 24/7 round-the-clock telephone and dedicated Slack channel support.')
p2 = wdoc.add_paragraph('Scale Tier: Guaranteed 4-hour initial response time for P1 and P2 incidents during standard business hours (8am - 8pm EST).')
p3 = wdoc.add_paragraph('Professional and Starter Tiers: Guaranteed 24-hour response time via web portal ticketing system.')

wdoc.add_heading('2. Hardware Warranty and Return Merchandise Policy', level=1)
wdoc.add_paragraph('All physical electronics and ergonomic furniture products come with a 30-day no-questions-asked money-back guarantee, provided items are returned in original packaging with serial numbers intact.')
wdoc.add_paragraph('Restocking fee of 10% applies to opened enterprise electronics unless defective upon arrival (DOA). Replacement hardware is dispatched via overnight courier upon verification.')

wdoc.add_heading('3. Software Refund and Subscription Cancellation Terms', level=1)
wdoc.add_paragraph('Annual software licenses can be cancelled within 14 days of activation for a full 100% refund. Cancellations past 14 days are pro-rated as account credits applicable to future purchases.')

wdoc.save(docx_path)
print(f"Generated {docx_path}")

# 3. Annual Financial Commentary PDF
fin_pdf_path = os.path.join(docs_dir, "Annual_Financial_Commentary_2024.pdf")
doc2 = SimpleDocTemplate(fin_pdf_path, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
story2 = []
story2.append(Paragraph("InsightIQ Financial Commentary & Operating Margins (FY2024)", title_style))
story2.append(Spacer(1, 15))
story2.append(Paragraph("<b>Operating Margins Overview:</b> Target blended gross margin for fiscal year 2024 was established at 42.0%. High-performance computing equipment and Pro Laptops achieved a realized margin of 44.5%, outperforming baseline forecasts. Software licenses maintained an exceptional 82% margin profile.", body_style))
story2.append(Spacer(1, 10))
story2.append(Paragraph("<b>Customer Concentration & Credit Exposure:</b> Top 10 enterprise accounts accounted for 18.2% of consolidated gross billings. No individual client represents more than 4% of total revenues, mitigating single-counterparty default risk.", body_style))
story2.append(Spacer(1, 10))
story2.append(Paragraph("<b>Payment Methods and DSO:</b> Average Days Sales Outstanding (DSO) stood at 28 days for ACH and Wire transfers, while Credit Card transactions settled within 48 hours. Corporate PayPal usage expanded 32% year-on-year among mid-market accounts.", body_style))

doc2.build(story2)
print(f"Generated {fin_pdf_path}")
