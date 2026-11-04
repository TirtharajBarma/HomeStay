import sys
import os
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        
        # Header (Pages > 1)
        if self._pageNumber > 1:
            self.drawString(40, 805, "StayRide / StayCabs — Meta WhatsApp Cloud API Template Directory")
            self.drawRightString(555, 805, "Confidential & Operational Spec")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.6)
            self.line(40, 798, 555, 798)
            
        # Footer
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(555, 30, page_text)
        self.drawString(40, 30, "Generated for StayRide Cloud Dispatch Operations · Production Ready")
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.6)
        self.line(40, 42, 555, 42)
        
        self.restoreState()

def build_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=50,
        bottomMargin=50
    )

    styles = getSampleStyleSheet()

    # Custom palette
    PRIMARY = colors.HexColor("#065f46")   # Deep Emerald
    SECONDARY = colors.HexColor("#0f172a") # Slate 900
    ACCENT = colors.HexColor("#d97706")    # Amber 600
    BG_LIGHT = colors.HexColor("#f8fafc")  # Slate 50
    BORDER_LIGHT = colors.HexColor("#cbd5e1")
    TEXT_DARK = colors.HexColor("#1e293b")
    TEXT_MUTED = colors.HexColor("#64748b")
    BOX_BG = colors.HexColor("#f1f5f9")

    # Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=PRIMARY
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=16,
        textColor=TEXT_MUTED
    )
    h1_style = ParagraphStyle(
        'Heading1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=19,
        textColor=SECONDARY,
        spaceAfter=8,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'Heading2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=PRIMARY,
        spaceAfter=4,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=TEXT_DARK
    )
    meta_code_style = ParagraphStyle(
        'MetaCode',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor("#0f172a")
    )
    badge_style = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#065f46")
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=TEXT_DARK
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=TEXT_DARK
    )
    table_cell_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white
    )

    story = []

    # Title Block
    story.append(Spacer(1, 10))
    story.append(Paragraph("StayRide / StayCabs", title_style))
    story.append(Paragraph("Meta WhatsApp Cloud API — Master Template Directory & Submission Guide", ParagraphStyle('SubSub', parent=h2_style, textColor=ACCENT)))
    story.append(Paragraph("Every automated WhatsApp message used across the StayRide ecosystem: Guests, Drivers, and Homestay Hosts. Copy-paste ready for the Meta WhatsApp Business Manager.", subtitle_style))
    story.append(Spacer(1, 14))

    # Executive Summary Card
    intro_html = """
    <b>Meta WhatsApp Setup Essentials:</b><br/>
    • <b>Category:</b> Always submit as <b>UTILITY</b> (except Boarding PIN which can be <i>AUTHENTICATION</i> or <i>UTILITY</i>). Utility templates get fast AI approval in 2–15 mins and have the lowest per-message delivery costs.<br/>
    • <b>Variable Rule:</b> Meta strictly requires variables formatted as <code>{{1}}</code>, <code>{{2}}</code>, <code>{{3}}</code> in exact sequential order without skipping numbers.<br/>
    • <b>Sample Values Required:</b> When creating a template in Meta Business Manager, you <i>must</i> supply realistic sample values for each variable (provided in this guide).<br/>
    • <b>Total Templates:</b> 18 core operational events covering the end-to-end trip lifecycle.
    """
    card_data = [[Paragraph(intro_html, body_style)]]
    card_table = Table(card_data, colWidths=[515])
    card_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#86efac")),
        ('TOPPADDING', (0,0), (-1,-1), 9),
        ('BOTTOMPADDING', (0,0), (-1,-1), 9),
        ('LEFTPADDING', (0,0), (-1,-1), 12),
        ('RIGHTPADDING', (0,0), (-1,-1), 12),
    ]))
    story.append(card_table)
    story.append(Spacer(1, 18))

    # Summary Table
    story.append(Paragraph("1. Quick Reference: Template Master Index", h1_style))
    
    index_headers = [
        Paragraph("<b>#</b>", table_cell_header),
        Paragraph("<b>Event Key</b>", table_cell_header),
        Paragraph("<b>Meta Template Name</b>", table_cell_header),
        Paragraph("<b>Recipient</b>", table_cell_header),
        Paragraph("<b>Category</b>", table_cell_header),
        Paragraph("<b>Variables</b>", table_cell_header),
    ]

    templates_summary = [
        ("1", "ASK_CAB", "ask_cab", "Guest", "UTILITY", "3 (Name, Stay, Link)"),
        ("2", "NEW_REQUEST", "new_trip_request", "Drivers", "UTILITY", "5 (Stay, Route, Time, Class, Link)"),
        ("3", "QUOTE_COUNTER", "quote_counter_offer", "Driver", "UTILITY", "4 (Name, Ref, Fare, Link)"),
        ("4", "QUOTE_ACCEPTED_DRIVER", "quote_accepted_driver", "Driver", "UTILITY", "2 (Name, Ref)"),
        ("5", "QUOTE_ACCEPTED_GUEST", "quote_accepted_guest", "Guest", "UTILITY", "7 (Guest, Driver, Cab, Fares, Link, Due)"),
        ("6", "ADVANCE_PAID_GUEST", "advance_paid_guest", "Guest", "UTILITY", "7 (Guest, Driver, Phone, Cab, Route, Time, Cash)"),
        ("7", "BOARDING_PIN_GUEST", "boarding_pin_guest", "Guest", "AUTH / UTIL", "1 (4-digit OTP)"),
        ("8", "ADVANCE_PAID_DRIVER", "advance_paid_driver", "Driver", "UTILITY", "8 (Driver, Ref, Guest, Phone, Route, Time, Cash, Link)"),
        ("9", "ADVANCE_EXPIRED_GUEST", "advance_expired_guest", "Guest", "UTILITY", "2 (Guest, Stay)"),
        ("10", "TRIP_ASSIGNED_DRIVER", "trip_assigned_driver", "Driver", "UTILITY", "6 (Driver, Stay, Guest, Phone, Route, Time)"),
        ("11", "TRIP_CANCELLED_GUEST", "trip_cancelled_guest", "Guest", "UTILITY", "4 (Guest, Ref, Time, RefundStatus)"),
        ("12", "REFUND_GUEST", "refund_guest", "Guest", "UTILITY", "4 (Guest, Amount, Ref, BankUTR)"),
        ("13", "COMPLETION_REMINDER_DRIVER", "completion_reminder_driver", "Driver", "UTILITY", "5 (Driver, Guest, Cash, Ref, Link)"),
        ("14", "BIDDING_TIMEOUT_OWNER", "bidding_timeout_owner", "Host", "UTILITY", "5 (Stay, Guest, Ref, Route, Link)"),
        ("15", "DRIVER_WELCOME", "driver_welcome", "Driver", "UTILITY", "2 (Name, Plate)"),
        ("16", "PAYOUT_SETTLED_DRIVER", "payout_settled_driver", "Driver", "UTILITY", "2 (Amount, BankUTR)"),
        ("17", "PAYOUT_REJECTED_DRIVER", "payout_rejected_driver", "Driver", "UTILITY", "2 (Amount, Reason)"),
        ("18", "VEHICLE_UPDATED_GUEST", "vehicle_updated_guest", "Guest", "UTILITY", "3 (Guest, Ref, Plate)"),
    ]

    index_rows = [index_headers]
    for row in templates_summary:
        index_rows.append([
            Paragraph(row[0], table_cell),
            Paragraph(f"<code>{row[1]}</code>", table_cell_bold),
            Paragraph(f"<code>{row[2]}</code>", table_cell),
            Paragraph(row[3], table_cell),
            Paragraph(row[4], table_cell_bold),
            Paragraph(row[5], table_cell),
        ])

    index_table = Table(index_rows, colWidths=[20, 115, 120, 55, 65, 140])
    index_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), SECONDARY),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
    ]))
    story.append(index_table)
    story.append(PageBreak())

    # Detailed Templates Section
    story.append(Paragraph("2. Full Template Specifications & Exact Copy", h1_style))
    story.append(Paragraph("Below is the exact text and required sample parameters for every template. In Meta Business Manager, copy and paste the Body Text directly into the template editor.", subtitle_style))
    story.append(Spacer(1, 10))

    templates_detailed = [
        {
            "num": 1,
            "event": "ASK_CAB",
            "name": "ask_cab",
            "category": "UTILITY",
            "recipient": "Guest (Sent before arrival or on-demand by host)",
            "purpose": "Invites the guest to plan airport transfers, local sightseeing, or hill cabs with verified partner drivers.",
            "body": (
                "Namaste {{1}}.\n"
                "If you need an airport transfer, sightseeing, or a local hill cab during your stay at {{2}}, please share your itinerary and we will arrange a verified driver for you:\n"
                "{{3}}"
            ),
            "vars": [
                ("{{1}}", "Guest Name", "Ankit Sharma"),
                ("{{2}}", "Homestay Name", "Cedar Pine Homestay"),
                ("{{3}}", "Private Booking Link", "https://staycabs.in/cab-request?t=abc123xyz")
            ]
        },
        {
            "num": 2,
            "event": "NEW_REQUEST",
            "name": "new_trip_request",
            "category": "UTILITY",
            "recipient": "Verified Drivers (Nearby priority broadcast)",
            "purpose": "Notifies local verified drivers of a new trip request with route and schedule so they can submit quotes.",
            "body": (
                "New trip request from {{1}}\n"
                "Route: {{2}}\n"
                "Pickup: {{3}}\n"
                "Vehicle: {{4}}\n\n"
                "Submit your total trip fare quote here:\n"
                "{{5}}\n"
                "(Guest pays 15% advance online, you collect remaining in cash at drop-off + wallet credit)"
            ),
            "vars": [
                ("{{1}}", "Homestay Name", "Cedar Pine Homestay"),
                ("{{2}}", "Route / Stops", "Darjeeling Mall Road ➔ Bagdogra Airport (IXB)"),
                ("{{3}}", "Pickup Date & Time", "28 Oct at 09:00 AM"),
                ("{{4}}", "Vehicle Class / Size", "SUV"),
                ("{{5}}", "Driver Quoting URL", "https://staycabs.in/driver-quote?t=req789xyz")
            ]
        },
        {
            "num": 3,
            "event": "QUOTE_COUNTER",
            "name": "quote_counter_offer",
            "category": "UTILITY",
            "recipient": "Driver",
            "purpose": "Notifies a quoting driver that the homestay host proposed a counter-fare offer.",
            "body": (
                "Hello {{1}}, the homestay has made a counter-offer of {{3}} for trip {{2}}. You can accept this offer or keep your original fare here:\n"
                "{{4}}"
            ),
            "vars": [
                ("{{1}}", "Driver Name", "Tenzing Sherpa"),
                ("{{2}}", "Trip Reference", "REQ-8F2B1"),
                ("{{3}}", "Counter Fare", "₹2,800"),
                ("{{4}}", "Driver Action Link", "https://staycabs.in/driver-quote?t=req789xyz")
            ]
        },
        {
            "num": 4,
            "event": "QUOTE_ACCEPTED_DRIVER",
            "name": "quote_accepted_driver",
            "category": "UTILITY",
            "recipient": "Driver",
            "purpose": "Alerts the driver that the host selected their quote, and they are temporarily reserved while guest pays advance.",
            "body": (
                "Hello {{1}}, your fare quote for trip {{2}} has been accepted. The booking will be confirmed once the guest completes the advance payment. Passenger contact details will be shared then."
            ),
            "vars": [
                ("{{1}}", "Driver Name", "Tenzing Sherpa"),
                ("{{2}}", "Trip Reference", "REQ-8F2B1")
            ]
        },
        {
            "num": 5,
            "event": "QUOTE_ACCEPTED_GUEST",
            "name": "quote_accepted_guest",
            "category": "UTILITY",
            "recipient": "Guest",
            "purpose": "Presents reserved driver details to guest and requests the advance payment to lock the booking.",
            "body": (
                "Namaste {{1}}, a verified driver is reserved for your trip.\n"
                "Driver: {{2}}\n"
                "Vehicle: {{3}}\n"
                "Total Fare: {{4}}\n"
                "Driver Cash Fare: {{4}}\n\n"
                "Please pay the advance booking fee of {{5}} {{7}} to confirm your cab. The remaining balance is paid directly in cash to your driver at destination.\n"
                "{{6}}\n\n"
                "Driver contact details will be shared immediately upon advance confirmation."
            ),
            "vars": [
                ("{{1}}", "Guest Name", "Ankit Sharma"),
                ("{{2}}", "Driver Name", "Tenzing Sherpa"),
                ("{{3}}", "Vehicle Model / Plate", "Toyota Innova (WB 74 1234)"),
                ("{{4}}", "Total Fare", "₹3,200"),
                ("{{5}}", "Advance Fee Amount", "₹480"),
                ("{{6}}", "Secure Payment Link", "https://staycabs.in/cab-request?ref=REQ-8F2B1"),
                ("{{7}}", "Payment Deadline", "within 120 minutes")
            ]
        },
        {
            "num": 6,
            "event": "ADVANCE_PAID_GUEST",
            "name": "advance_paid_guest",
            "category": "UTILITY",
            "recipient": "Guest",
            "purpose": "Sent immediately upon advance payment receipt. Releases driver phone number and trip itinerary.",
            "body": (
                "Namaste {{1}}, your cab booking is confirmed.\n"
                "Driver: {{2}} ({{3}})\n"
                "Vehicle: {{4}}\n"
                "Route: {{5}}\n"
                "Pickup: {{6}}\n\n"
                "Please pay the driver cash fare of {{7}} directly to your driver at the end of the trip."
            ),
            "vars": [
                ("{{1}}", "Guest Name", "Ankit Sharma"),
                ("{{2}}", "Driver Name", "Tenzing Sherpa"),
                ("{{3}}", "Driver Contact Number", "+919832012345"),
                ("{{4}}", "Vehicle Info", "Innova Crysta WB 74 1234"),
                ("{{5}}", "Full Route", "Homestay ➔ Bagdogra Airport (IXB)"),
                ("{{6}}", "Pickup Date & Time", "29 Oct at 08:30 AM"),
                ("{{7}}", "Remaining Cash Fare", "₹2,720")
            ]
        },
        {
            "num": 7,
            "event": "BOARDING_PIN_GUEST",
            "name": "boarding_pin_guest",
            "category": "AUTHENTICATION or UTILITY",
            "recipient": "Guest",
            "purpose": "Security OTP verification code. Guest shares this 4-digit PIN with driver upon vehicle boarding.",
            "body": (
                "{{1}} is your boarding PIN. Share it with your driver at pickup."
            ),
            "vars": [
                ("{{1}}", "4-Digit PIN Code", "4821")
            ]
        },
        {
            "num": 8,
            "event": "ADVANCE_PAID_DRIVER",
            "name": "advance_paid_driver",
            "category": "UTILITY",
            "recipient": "Driver",
            "purpose": "Sent upon advance payment receipt. Releases guest name, phone, pickup pin, and exact cash to collect.",
            "body": (
                "Hello {{1}}, the online booking fee is received and trip {{2}} is confirmed.\n"
                "Passenger: {{3}} ({{4}})\n"
                "Route: {{5}}\n"
                "Pickup: {{6}}\n\n"
                "Collect your cash fare of {{7}} directly from the passenger at drop-off.\n\n"
                "Open the trip details here:\n"
                "{{8}}"
            ),
            "vars": [
                ("{{1}}", "Driver Name", "Tenzing Sherpa"),
                ("{{2}}", "Trip Reference", "REQ-8F2B1"),
                ("{{3}}", "Passenger Full Name", "Ankit Sharma"),
                ("{{4}}", "Passenger Phone", "+919876543210"),
                ("{{5}}", "Route", "Cedar Pine Homestay ➔ Bagdogra Airport"),
                ("{{6}}", "Date & Time", "29 Oct at 08:30 AM"),
                ("{{7}}", "Cash Fare To Collect", "₹2,720"),
                ("{{8}}", "Driver Action Link", "https://staycabs.in/driver-quote?t=abc")
            ]
        },
        {
            "num": 9,
            "event": "ADVANCE_EXPIRED_GUEST",
            "name": "advance_expired_guest",
            "category": "UTILITY",
            "recipient": "Guest",
            "purpose": "Informs the guest that their temporary hold on the cab expired because the advance was not paid in time.",
            "body": (
                "Hello {{1}}, the temporary hold on your cab booking has expired. Please contact {{2}} if you would like to request a new cab."
            ),
            "vars": [
                ("{{1}}", "Guest Name", "Ankit Sharma"),
                ("{{2}}", "Homestay Name", "Cedar Pine Homestay")
            ]
        },
        {
            "num": 10,
            "event": "TRIP_ASSIGNED_DRIVER",
            "name": "trip_assigned_driver",
            "category": "UTILITY",
            "recipient": "Driver (Host's In-House Fleet)",
            "purpose": "Alerts an in-house driver that their homestay host assigned them a trip directly.",
            "body": (
                "Hi {{1}}, {{2}} has assigned you a trip.\n"
                "Guest: {{3}} ({{4}})\n"
                "Route: {{5}}\n"
                "When: {{6}}"
            ),
            "vars": [
                ("{{1}}", "Driver Name", "Ravi Chettri"),
                ("{{2}}", "Homestay Name", "Cedar Pine Homestay"),
                ("{{3}}", "Guest Name", "Ankit Sharma"),
                ("{{4}}", "Guest Phone", "+919876543210"),
                ("{{5}}", "Route", "Homestay ➔ NJP Railway Station"),
                ("{{6}}", "Pickup Date & Time", "30 Oct at 07:00 AM")
            ]
        },
        {
            "num": 11,
            "event": "TRIP_CANCELLED_GUEST",
            "name": "trip_cancelled_guest",
            "category": "UTILITY",
            "recipient": "Guest",
            "purpose": "Notifies the guest of trip cancellation and whether their advance payment is being refunded.",
            "body": (
                "Hello {{1}}, your cab request {{2}} for {{3}} has been cancelled. {{4}}"
            ),
            "vars": [
                ("{{1}}", "Guest Name", "Ankit Sharma"),
                ("{{2}}", "Trip Reference", "REQ-8F2B1"),
                ("{{3}}", "Trip Date & Time", "29 Oct at 08:30 AM"),
                ("{{4}}", "Refund Clause", "Your advance of ₹480 will be refunded.")
            ]
        },
        {
            "num": 12,
            "event": "REFUND_GUEST",
            "name": "refund_guest",
            "category": "UTILITY",
            "recipient": "Guest",
            "purpose": "Official refund notification with bank UTR transaction reference.",
            "body": (
                "Hi {{1}}, StayCabs has refunded your advance of {{2}} for trip {{3}} (reference {{4}}). Your bank may take a few days to show it."
            ),
            "vars": [
                ("{{1}}", "Guest Name", "Ankit Sharma"),
                ("{{2}}", "Refund Amount", "₹480"),
                ("{{3}}", "Trip Reference", "REQ-8F2B1"),
                ("{{4}}", "Bank UTR / ARN", "UTR412345678901")
            ]
        },
        {
            "num": 13,
            "event": "COMPLETION_REMINDER_DRIVER",
            "name": "completion_reminder_driver",
            "category": "UTILITY",
            "recipient": "Driver",
            "purpose": "Automated reminder 2+ hours after pickup asking driver to confirm cash collection and finish trip.",
            "body": (
                "Hello {{1}},\n"
                "Have you completed the trip for {{2}} ({{4}})?\n"
                "Please confirm cash collection of {{3}} and tap to complete the ride:\n"
                "{{5}}"
            ),
            "vars": [
                ("{{1}}", "Driver Name", "Tenzing Sherpa"),
                ("{{2}}", "Guest Name", "Ankit Sharma"),
                ("{{3}}", "Cash Amount", "₹2,720"),
                ("{{4}}", "Trip Reference", "REQ-8F2B1"),
                ("{{5}}", "Driver Complete Link", "https://staycabs.in/driver-quote?t=abc")
            ]
        },
        {
            "num": 14,
            "event": "BIDDING_TIMEOUT_OWNER",
            "name": "bidding_timeout_owner",
            "category": "UTILITY",
            "recipient": "Homestay Host",
            "purpose": "Alerts the host when 0 driver quotes arrive within the bidding window so they can allocate an in-house cab.",
            "body": (
                "Namaste {{1}},\n"
                "No driver bids have been received yet for {{2}}'s cab request ({{3}}).\n"
                "Route: {{4}}\n\n"
                "Please tap here to assign an in-house driver or expand the search radius:\n"
                "{{5}}"
            ),
            "vars": [
                ("{{1}}", "Homestay Name", "Cedar Pine Homestay"),
                ("{{2}}", "Guest Name", "Ankit Sharma"),
                ("{{3}}", "Trip Reference", "REQ-8F2B1"),
                ("{{4}}", "Route", "Homestay ➔ Bagdogra Airport"),
                ("{{5}}", "Host Admin Link", "https://staycabs.in/admin")
            ]
        },
        {
            "num": 15,
            "event": "DRIVER_WELCOME",
            "name": "driver_welcome",
            "category": "UTILITY",
            "recipient": "Driver",
            "purpose": "Confirmation sent when a driver submits their registration and vehicle documents online.",
            "body": (
                "Namaste {{1}}!\n"
                "Your driver registration ({{2}}) has been submitted to StayCabs.\n\n"
                "Our operations team will review your vehicle details shortly. Once approved, you will receive trip booking alerts directly on this WhatsApp number.\n\n"
                "Happy driving with StayCabs!"
            ),
            "vars": [
                ("{{1}}", "Driver Name", "Pema Bhutia"),
                ("{{2}}", "Vehicle Plate Number", "WB 74 B 5678")
            ]
        },
        {
            "num": 16,
            "event": "PAYOUT_SETTLED_DRIVER",
            "name": "payout_settled_driver",
            "category": "UTILITY",
            "recipient": "Driver",
            "purpose": "Alerts the driver when their wallet balance payout has been transferred to their UPI account.",
            "body": (
                "StayCabs Payout: ₹{{1}} has been sent to your UPI account (Bank UTR: {{2}})."
            ),
            "vars": [
                ("{{1}}", "Payout Amount", "1,450"),
                ("{{2}}", "Bank UTR Reference", "412345678901")
            ]
        },
        {
            "num": 17,
            "event": "PAYOUT_REJECTED_DRIVER",
            "name": "payout_rejected_driver",
            "category": "UTILITY",
            "recipient": "Driver",
            "purpose": "Alerts driver if a payout was declined (e.g. incorrect UPI ID), confirming their balance was restored.",
            "body": (
                "StayCabs Payout: Your payout request of ₹{{1}} was declined ({{2}}). Your wallet balance is restored."
            ),
            "vars": [
                ("{{1}}", "Payout Amount", "1,450"),
                ("{{2}}", "Decline Reason", "Invalid or inactive UPI VPA")
            ]
        },
        {
            "num": 18,
            "event": "VEHICLE_UPDATED_GUEST",
            "name": "vehicle_updated_guest",
            "category": "UTILITY",
            "recipient": "Guest",
            "purpose": "Notifies the guest if the driver or operator had to substitute the assigned vehicle plate.",
            "body": (
                "Notice for trip {{2}}:\n"
                "Your assigned vehicle plate has been updated to {{3}}.\n\n"
                "Please look out for this registration plate upon pickup."
            ),
            "vars": [
                ("{{1}}", "Guest Name", "Ankit Sharma"),
                ("{{2}}", "Trip Reference", "REQ-8F2B1"),
                ("{{3}}", "New Plate Number", "WB 74 C 9988")
            ]
        }
    ]

    for item in templates_detailed:
        block = []
        
        # Header banner
        header_text = f"<b>Template #{item['num']}: {item['name']}</b> &nbsp;&nbsp;|&nbsp;&nbsp; <i>Event: {item['event']}</i>"
        block.append(Paragraph(header_text, h2_style))
        
        meta_info = f"<b>Category:</b> {item['category']} &nbsp;&nbsp;•&nbsp;&nbsp; <b>Recipient:</b> {item['recipient']}<br/><b>Operational Purpose:</b> {item['purpose']}"
        block.append(Paragraph(meta_info, body_style))
        block.append(Spacer(1, 4))
        
        # Body Box
        body_para = Paragraph(f"<b>Exact Template Body (Copy to Meta):</b><br/>" + item['body'].replace('\n', '<br/>'), meta_code_style)
        body_table = Table([[body_para]], colWidths=[515])
        body_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), BOX_BG),
            ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
        ]))
        block.append(body_table)
        block.append(Spacer(1, 6))

        # Sample Variables Table
        var_rows = [[
            Paragraph("<b>Variable</b>", table_cell_bold),
            Paragraph("<b>Meaning / Field</b>", table_cell_bold),
            Paragraph("<b>Required Sample Value for Meta</b>", table_cell_bold),
        ]]
        for v in item['vars']:
            var_rows.append([
                Paragraph(f"<code>{v[0]}</code>", table_cell_bold),
                Paragraph(v[1], table_cell),
                Paragraph(f"<code>{v[2]}</code>", table_cell),
            ])
        
        var_table = Table(var_rows, colWidths=[60, 185, 270])
        var_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
            ('BOTTOMPADDING', (0,0), (-1,-1), 3),
            ('TOPPADDING', (0,0), (-1,-1), 3),
            ('GRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ]))
        block.append(var_table)
        block.append(Spacer(1, 14))
        
        story.append(KeepTogether(block))

    # Phase 3: Meta Business Manager Step-by-Step Instructions
    story.append(PageBreak())
    story.append(Paragraph("3. Step-by-Step Meta Submission Guide", h1_style))
    story.append(Paragraph("Share these steps with your developer or operations partner when entering templates into Facebook / Meta Business Manager.", subtitle_style))
    story.append(Spacer(1, 10))

    steps_text = """
    <b>Step 1: Open WhatsApp Manager</b><br/>
    Navigate to <b>business.facebook.com/wa/manage</b> &rarr; Click on <b>Account Tools</b> (left sidebar) &rarr; Select <b>Message Templates</b>.<br/><br/>

    <b>Step 2: Create New Template</b><br/>
    1. Click <b>Create Template</b>.<br/>
    2. Choose Category: Always select <b>UTILITY</b> (or AUTHENTICATION for the Boarding PIN).<br/>
    3. Enter the <b>Template Name</b> in lowercase snake_case (e.g. <code>new_trip_request</code>).<br/>
    4. Choose Language: <b>English</b> (or <code>en</code> / <code>en_US</code>).<br/><br/>

    <b>Step 3: Paste Body & Add Variables</b><br/>
    1. Copy the exact Body Text from Section 2 of this guide.<br/>
    2. Click <b>Add Variable</b> whenever typing <code>{{1}}</code>, <code>{{2}}</code>, etc.<br/>
    3. Meta will ask you to supply a <i>Sample Value</i> for each variable. Copy the sample values provided in the tables in Section 2. <b>Meta will reject your template if you leave samples empty!</b><br/><br/>

    <b>Step 4: Buttons / URLs</b><br/>
    For templates with links (like <code>new_trip_request</code> or <code>quote_accepted_guest</code>), you can keep the link in the message body as specified, or add a <b>Call To Action (CTA) URL button</b> with dynamic suffix.<br/><br/>

    <b>Step 5: Submit for Review</b><br/>
    Click <b>Submit</b>. Utility templates are processed by Meta's automated validation AI and are usually approved within <b>2 to 15 minutes</b>.
    """
    
    steps_table = Table([[Paragraph(steps_text, body_style)]], colWidths=[515])
    steps_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, BORDER_LIGHT),
        ('TOPPADDING', (0,0), (-1,-1), 12),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('LEFTPADDING', (0,0), (-1,-1), 14),
        ('RIGHTPADDING', (0,0), (-1,-1), 14),
    ]))
    story.append(steps_table)
    story.append(Spacer(1, 16))

    # Configuration env variables cheat sheet
    story.append(Paragraph("4. Server Environment Variables (.env Mapping)", h1_style))
    story.append(Paragraph("Once Meta approves your templates, match the approved names in your production server <code>.env</code>:", subtitle_style))
    story.append(Spacer(1, 8))

    env_data = [
        [Paragraph("<b>Server Variable</b>", table_cell_header), Paragraph("<b>Meta Approved Template Name</b>", table_cell_header)],
        [Paragraph("<code>WHATSAPP_TPL_ASK_CAB</code>", table_cell), Paragraph("<code>ask_cab</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_NEW_REQUEST</code>", table_cell), Paragraph("<code>new_trip_request</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_QUOTE_COUNTER</code>", table_cell), Paragraph("<code>quote_counter_offer</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_QUOTE_ACCEPTED_DRIVER</code>", table_cell), Paragraph("<code>quote_accepted_driver</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_QUOTE_ACCEPTED_GUEST</code>", table_cell), Paragraph("<code>quote_accepted_guest</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_ADVANCE_PAID_GUEST</code>", table_cell), Paragraph("<code>advance_paid_guest</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_ADVANCE_PAID_DRIVER</code>", table_cell), Paragraph("<code>advance_paid_driver</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_ADVANCE_EXPIRED_GUEST</code>", table_cell), Paragraph("<code>advance_expired_guest</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_TRIP_ASSIGNED_DRIVER</code>", table_cell), Paragraph("<code>trip_assigned_driver</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_TRIP_CANCELLED_GUEST</code>", table_cell), Paragraph("<code>trip_cancelled_guest</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_REFUND_GUEST</code>", table_cell), Paragraph("<code>refund_guest</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_COMPLETION_REMINDER_DRIVER</code>", table_cell), Paragraph("<code>completion_reminder_driver</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_BIDDING_TIMEOUT_OWNER</code>", table_cell), Paragraph("<code>bidding_timeout_owner</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_DRIVER_WELCOME</code>", table_cell), Paragraph("<code>driver_welcome</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_PAYOUT_SETTLED_DRIVER</code>", table_cell), Paragraph("<code>payout_settled_driver</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_PAYOUT_REJECTED_DRIVER</code>", table_cell), Paragraph("<code>payout_rejected_driver</code>", table_cell_bold)],
        [Paragraph("<code>WHATSAPP_TPL_VEHICLE_UPDATED_GUEST</code>", table_cell), Paragraph("<code>vehicle_updated_guest</code>", table_cell_bold)],
    ]

    env_table = Table(env_data, colWidths=[240, 275])
    env_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), PRIMARY),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('GRID', (0,0), (-1,-1), 0.5, BORDER_LIGHT),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(env_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"PDF generated successfully at: {filename}")

if __name__ == '__main__':
    out_file = "/Users/tirtharaj/Desktop/StayRide_WhatsApp_Templates_Master_Guide.pdf"
    build_pdf(out_file)
    # Also save in repo root
    repo_file = "/Users/tirtharaj/Desktop/Desktop/github/stayride/StayRide_WhatsApp_Templates_Master_Guide.pdf"
    import shutil
    shutil.copyfile(out_file, repo_file)
    print(f"Copied to: {repo_file}")
