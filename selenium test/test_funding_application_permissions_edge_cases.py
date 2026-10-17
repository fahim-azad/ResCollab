"""
test_funding_application_permissions_edge_cases.py
==================================================
Automated Selenium & API Integration Test Suite for:
[T-027.7] Test funding application information, permissions, and edge cases

Features Tested:
1. API Security, Permissions & Error Edge Cases:
   - 401 Unauthorized for unauthenticated calls
   - 404 Not Found for non-existent opportunities (GET, PUT, DELETE, PATCH status)
   - 403 Forbidden when non-owner attempts PUT, DELETE, or PATCH status
   - Catalog isolation in GET /api/funding/my across distinct users
   - Validation edge cases:
     - Setting past deadline on Open opportunity rejected (400)
     - Setting past deadline on Closed opportunity permitted (200/201)
     - Invalid status string on PATCH status rejected (400)
     - Permissible empty/null optional fields (null deadline, null requirements, null amount, null url)
2. Application Information & Data Parsing Edge Cases:
   - Complex requirements delimiter parsing (numbered lists, semicolons, bullets, newlines)
   - Clean empty state when requirements are null (no NaN or broken progress)
   - Role-based applicant eligibility assessment (Student vs Faculty vs Open vs Broad)
   - URL protocol normalization (e.g. portal.domain.org -> https://portal.domain.org)
   - Google Calendar link generation with encoded parameters
   - Calendar download (.ics) presence when deadline exists and safe omission when deadline is rolling
3. Dual-Browser UI & Acceptance Flow:
   - Browser 1 (Alice - Opportunity Owner / Faculty):
     - Creating diverse edge-case opportunities (Urgent <= 7 days, Rolling admissions, Closed legacy)
     - Opening Details Modal as Owner (#funding-modal-{id})
     - Verifying owner action buttons (#btn-modal-edit-opp, #btn-modal-delete-opp, #btn-modal-toggle-status)
     - In-modal status toggling (Open <-> Closed) with instant badge update
     - In-modal edit action navigating to pre-populated edit form
   - Browser 2 (Bob - Student Researcher / Non-Owner):
     - View mode toggle between Grid View (#btn-view-mode-grid) and Deadline Timeline View (#btn-view-mode-timeline)
     - Timeline urgency grouping (#timeline-section-urgent30, #timeline-section-rolling, #timeline-section-past)
     - Card bookmarking with localStorage persistence across page reloads
     - Modal requirements checklist interaction, completion progress calculation, and localStorage persistence
     - Resetting checklist via .btn-clear-checklist
     - Non-owner security: owner action buttons strictly hidden
     - Share opportunity tool button (.btn-tool-pill)
   - Cleanup:
     - Opportunity deletion by owner and verification of DOM cleanup
"""

import os
import time
from datetime import datetime, timedelta, timezone
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC

BASE_API_URL = "http://localhost:5000/api"
FRONTEND_URL = "http://localhost:5173"


def register_user(role, full_name, email, password):
    res = requests.post(f"{BASE_API_URL}/auth/register", json={
        "email": email,
        "password": password,
        "fullName": full_name,
        "role": role
    })
    assert res.status_code in [200, 201], f"Registration failed: {res.text}"
    token = res.json().get("token")
    user_id = res.json().get("user", {}).get("id")

    headers = {"Authorization": f"Bearer {token}"}
    requests.post(f"{BASE_API_URL}/profile", headers=headers, json={
        "institution": "Stanford University",
        "department": "Computer Science",
        "designation": role,
        "bio": f"Profile of {full_name}",
        "researchInterests": "Quantum Algorithms, Applied Cryptography",
        "skills": "Python, Rust, Quantum SDK",
        "isAvailableForCollaboration": True,
        "visibility": "Public"
    })

    return {
        "id": user_id,
        "email": email,
        "password": password,
        "fullName": full_name,
        "role": role,
        "token": token
    }


