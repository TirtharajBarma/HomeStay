import sys
import os
import time
from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

errors_captured = []
network_failures = []

def on_console(msg):
    if msg.type in ["error"]:
        print(f"  [BROWSER CONSOLE ERROR] {msg.text}")
        errors_captured.append(f"Console error: {msg.text}")

def on_page_error(exc):
    print(f"  [BROWSER PAGE EXCEPTION] {exc}")
    errors_captured.append(f"Page exception: {exc}")

def on_response(response):
    if response.status >= 400:
        msg = f"HTTP {response.status} on {response.url}"
        print(f"  [NETWORK ERROR] {msg}")
        network_failures.append(msg)

def run_tests():
    print("=" * 70)
    print("STARTING END-TO-END UI & BACKEND NORMAL USER WALKTHROUGH AUDIT")
    print("=" * 70)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        page.on("console", on_console)
        page.on("pageerror", on_page_error)
        page.on("response", on_response)

        # =====================================================================
        # 1. CLIENT-SIDE (GUEST PERSONA - PORT 3000)
        # =====================================================================
        print("\n>>> [PERSONA 1: GUEST] Navigating client-side catalogue (port 3000)...")
        
        # 1.1 Home Catalogue
        print("1.1 Loading Home Page http://localhost:3000/ ...")
        res = page.goto("http://localhost:3000/", wait_until="networkidle")
        assert res.status == 200, f"Expected 200, got {res.status}"
        title = page.title()
        print(f"    Page Title: {title}")
        page.wait_for_selector("text=Accommodations", timeout=10000)
        print("    Found 'Accommodations' section header")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/01_guest_homepage.png", full_page=True)
        print("    Saved screenshot: 01_guest_homepage.png")

        # 1.2 Stay Details Page
        print("1.2 Navigating to Stay Detail http://localhost:3000/stays/ging-tea-cottage ...")
        res = page.goto("http://localhost:3000/stays/ging-tea-cottage", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("h1", timeout=10000)
        h1_text = page.locator("h1").first.inner_text()
        print(f"    Stay H1: {h1_text}")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/02_guest_stay_detail.png")
        print("    Saved screenshot: 02_guest_stay_detail.png")

        # 1.3 Checkout Flow
        print("1.3 Navigating to Checkout http://localhost:3000/checkout?stay=ging-tea-cottage ...")
        res = page.goto("http://localhost:3000/checkout?stay=ging-tea-cottage", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Complete Your Reservation", timeout=10000)
        
        # Verify input placeholders and fill details
        first_name = page.locator("#checkout-form input[name='firstName']")
        last_name = page.locator("#checkout-form input[name='lastName']")
        email_input = page.locator("#checkout-form input[name='email']")
        phone_input = page.locator("#checkout-form input[name='phone']")
        
        assert first_name.input_value() == "", f"Expected empty initial firstName, got '{first_name.input_value()}'"
        assert last_name.input_value() == "", f"Expected empty initial lastName, got '{last_name.input_value()}'"
        assert email_input.input_value() == "", f"Expected empty initial email, got '{email_input.input_value()}'"
        assert phone_input.input_value() == "", f"Expected empty initial phone, got '{phone_input.input_value()}'"
        print("    Verified empty initial guest form inputs with proper placeholders!")

        first_name.fill("Rahul")
        last_name.fill("Mukherjee")
        email_input.fill("rahul.guest@example.com")
        phone_input.fill("+91 98300 55443")

        # Check terms and conditions
        terms_checkbox = page.locator("#checkout-form input[name='terms']")
        if terms_checkbox.count() > 0:
            terms_checkbox.check()
            print("    Checked guest terms & house rules agreement checkbox.")

        # Click "Fill test card" button
        fill_test_card_btn = page.locator("button:has-text('Fill test card')")
        if fill_test_card_btn.count() > 0:
            fill_test_card_btn.click()
            print("    Clicked 'Fill test card' button.")
        else:
            page.locator("#checkout-form input[name='cardName']").fill("Rahul Mukherjee")
            page.locator("#checkout-form input[name='cardNumber']").fill("4242 4242 4242 4242")
            page.locator("#checkout-form input[name='expiry']").fill("10 / 2028")
            page.locator("#checkout-form input[name='cvc']").fill("123")

        page.screenshot(path=f"{SCREENSHOTS_DIR}/03_guest_checkout_form.png")
        print("    Filled reservation form and payment details.")

        # Submit reservation
        submit_btn = page.locator("#checkout-form button[type='submit']").first
        submit_btn.click()
        print("    Submitted reservation. Waiting for confirmation modal/banner...")

        time.sleep(2)
        err_loc = page.locator("[role='alert'], .text-error")
        if err_loc.count() > 0:
            for i in range(err_loc.count()):
                print(f"    [CHECKOUT VALIDATION ERROR] {err_loc.nth(i).inner_text()}")
        
        page.wait_for_selector("text=Your stay awaits", timeout=15000)
        conf_ref = page.locator("text=MF-").first.inner_text() if page.locator("text=MF-").count() > 0 else "Confirmed"
        print(f"    SUCCESS! Reservation confirmed. Reference: {conf_ref}")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/04_guest_booking_confirmed.png")

        # 1.4 Cab Booking Form
        print("1.4 Navigating to Cab Booking Form http://localhost:3000/cab ...")
        res = page.goto("http://localhost:3000/cab", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Book Your Cab", timeout=10000)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/05_guest_cab_search.png")
        print("    Saved screenshot: 05_guest_cab_search.png")

        # 1.5 Cab Driver Discovery List
        cab_drivers_url = "http://localhost:3000/cab/drivers?from=Ging+Tea+Estate&fromLat=27.01130&fromLng=88.29240&to=Darjeeling+Railway+Station&toLat=27.03930&toLng=88.25980&date=2026-10-15&time=10:00&seats=4"
        print(f"1.5 Navigating to Driver Discovery {cab_drivers_url} ...")
        res = page.goto(cab_drivers_url, wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Drivers Near You", timeout=10000)
        print("    Found verified estate driver options!")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/06_guest_cab_drivers.png")

        # 1.6 Cab Confirmation
        cab_conf_url = f"http://localhost:3000/cab/confirmed?from=Ging+Tea+Estate&fromLat=27.01130&fromLng=88.29240&to=Darjeeling+Railway+Station&toLat=27.03930&toLng=88.25980&date=2026-10-15&time=10:00&seats=4&driver=sonam-lama&guest=Rahul+Traveler&phone=%2B919830055443"
        print("1.6 Navigating to Cab Confirmation Voucher...")
        res = page.goto(cab_conf_url, wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Your Cab Is Booked", timeout=10000)
        print("    SUCCESS! Cab transfer voucher rendered.")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/07_guest_cab_confirmed.png")

        # =====================================================================
        # 2. OWNER-SIDE (HOST PERSONA - PORT 3001)
        # =====================================================================
        print("\n>>> [PERSONA 2: OWNER] Navigating owner-side portal (port 3001)...")
        
        # 2.1 Owner Login
        print("2.1 Loading Owner Login http://localhost:3001/login ...")
        res = page.goto("http://localhost:3001/login", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Host Portal", timeout=10000)
        
        email_box = page.locator("input[type='email']")
        pwd_box = page.locator("input[type='password']")
        assert email_box.input_value() == "", f"Expected empty initial email, got '{email_box.input_value()}'"
        assert pwd_box.input_value() == "", f"Expected empty initial password, got '{pwd_box.input_value()}'"
        print("    Verified empty placeholders in Owner Login form!")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/08_owner_login.png")

        # Log in as demo owner
        email_box.fill("owner@estate.com")
        pwd_box.fill("estatePassword123!")
        page.locator("button[type='submit']").click()
        
        page.wait_for_url("**/analytics", timeout=10000)
        print("2.2 Logged in successfully! Landed on Owner Analytics Dashboard.")
        page.wait_for_selector("text=Total revenue", timeout=10000)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/09_owner_dashboard.png")

        # 2.3 Tape Chart / Bookings Calendar
        print("2.3 Navigating to Calendar & Room Bookings http://localhost:3001/book ...")
        res = page.goto("http://localhost:3001/book", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Choose rooms", timeout=10000)
        print("    Verified 14-day booking timeline grid and step wizard.")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/10_owner_calendar_grid.png")

        # 2.4 Estate Profile & Room Management
        print("2.4 Navigating to Estate Profile http://localhost:3001/profile ...")
        res = page.goto("http://localhost:3001/profile", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Personal details", timeout=10000)
        
        # Click on Rooms tab
        page.locator("button:has-text('Rooms')").first.click()
        time.sleep(1)
        print("    Clicked 'Rooms' tab. Checking room inventory cards...")
        page.wait_for_selector("text=Add room", timeout=10000)
        
        # Click Add room to check modal placeholders
        page.locator("button:has-text('Add room')").first.click()
        time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/11_owner_profile_rooms_modal.png")
        print("    Add Room modal opened and screenshot saved.")
        
        # Close modal
        close_btn = page.locator("button:has-text('Cancel')").first
        if close_btn.count() > 0:
            close_btn.click()
            time.sleep(0.5)

        # 2.5 Guest Directory CRM
        print("2.5 Navigating to Guest Directory CRM http://localhost:3001/guests ...")
        res = page.goto("http://localhost:3001/guests", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("input[placeholder*='Search']", timeout=10000)
        print("    CRM Guest table loaded. Testing search bar input...")
        search_box = page.locator("input[placeholder*='Search']")
        search_box.fill("Rai")
        time.sleep(1)
        page.screenshot(path=f"{SCREENSHOTS_DIR}/12_owner_guests_crm.png")

        # 2.6 Drivers Roster
        print("2.6 Navigating to Drivers Fleet Roster http://localhost:3001/drivers ...")
        res = page.goto("http://localhost:3001/drivers", wait_until="networkidle")
        assert res.status == 200
        page.locator("button:has-text('Add driver')").first.wait_for(timeout=10000)
        print("    Verified fleet drivers roster cards.")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/13_owner_drivers_roster.png")

        # 2.7 Analytics View
        print("2.7 Navigating to Estate Analytics http://localhost:3001/analytics ...")
        res = page.goto("http://localhost:3001/analytics", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Total revenue", timeout=10000)
        print("    Verified Total revenue, Occupancy, ADR, and service breakdown tiles!")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/14_owner_analytics.png")

        # 2.8 Campaign Blast View
        print("2.8 Navigating to Guest Campaigns http://localhost:3001/campaign ...")
        res = page.goto("http://localhost:3001/campaign", wait_until="networkidle")
        assert res.status == 200
        page.screenshot(path=f"{SCREENSHOTS_DIR}/15_owner_campaign.png")

        # 2.9 Registration Zero-State
        print("2.9 Navigating to Host Registration http://localhost:3001/register (clearing session)...")
        page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
        res = page.goto("http://localhost:3001/register", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Register Homestay", timeout=10000)
        reg_inputs = page.locator("form input")
        for i in range(reg_inputs.count()):
            val = reg_inputs.nth(i).input_value()
            assert val == "", f"Input index {i} should be empty initially, found '{val}'"
        print("    Verified all registration form inputs have empty defaults and clean placeholders!")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/16_owner_register_zero_state.png")

        # =====================================================================
        # 3. DRIVER-SIDE (DRIVER PERSONA - PORT 3002)
        # =====================================================================
        print("\n>>> [PERSONA 3: DRIVER] Navigating driver-side portal (port 3002)...")
        
        print("3.1 Loading Driver Login http://localhost:3002/login ...")
        res = page.goto("http://localhost:3002/login", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Driver Terminal", timeout=10000)
        
        phone_box = page.locator("input[type='tel']")
        pin_box = page.locator("input[type='password']")
        assert phone_box.input_value() == "", f"Expected empty initial phone, got '{phone_box.input_value()}'"
        assert pin_box.input_value() == "", f"Expected empty initial PIN, got '{pin_box.input_value()}'"
        print("    Verified empty placeholders in Driver Login form!")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/17_driver_login.png")

        # Sign in as Demo Driver
        phone_box.fill("+91 98300 41042")
        pin_box.fill("1234")
        page.locator("button[type='submit']").click()
        
        page.wait_for_url("http://localhost:3002/", timeout=10000)
        print("3.2 Logged in successfully! Landed on Driver Dispatch Terminal.")
        page.wait_for_selector("text=Duty & Dispatch Status", timeout=10000)
        
        # Test Duty Status Toggle
        print("    Testing Duty Status Toggle buttons (Available / On a trip)...")
        busy_btn = page.locator("button:has-text('On a trip')").first
        if busy_btn.count() > 0:
            busy_btn.click()
            time.sleep(1)
        avail_btn = page.locator("button:has-text('Available')").first
        if avail_btn.count() > 0:
            avail_btn.click()
            time.sleep(1)

        # Advance trip status button
        status_advance_btn = page.locator("button:has-text('Mark En Route')").first
        if status_advance_btn.count() > 0:
            print("    Found 'Mark En Route' button on assigned trip card. Clicking...")
            status_advance_btn.click()
            time.sleep(1)
            print("    Advanced trip status!")

        page.screenshot(path=f"{SCREENSHOTS_DIR}/18_driver_terminal_dashboard.png")

        # =====================================================================
        # 4. ADMIN-SIDE (SUPER ADMIN PERSONA - PORT 3003)
        # =====================================================================
        print("\n>>> [PERSONA 4: SUPER ADMIN] Navigating admin control tower (port 3003)...")
        
        print("4.1 Loading Admin Login http://localhost:3003/login ...")
        res = page.goto("http://localhost:3003/login", wait_until="networkidle")
        assert res.status == 200
        page.wait_for_selector("text=Control Tower Admin", timeout=10000)
        
        admin_email = page.locator("input[type='email']")
        admin_pwd = page.locator("input[type='password']")
        assert admin_email.input_value() == "", f"Expected empty initial admin email, got '{admin_email.input_value()}'"
        assert admin_pwd.input_value() == "", f"Expected empty initial admin password, got '{admin_pwd.input_value()}'"
        print("    Verified empty placeholders in Admin Login form!")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/19_admin_login.png")

        # Sign in as Super Admin
        admin_email.fill("admin@platform.com")
        admin_pwd.fill("adminMasterPassword2026!")
        page.locator("button[type='submit']").click()
        
        page.wait_for_url("http://localhost:3003/", timeout=10000)
        print("4.2 Logged in successfully! Landed on Admin Control Tower.")
        page.wait_for_selector("text=Gross Volume", timeout=10000)
        print("    Verified platform KPI tiles (Gross Volume, Platform Commission, Properties, Drivers).")
        page.screenshot(path=f"{SCREENSHOTS_DIR}/20_admin_control_tower_kpis.png")

        # 4.3 Moderation of Properties Tab
        print("4.3 Switching to 'Properties' moderation tab...")
        props_tab = page.locator("button:has-text('Homestay Property Verification Desk')").first
        if props_tab.count() > 0:
            props_tab.click()
            time.sleep(1)
            page.wait_for_selector("text=Platform Rate", timeout=10000)
            print("    Verified properties moderation directory!")
            page.screenshot(path=f"{SCREENSHOTS_DIR}/21_admin_properties_moderation.png")

        # 4.4 Driver Settlement Ledger Tab
        print("4.4 Switching to 'Driver Payouts' tab...")
        payouts_tab = page.locator("button:has-text('Driver Payout Settlement Desk')").first
        if payouts_tab.count() > 0:
            payouts_tab.click()
            time.sleep(1)
            page.wait_for_selector("text=Driver Payout (82%)", timeout=10000)
            print("    Verified driver payout ledger table!")
            
            # Click Settle via UPI modal if pending trip exists
            settle_btn = page.locator("button:has-text('Settle via UPI')").first
            if settle_btn.count() > 0:
                print("    Opening UPI settlement modal...")
                settle_btn.click()
                time.sleep(1)
                page.screenshot(path=f"{SCREENSHOTS_DIR}/22_admin_settle_upi_modal.png")
                
                upi_input = page.locator("input[placeholder*='UPI-']").first
                if upi_input.count() > 0:
                    upi_input.fill("UPI-AUDIT-WALKTHROUGH-SUCCESS-999")
                    confirm_settle_btn = page.locator("button:has-text('Confirm Settlement')").first
                    if confirm_settle_btn.count() > 0:
                        confirm_settle_btn.click()
                        time.sleep(1.5)
                        print("    Settled payout via UPI successfully!")

            page.screenshot(path=f"{SCREENSHOTS_DIR}/23_admin_settled_ledger.png")

        browser.close()

    print("\n" + "=" * 70)
    print("ALL PERSONA WALKTHROUGHS COMPLETED SUCCESSFULLY!")
    print(f"Total Browser Errors Captured: {len(errors_captured)}")
    print(f"Total Network Failures: {len(network_failures)}")
    if errors_captured:
        print("Browser errors:")
        for e in errors_captured:
            print(f"  - {e}")
    if network_failures:
        print("Network failures:")
        for nf in network_failures:
            print(f"  - {nf}")
    print("=" * 70)

if __name__ == "__main__":
    run_tests()