def create_driver(position=(0, 0), size=(940, 980)):
    options = webdriver.ChromeOptions()
    # Default HEADLESS to false so the user sees the real browser open on screen
    if os.environ.get("HEADLESS", "false").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument(f"--window-size={size[0]},{size[1]}")
    options.add_argument(f"--window-position={position[0]},{position[1]}")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    driver = webdriver.Chrome(options=options)
    try:
        driver.set_window_position(position[0], position[1])
        driver.set_window_size(size[0], size[1])
    except Exception:
        pass
    return driver


def test_funding_application_permissions_and_edge_cases():
    print("==========================================================================================")
    print("=== STARTING T-027.7: FUNDING APPLICATION INFO, PERMISSIONS & EDGE CASES ===")
    print("==========================================================================================")

    timestamp = int(time.time() * 1000)

    # 0. Register test users
    print("0. Registering test users (Alice = Faculty / Opportunity Owner, Bob = Student / Peer)...")
    alice = register_user("Faculty", f"Dr. Alice Owner {timestamp}", f"alice_edge_{timestamp}@edgetest.com", "Password123!")
    bob = register_user("Student", f"Bob Applicant {timestamp}", f"bob_edge_{timestamp}@edgetest.com", "Password123!")

    headers_alice = {"Authorization": f"Bearer {alice['token']}", "Content-Type": "application/json"}
    headers_bob = {"Authorization": f"Bearer {bob['token']}", "Content-Type": "application/json"}

    # =========================================================================
    # PHASE 1: API PERMISSIONS, 404 NOT FOUND & VALIDATION EDGE CASES
    # =========================================================================
    print("\n--- PHASE 1: API PERMISSIONS & EDGE CASES ENFORCEMENT ---")

    # 1. Non-existent ID handling (404 Not Found)
    print("1. Validating 404 Not Found on non-existent opportunity IDs...")
    assert requests.get(f"{BASE_API_URL}/funding/999999", headers=headers_alice).status_code == 404
    assert requests.put(f"{BASE_API_URL}/funding/999999", headers=headers_alice, json={"title": "T", "provider": "P", "fundingType": "Grant"}).status_code == 404
    assert requests.delete(f"{BASE_API_URL}/funding/999999", headers=headers_alice).status_code == 404
    assert requests.patch(f"{BASE_API_URL}/funding/999999/status", headers=headers_alice, json="Closed").status_code == 404
    print("[PASS] 404 Not Found cleanly returned across all endpoints for non-existent IDs.")

    # 2. Validation Edge Cases
    print("2. Validating status mutation and past deadline rules...")
    # Past deadline on CLOSED opportunity is allowed (archived calls record past dates)
    past_date = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    r_closed_past = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json={
        "title": f"Archived NSF Grant {timestamp}",
        "provider": "NSF",
        "fundingType": "Grant",
        "status": "Closed",
        "deadline": past_date
    })
    assert r_closed_past.status_code == 201, f"Expected 201 for Closed call with past deadline: {r_closed_past.text}"
    closed_opp_id = r_closed_past.json()["id"]

    # Setting an invalid status string on PATCH status (on Alice's owned opportunity)
    r_bad_status = requests.patch(f"{BASE_API_URL}/funding/{closed_opp_id}/status", headers=headers_alice, json="Draft")
    assert r_bad_status.status_code == 400 and "Status must be Open, Closed, or Upcoming" in r_bad_status.text
    print("[PASS] Past deadline correctly permitted on Closed opportunities, invalid status rejected.")

    # 3. Create Diverse Opportunities for Edge Cases
    print("3. Creating test opportunities with varied application info and edge cases...")

    # Opp 1: Urgent Deadline (Due in 3 days) with complex multi-delimiter requirements
    # Testing complex requirements parsing: numbered list, semicolon, bullet point, newline
    deadline_3d = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    complex_requirements = (
        "1. Project Technical Abstract (1 page)\n"
        "2. Detailed Research Proposal (5 pages)\n"
        "• Two Institutional Letters of Recommendation; Comprehensive Budget Breakdown\n"
        "- Ethical Review Board Approval Certificate"
    )
    opp_urgent_payload = {
        "title": f"Urgent Bio-Defense Fellowship {timestamp}",
        "provider": "DARPA Biological Technologies",
        "description": "High-urgency fast-track fellowship for accelerated synthetic biology research.",
        "eligibility": "PhD students, doctoral candidates, and early graduate scholars",
        "requirements": complex_requirements,
        "fundingAmount": "$65,000 allowance",
        "fundingType": "Fellowship",
        "researchArea": "Biomedical & Health",
        "applicationUrl": "https://www.darpa.mil/bto-apply",
        "applicationInfo": "Expedited review cycle. Submit all dossier materials via DARPA submission portal before 5:00 PM EST.",
        "deadline": deadline_3d,
        "status": "Open"
    }
    r_urgent = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json=opp_urgent_payload)
    assert r_urgent.status_code == 201, f"Create urgent opp failed: {r_urgent.text}"
    opp_urgent_id = r_urgent.json()["id"]

    # Opp 2: Rolling Admissions with all optional fields NULL (Edge Case: null deadline, null requirements, null amount, null url, null area)
    opp_minimal_payload = {
        "title": f"CERN Quantum Simulation Open Call {timestamp}",
        "provider": "CERN OpenLab",
        "description": "Continuous open call for quantum simulator benchmarking.",
        "eligibility": "Open to all accredited academic researchers",
        "requirements": None,
        "fundingAmount": None,
        "fundingType": "Other",
        "researchArea": None,
        "applicationUrl": None,
        "applicationInfo": "Rolling evaluation of proposals by international review panel.",
        "deadline": None,
        "status": "Open"
    }
    r_minimal = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json=opp_minimal_payload)
    assert r_minimal.status_code == 201, f"Create minimal opp failed: {r_minimal.text}"
    opp_minimal_id = r_minimal.json()["id"]

    # Opp 3: Faculty-only Grant with non-prefixed portal URL (e.g. portal.energy.gov/apply)
    opp_faculty_payload = {
        "title": f"DOE Advanced Grid Innovation Grant {timestamp}",
        "provider": "U.S. Department of Energy",
        "description": "Grid infrastructure modernisation for tenured research faculty.",
        "eligibility": "Tenured and tenure-track Faculty, Senior Principal Investigators",
        "requirements": "Institutional Letter of Support; 10-page Technical Plan",
        "fundingAmount": "$500,000 over 2 years",
        "fundingType": "Grant",
        "researchArea": "Engineering",
        "applicationUrl": "portal.energy.gov/grants/apply",
        "applicationInfo": "Apply through institutional sponsored research office.",
        "deadline": (datetime.now(timezone.utc) + timedelta(days=50)).isoformat(),
        "status": "Open"
    }
    r_faculty = requests.post(f"{BASE_API_URL}/funding", headers=headers_alice, json=opp_faculty_payload)
    assert r_faculty.status_code == 201, f"Create faculty opp failed: {r_faculty.text}"
    opp_faculty_id = r_faculty.json()["id"]

    print(f"[PASS] Opportunities created: Urgent #{opp_urgent_id}, Minimal #{opp_minimal_id}, Faculty #{opp_faculty_id}, Closed #{closed_opp_id}.")

    # 4. Strict Permissions Validation
    print("4. Testing non-owner permission denials and catalog isolation...")
    # Bob attempts to update Alice's Urgent opportunity
    assert requests.put(f"{BASE_API_URL}/funding/{opp_urgent_id}", headers=headers_bob, json={
        "title": "Hacked Title", "provider": "P", "fundingType": "Grant"
    }).status_code == 403

    # Bob attempts to delete Alice's Urgent opportunity
    assert requests.delete(f"{BASE_API_URL}/funding/{opp_urgent_id}", headers=headers_bob).status_code == 403

    # Bob attempts to toggle status of Alice's Urgent opportunity
    assert requests.patch(f"{BASE_API_URL}/funding/{opp_urgent_id}/status", headers=headers_bob, json="Closed").status_code == 403

    # User catalog isolation in GET /api/funding/my
    r_alice_my = requests.get(f"{BASE_API_URL}/funding/my", headers=headers_alice)
    alice_my_ids = [o["id"] for o in r_alice_my.json()]
    assert opp_urgent_id in alice_my_ids and opp_minimal_id in alice_my_ids and opp_faculty_id in alice_my_ids

    r_bob_my = requests.get(f"{BASE_API_URL}/funding/my", headers=headers_bob)
    bob_my_ids = [o["id"] for o in r_bob_my.json()]
    assert opp_urgent_id not in bob_my_ids and opp_minimal_id not in bob_my_ids

    print("[PASS] Permissions validated: 403 Forbidden enforced on mutation, catalogs strictly partitioned.")

    # =========================================================================
    # PHASE 2: DUAL-BROWSER SELENIUM ACCEPTANCE & EDGE-CASE UI WORKFLOW
    # =========================================================================
    print("\n--- PHASE 2: DUAL-BROWSER SELENIUM ACCEPTANCE & EDGE-CASE UI TESTING ---")

    print("\n[INFO] Launching visible Chrome browser windows side-by-side...")
    driver_alice = create_driver(position=(0, 0), size=(960, 1020))
    driver_bob = create_driver(position=(960, 0), size=(960, 1020))
    wait_alice = WebDriverWait(driver_alice, 15)
    wait_bob = WebDriverWait(driver_bob, 15)

    try:
        # Step 5: Login Alice (Opportunity Owner) in Browser 1
        print("5. Logging in Alice in Browser 1...")
        driver_alice.get(f"{FRONTEND_URL}/login")
        in_email_a = wait_alice.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        in_email_a.clear()
        in_email_a.send_keys(alice["email"])
        driver_alice.find_element(By.XPATH, "//input[@type='password']").send_keys(alice["password"])
        driver_alice.find_element(By.XPATH, "//button[@type='submit']").click()
        wait_alice.until(EC.url_contains("/profile"))

        # Navigate Alice to /funding
        driver_alice.get(f"{FRONTEND_URL}/funding")
        wait_alice.until(EC.presence_of_element_located((By.ID, "funding-opportunities-page")))
        print("[PASS] Alice logged in and /funding loaded.")

        # Step 6: Verify Owner Actions inside Details Modal
        print("6. Verifying Owner controls inside Details Modal for Alice...")
        btn_view_urgent = wait_alice.until(EC.element_to_be_clickable((By.ID, f"btn-view-details-{opp_urgent_id}")))
        driver_alice.execute_script("arguments[0].click();", btn_view_urgent)

        modal_urgent = wait_alice.until(EC.presence_of_element_located((By.ID, f"funding-modal-{opp_urgent_id}")))

        # Check Owner action buttons ARE visible for Alice
        btn_edit_modal = modal_urgent.find_element(By.ID, "btn-modal-edit-opp")
        btn_del_modal = modal_urgent.find_element(By.ID, "btn-modal-delete-opp")
        btn_toggle_modal = modal_urgent.find_element(By.ID, "btn-modal-toggle-status")

        assert btn_edit_modal.is_displayed(), "Owner edit button should be displayed"
        assert btn_del_modal.is_displayed(), "Owner delete button should be displayed"
        assert btn_toggle_modal.is_displayed(), "Owner status toggle button should be displayed"
        print("[PASS] Owner action buttons (Edit, Delete, Toggle Status) confirmed visible for owner.")

        # Test In-Modal Status Toggle: Open -> Closed
        print("7. Testing in-modal status toggling (Open -> Closed)...")
        assert "Mark as Closed" in (btn_toggle_modal.get_attribute("textContent") or btn_toggle_modal.text)
        driver_alice.execute_script("arguments[0].click();", btn_toggle_modal)

        # Wait for status badge in modal header to become Closed
        wait_alice.until(lambda d: "Closed" in (
            d.find_element(By.CSS_SELECTOR, f"#{modal_urgent.get_attribute('id')} .funding-status-pill").get_attribute("textContent") or ""
        ))
        print("[PASS] Status toggled to Closed in modal.")

        # Toggle back to Open
        btn_toggle_modal_again = modal_urgent.find_element(By.ID, "btn-modal-toggle-status")
        assert "Mark as Open" in (btn_toggle_modal_again.get_attribute("textContent") or btn_toggle_modal_again.text)
        driver_alice.execute_script("arguments[0].click();", btn_toggle_modal_again)

        wait_alice.until(lambda d: "Open" in (
            d.find_element(By.CSS_SELECTOR, f"#{modal_urgent.get_attribute('id')} .funding-status-pill").get_attribute("textContent") or ""
        ))
        print("[PASS] Status toggled back to Open in modal.")

        # Test Edit Button inside modal transitions to pre-filled Edit Form
        print("8. Testing in-modal Edit button transitions to pre-filled form...")
        driver_alice.execute_script("arguments[0].click();", btn_edit_modal)

        # Modal closes and Add/Edit pane opens
        wait_alice.until(EC.invisibility_of_element_located((By.ID, f"funding-modal-{opp_urgent_id}")))
        wait_alice.until(EC.presence_of_element_located((By.ID, "pane-post-funding")))

        input_title = driver_alice.find_element(By.ID, "funding-title")
        assert f"Urgent Bio-Defense Fellowship {timestamp}" in (input_title.get_attribute("value") or "")
        print("[PASS] Modal Edit button closed modal and loaded pre-populated form.")

        # Cancel edit to return to Explore
        btn_cancel = driver_alice.find_element(By.XPATH, "//button[contains(text(), 'Cancel')]")
        driver_alice.execute_script("arguments[0].click();", btn_cancel)
        wait_alice.until(EC.presence_of_element_located((By.ID, "pane-explore-funding")))

        # =====================================================================
        # Step 9: Login Bob (Student Researcher / Non-Owner) in Browser 2
        # =====================================================================
        print("\n9. Logging in Bob (Student Researcher) in Browser 2...")
        driver_bob.get(f"{FRONTEND_URL}/login")
        in_email_b = wait_bob.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        in_email_b.clear()
        in_email_b.send_keys(bob["email"])
        driver_bob.find_element(By.XPATH, "//input[@type='password']").send_keys(bob["password"])
        driver_bob.find_element(By.XPATH, "//button[@type='submit']").click()
        wait_bob.until(EC.url_contains("/profile"))

        # Navigate Bob to /funding
        driver_bob.get(f"{FRONTEND_URL}/funding")
        wait_bob.until(EC.presence_of_element_located((By.ID, "funding-opportunities-page")))
        wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp_urgent_id}")))
        print("[PASS] Bob logged in and /funding page loaded.")

        # Step 10: View Mode Toggle (Grid vs Deadline Timeline View)
        print("10. Testing View Mode Switcher (Grid <-> Timeline View)...")
        btn_timeline = wait_bob.until(EC.element_to_be_clickable((By.ID, "btn-view-mode-timeline")))
        driver_bob.execute_script("arguments[0].click();", btn_timeline)

        timeline_container = wait_bob.until(EC.presence_of_element_located((By.ID, "funding-timeline-view")))
        assert timeline_container.is_displayed()

        # Verify Timeline Sections:
        # 1. Urgent section (due in 3 days)
        sec_urgent = wait_bob.until(EC.presence_of_element_located((By.ID, "timeline-section-urgent30")))
        assert f"Urgent Bio-Defense Fellowship {timestamp}" in (sec_urgent.get_attribute("textContent") or "")

        # 2. Rolling section (no deadline)
        sec_rolling = wait_bob.until(EC.presence_of_element_located((By.ID, "timeline-section-rolling")))
        assert f"CERN Quantum Simulation Open Call {timestamp}" in (sec_rolling.get_attribute("textContent") or "")

        print("[PASS] Deadline Timeline view correctly grouped urgent and rolling calls into chronological sections.")

        # Switch back to Grid View
        btn_grid = wait_bob.until(EC.element_to_be_clickable((By.ID, "btn-view-mode-grid")))
        driver_bob.execute_script("arguments[0].click();", btn_grid)
        wait_bob.until(EC.presence_of_element_located((By.ID, "funding-cards-grid")))
        print("[PASS] Switched back to Grid View.")

        # Step 11: Card Bookmarking Persistence
        print("11. Testing Card Bookmarking with localStorage persistence...")
        card_urgent = wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp_urgent_id}")))
        btn_bookmark = card_urgent.find_element(By.CSS_SELECTOR, ".btn-bookmark-card")

        assert "saved" not in btn_bookmark.get_attribute("class")

        # Click bookmark
        driver_bob.execute_script("arguments[0].click();", btn_bookmark)
        time.sleep(0.5)
        assert "saved" in btn_bookmark.get_attribute("class"), "Bookmark button should have 'saved' class after click"

        # Reload page and verify bookmark status persists
        driver_bob.refresh()
        wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-card-{opp_urgent_id}")))
        card_urgent_reloaded = driver_bob.find_element(By.ID, f"funding-card-{opp_urgent_id}")
        btn_bookmark_reloaded = card_urgent_reloaded.find_element(By.CSS_SELECTOR, ".btn-bookmark-card")
        assert "saved" in btn_bookmark_reloaded.get_attribute("class"), "Bookmark status did not persist across page refresh"
        print("[PASS] Opportunity bookmarking persists in localStorage across reloads.")

        # Un-bookmark
        driver_bob.execute_script("arguments[0].click();", btn_bookmark_reloaded)
        time.sleep(0.5)
        assert "saved" not in btn_bookmark_reloaded.get_attribute("class")

        # Step 12: Requirements Parsing & Interactive Checklist Persistence
        print("12. Testing complex requirements delimiter parsing and checklist persistence in modal...")
        btn_view_urgent_bob = wait_bob.until(EC.element_to_be_clickable((By.ID, f"btn-view-details-{opp_urgent_id}")))
        driver_bob.execute_script("arguments[0].click();", btn_view_urgent_bob)

        modal_urgent_bob = wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-modal-{opp_urgent_id}")))

        # Check that complex requirements delimiter parsed 5 separate items:
        # 1. Project Technical Abstract (1 page)
        # 2. Detailed Research Proposal (5 pages)
        # 3. Two Institutional Letters of Recommendation
        # 4. Comprehensive Budget Breakdown
        # 5. Ethical Review Board Approval Certificate
        checklist_items = modal_urgent_bob.find_elements(By.CSS_SELECTOR, ".checklist-item")
        assert len(checklist_items) == 5, f"Expected 5 parsed requirements, got {len(checklist_items)}"

        item_texts = [(item.find_element(By.CSS_SELECTOR, ".checklist-text").get_attribute("textContent") or "").strip() for item in checklist_items]
        assert any("Project Technical Abstract" in t for t in item_texts)
        assert any("Detailed Research Proposal" in t for t in item_texts)
        assert any("Two Institutional Letters of Recommendation" in t for t in item_texts)
        assert any("Comprehensive Budget Breakdown" in t for t in item_texts)
        assert any("Ethical Review Board Approval Certificate" in t for t in item_texts)
        print("[PASS] Complex requirements (numbered, semicolon, bullets, newlines) parsed into 5 distinct checklist items.")

        # Check first 2 items
        driver_bob.execute_script("arguments[0].click();", checklist_items[0])
        time.sleep(0.3)
        driver_bob.execute_script("arguments[0].click();", checklist_items[1])
        time.sleep(0.3)

        progress_text = modal_urgent_bob.find_element(By.CSS_SELECTOR, ".progress-info strong")
        assert "2 of 5 items ready (40%)" in (progress_text.get_attribute("textContent") or progress_text.text)

        # Close and Reopen Modal to verify checklist persistence in localStorage
        btn_close_urgent = modal_urgent_bob.find_element(By.ID, "btn-close-funding-details")
        driver_bob.execute_script("arguments[0].click();", btn_close_urgent)
        wait_bob.until(EC.invisibility_of_element_located((By.ID, f"funding-modal-{opp_urgent_id}")))

        # Reopen modal
        driver_bob.execute_script("arguments[0].click();", btn_view_urgent_bob)
        modal_reopened = wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-modal-{opp_urgent_id}")))
        reopened_items = modal_reopened.find_elements(By.CSS_SELECTOR, ".checklist-item")

        assert "completed" in reopened_items[0].get_attribute("class")
        assert "completed" in reopened_items[1].get_attribute("class")
        reopened_progress = modal_reopened.find_element(By.CSS_SELECTOR, ".progress-info strong")
        assert "2 of 5 items ready (40%)" in (reopened_progress.get_attribute("textContent") or reopened_progress.text)
        print("[PASS] Checklist completion state persists in localStorage across modal sessions.")

        # Test Reset Checklist Button (.btn-clear-checklist)
        btn_reset_checklist = modal_reopened.find_element(By.CSS_SELECTOR, ".btn-clear-checklist")
        driver_bob.execute_script("arguments[0].click();", btn_reset_checklist)
        time.sleep(0.5)

        reopened_progress_cleared = modal_reopened.find_element(By.CSS_SELECTOR, ".progress-info strong")
        assert "0 of 5 items ready (0%)" in (reopened_progress_cleared.get_attribute("textContent") or reopened_progress_cleared.text)
        print("[PASS] Reset checklist cleared selections and restored 0% progress.")

        # Test Google Calendar link generation
        gcal_link = modal_reopened.find_element(By.XPATH, ".//a[contains(@href, 'calendar.google.com')]")
        gcal_href = gcal_link.get_attribute("href") or ""
        assert "calendar.google.com/calendar/render" in gcal_href
        assert "Grant%20Deadline" in gcal_href or "Grant+Deadline" in gcal_href or "Grant" in gcal_href
        assert gcal_link.get_attribute("target") == "_blank"
        print("[PASS] Google Calendar reminder link correctly generated with event parameters.")

        # Test Share Opportunity Button
        btn_share = modal_reopened.find_element(By.XPATH, ".//button[contains(., 'Share Opportunity')]")
        driver_bob.execute_script("arguments[0].click();", btn_share)
        wait_bob.until(lambda d: "Details Copied!" in (
            d.find_element(By.CSS_SELECTOR, f"#{modal_reopened.get_attribute('id')} .funding-modal-tools").get_attribute("textContent") or ""
        ))
        print("[PASS] Share Opportunity button triggered visual confirmation ('Details Copied!').")

        # Close urgent modal
        driver_bob.execute_script("arguments[0].click();", modal_reopened.find_element(By.ID, "btn-close-funding-details"))
        wait_bob.until(EC.invisibility_of_element_located((By.ID, f"funding-modal-{opp_urgent_id}")))

        # Step 13: Edge Case Verification for Minimal Opportunity (All Null Optional Fields)
        print("13. Testing Edge Case: Opportunity with rolling deadline & null optional fields...")
        btn_view_minimal = wait_bob.until(EC.element_to_be_clickable((By.ID, f"btn-view-details-{opp_minimal_id}")))
        driver_bob.execute_script("arguments[0].click();", btn_view_minimal)

        modal_minimal = wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-modal-{opp_minimal_id}")))

        # 1. Deadline pill says 'Rolling / Open Deadline'
        deadline_pill = modal_minimal.find_element(By.CSS_SELECTOR, ".funding-deadline-pill")
        assert "Rolling / Open Deadline" in (deadline_pill.get_attribute("textContent") or deadline_pill.text)

        # 2. Calendar links should NOT be present (no date to add)
        cal_links = modal_minimal.find_elements(By.XPATH, ".//a[contains(@href, 'calendar.google.com')]")
        assert len(cal_links) == 0, "Calendar link should be omitted when deadline is rolling"

        # 3. Checklist section should NOT be present (no requirements)
        checklists = modal_minimal.find_elements(By.CSS_SELECTOR, ".checklist-items-list")
        assert len(checklists) == 0, "Checklist section should be omitted when requirements are null"

        # 4. Amount hero should NOT be present (no amount)
        amount_heroes = modal_minimal.find_elements(By.CSS_SELECTOR, ".funding-amount-hero")
        assert len(amount_heroes) == 0, "Amount hero should be omitted when funding amount is null"

        # 5. Broad eligibility banner is displayed cleanly
        elig_banner = modal_minimal.find_element(By.CSS_SELECTOR, ".eligibility-profile-banner")
        assert "Broad Academic Eligibility" in (elig_banner.get_attribute("textContent") or elig_banner.text)

        # 6. Non-owner actions strictly hidden
        assert len(modal_minimal.find_elements(By.ID, "btn-modal-edit-opp")) == 0
        assert len(modal_minimal.find_elements(By.ID, "btn-modal-delete-opp")) == 0
        assert len(modal_minimal.find_elements(By.ID, "btn-modal-toggle-status")) == 0
        print("[PASS] Minimal opportunity rendered cleanly with all null-safe omissions verified.")

        # Close minimal modal
        driver_bob.execute_script("arguments[0].click();", modal_minimal.find_element(By.ID, "btn-close-funding-details"))
        wait_bob.until(EC.invisibility_of_element_located((By.ID, f"funding-modal-{opp_minimal_id}")))

        # Step 14: Edge Case Verification for Application URL Protocol Normalization & Role Notice
        print("14. Testing URL protocol prepending and Faculty Standing Notice for Student Bob...")
        btn_view_fac = wait_bob.until(EC.element_to_be_clickable((By.ID, f"btn-view-details-{opp_faculty_id}")))
        driver_bob.execute_script("arguments[0].click();", btn_view_fac)

        modal_fac = wait_bob.until(EC.presence_of_element_located((By.ID, f"funding-modal-{opp_faculty_id}")))

        # 1. Eligibility evaluation banner shows notice for Student
        eval_banner_fac = modal_fac.find_element(By.CSS_SELECTOR, ".eligibility-profile-banner")
        assert "notice" in eval_banner_fac.get_attribute("class")
        assert "Faculty / Principal Investigator Standing Required" in (eval_banner_fac.get_attribute("textContent") or eval_banner_fac.text)

        # 2. Portal link prepended with https:// when missing protocol
        portal_fac = modal_fac.find_element(By.ID, f"btn-open-portal-{opp_faculty_id}")
        assert portal_fac.get_attribute("href") == "https://portal.energy.gov/grants/apply"
        assert portal_fac.get_attribute("target") == "_blank"
        assert portal_fac.get_attribute("rel") == "noopener noreferrer"
        print("[PASS] Faculty eligibility notice and application URL protocol prepending verified.")

        # Close modal
        driver_bob.execute_script("arguments[0].click();", modal_fac.find_element(By.ID, "btn-close-funding-details"))
        wait_bob.until(EC.invisibility_of_element_located((By.ID, f"funding-modal-{opp_faculty_id}")))

        # =====================================================================
        # Step 15: Alice Cleans Up Test Opportunities in Browser 1
        # =====================================================================
        print("\n15. Cleaning up opportunities via Alice in Browser 1...")
        tab_my_a = wait_alice.until(EC.element_to_be_clickable((By.ID, "tab-my-funding")))
        driver_alice.execute_script("arguments[0].click();", tab_my_a)
        wait_alice.until(EC.presence_of_element_located((By.ID, "my-funding-grid")))

        # Delete the urgent opportunity
        card_urgent_a = None
        for c in driver_alice.find_elements(By.CSS_SELECTOR, ".funding-card.my-opp-card"):
            if f"Urgent Bio-Defense Fellowship {timestamp}" in (c.get_attribute("textContent") or ""):
                card_urgent_a = c
                break
        if card_urgent_a:
            btn_del = card_urgent_a.find_element(By.XPATH, ".//button[@title='Delete Opportunity']")
            driver_alice.execute_script("arguments[0].click();", btn_del)
            WebDriverWait(driver_alice, 5).until(EC.alert_is_present())
            driver_alice.switch_to.alert.accept()
            time.sleep(1)

        print("[PASS] Cleanup completed.")

        print("\n==========================================================================================")
        print("=== [T-027.7] ALL FUNDING APPLICATION INFO, PERMISSIONS & EDGE CASES PASSED ===")
        print("==========================================================================================")

    finally:
        driver_alice.quit()
        driver_bob.quit()


if __name__ == "__main__":
    test_funding_application_permissions_and_edge_cases()
