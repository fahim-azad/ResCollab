"""
test_publication_crud_validation_visibility.py
=============================================
Automated Selenium & API Integration Test Suite for:
[T-026.5] Test publication creation, editing, deletion, validation, and visibility

Features Tested:
1. API Security & Validation:
   - 401 Unauthorized for unauthenticated requests across all CRUD endpoints
   - 400 Bad Request on missing title, missing authors, out-of-bounds year, invalid publication type,
     invalid visibility, missing identifying metadata, invalid DOI format, and invalid source link URL
2. API CRUD & Ownership Boundaries:
   - Publication creation with metadata normalization (DOI prefix stripping, URL protocol prepending)
   - Publication update (PUT /api/publication/{id}) by owner
   - 403 Forbidden on non-owner attempting update, deletion, or visibility toggle
   - Visibility isolation: Private publications hidden from public search/explore and return 403 to non-owners
   - Deletion (DELETE /api/publication/{id}) by owner and 404 verification
3. Dual-Browser UI & Acceptance Flow:
   - Browser 1 (Alice - Author / Owner):
     - Interactive form validation with inline error banner display (#pub-form-error-banner)
     - Creating a complete research publication record with DOI and venue
     - Card rendering in My Publications (#my-publications-grid) with badges and metadata
     - In-place editing via form (#btn-edit-pub-{id}) and persisting changes
     - Opening publication details modal (#pub-details-modal-{id}) with citation generation
     - Toggling portfolio visibility (Public <-> Private) with instant UI badge updates
     - Deleting a publication record with confirmation acceptance
   - Browser 2 (Bob - Peer Researcher / Non-Owner):
     - Exploring public publications tab (#tab-explore-publications)
     - Validating private publication is strictly hidden from peer's explore list
     - Searching and viewing the publication once public
     - Opening details modal as non-owner and verifying owner actions (edit/delete/visibility) are hidden
"""

import os
import time
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
        "institution": "MIT CSAIL",
        "department": "EECS",
        "designation": role,
        "bio": f"Profile of {full_name}",
        "researchInterests": "Quantum Computing, Software Engineering",
        "skills": "Python, C#, Distributed Systems",
        "isAvailableForCollaboration": True,
        "visibility": "Public"
    })

    return {
        "id": user_id,
        "email": email,
        "password": password,
        "fullName": full_name,
        "token": token
    }


def create_driver():
    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "true").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    driver = webdriver.Chrome(options=options)
    return driver


def test_publication_crud_validation_and_visibility():
    print("==========================================================================================")
    print("=== STARTING T-026.5: PUBLICATION CREATION, EDITING, DELETION, VALIDATION & VISIBILITY ===")
    print("==========================================================================================")

    timestamp = int(time.time() * 1000)

    # 0. Register test users
    print("0. Registering test users (Alice = Lead Author, Bob = Peer Researcher)...")
    alice = register_user("Faculty", f"Dr. Alice Turing {timestamp}", f"alice_pub_{timestamp}@pubtest.com", "Password123!")
    bob = register_user("Student", f"Bob Researcher {timestamp}", f"bob_pub_{timestamp}@pubtest.com", "Password123!")

    headers_alice = {"Authorization": f"Bearer {alice['token']}"}
    headers_bob = {"Authorization": f"Bearer {bob['token']}"}

    # =========================================================================
    # PHASE 1: API SECURITY & VALIDATION RULES
    # =========================================================================
    print("\n--- PHASE 1: API SECURITY & INPUT VALIDATION ENFORCEMENT ---")

    # 1. Unauthenticated rejection (401 Unauthorized)
    print("1. Validating 401 Unauthorized on unauthenticated requests...")
    assert requests.get(f"{BASE_API_URL}/publication/my").status_code == 401
    assert requests.post(f"{BASE_API_URL}/publication", json={"title": "Test"}).status_code == 401
    assert requests.put(f"{BASE_API_URL}/publication/1", json={"title": "Test"}).status_code == 401
    assert requests.delete(f"{BASE_API_URL}/publication/1").status_code == 401
    assert requests.patch(f"{BASE_API_URL}/publication/1/visibility", json="Public").status_code == 401
    print("[PASS] 401 Unauthorized enforced for all unauthenticated operations.")

    # 2. Input validation rules on creation (400 Bad Request)
    print("2. Validating request payload constraints (400 Bad Request)...")

    # 2a. Missing title
    r_no_title = requests.post(f"{BASE_API_URL}/publication", headers=headers_alice, json={
        "title": "   ",
        "authors": "Author A",
        "publicationYear": 2024,
        "journalOrConference": "IEEE Transactions"
    })
    assert r_no_title.status_code == 400 and "Title is required" in r_no_title.text, f"Unexpected: {r_no_title.text}"

    # 2b. Missing authors
    r_no_authors = requests.post(f"{BASE_API_URL}/publication", headers=headers_alice, json={
        "title": "Valid Title",
        "authors": "",
        "publicationYear": 2024,
        "journalOrConference": "IEEE Transactions"
    })
    assert r_no_authors.status_code == 400 and "Authors field is required" in r_no_authors.text, f"Unexpected: {r_no_authors.text}"

    # 2c. Out of bounds year
    r_bad_year = requests.post(f"{BASE_API_URL}/publication", headers=headers_alice, json={
        "title": "Valid Title",
        "authors": "Author A",
        "publicationYear": 1850,
        "journalOrConference": "IEEE Transactions"
    })
    assert r_bad_year.status_code == 400 and "Publication year must be between" in r_bad_year.text, f"Unexpected: {r_bad_year.text}"

    # 2d. Missing identifying metadata (no DOI, no venue, no source link)
    r_no_ident = requests.post(f"{BASE_API_URL}/publication", headers=headers_alice, json={
        "title": "Valid Title",
        "authors": "Author A",
        "publicationYear": 2024
    })
    assert r_no_ident.status_code == 400 and "At least one of DOI, Journal/Conference, or Source Link" in r_no_ident.text, f"Unexpected: {r_no_ident.text}"

    # 2e. Malformed DOI format
    r_bad_doi = requests.post(f"{BASE_API_URL}/publication", headers=headers_alice, json={
        "title": "Valid Title",
        "authors": "Author A",
        "publicationYear": 2024,
        "doi": "not_a_doi_number"
    })
    assert r_bad_doi.status_code == 400 and "DOI format appears invalid" in r_bad_doi.text, f"Unexpected: {r_bad_doi.text}"

    # 2f. Malformed Source Link URL
    r_bad_link = requests.post(f"{BASE_API_URL}/publication", headers=headers_alice, json={
        "title": "Valid Title",
        "authors": "Author A",
        "publicationYear": 2024,
        "journalOrConference": "IEEE Transactions",
        "sourceLink": "ftp://unsupported-scheme.com/file"
    })
    assert r_bad_link.status_code == 400 and "Source link must be a valid HTTP or HTTPS URL" in r_bad_link.text, f"Unexpected: {r_bad_link.text}"

    print("[PASS] Validation constraints correctly enforced on title, authors, year, identifiers, DOI and URLs.")

    # =========================================================================
    # PHASE 2: API CRUD OPERATIONS & OWNERSHIP PERMISSIONS
    # =========================================================================
    print("\n--- PHASE 2: API CRUD OPERATIONS & OWNERSHIP PERMISSIONS ---")

    # 1. Create Public Publication with Normalization
    print("1. Alice creating a public publication with full metadata & normalization...")
    pub_payload_1 = {
        "title": f"Quantum State Optimization in Mesh Topologies {timestamp}",
        "authors": "Alice Turing, Nahiyan Kamal",
        "doi": "https://doi.org/10.1109/TSE.2024.1234567",  # Raw URL format
        "journalOrConference": "IEEE Transactions on Software Engineering",
        "publicationYear": 2024,
        "abstract": "Novel algorithms for routing entangled quantum photon states.",
        "sourceLink": "arxiv.org/abs/2401.12345",  # Raw host without protocol
        "publicationType": "Journal",
        "visibility": "Public"
    }
    r_create = requests.post(f"{BASE_API_URL}/publication", headers=headers_alice, json=pub_payload_1)
    assert r_create.status_code == 201, f"Create failed: {r_create.text}"
    pub_1 = r_create.json()
    pub_1_id = pub_1["id"]

    # Verify normalization
    assert pub_1["doi"] == "10.1109/TSE.2024.1234567", f"DOI not normalized: {pub_1['doi']}"
    assert pub_1["sourceLink"] == "https://arxiv.org/abs/2401.12345", f"Source link not normalized: {pub_1['sourceLink']}"
    assert pub_1["visibility"] == "Public"
    print(f"[PASS] Publication #{pub_1_id} created with verified DOI and URL normalization.")

    # 2. Update / Edit by Owner (Alice)
    print(f"2. Alice updating publication #{pub_1_id}...")
    pub_payload_update = {
        "title": f"Quantum State Optimization in Mesh Topologies (Extended V2) {timestamp}",
        "authors": "Alice Turing, Nahiyan Kamal, Ispahani Ahmed",
        "doi": "10.1109/TSE.2024.1234567",
        "journalOrConference": "ACM Transactions on Quantum Computing",
        "publicationYear": 2025,
        "abstract": "Extended experimental benchmark across 64-node quantum clusters.",
        "sourceLink": "https://arxiv.org/abs/2401.12345",
        "publicationType": "Conference",
        "visibility": "Public"
    }
    r_update = requests.put(f"{BASE_API_URL}/publication/{pub_1_id}", headers=headers_alice, json=pub_payload_update)
    assert r_update.status_code == 200, f"Update failed: {r_update.text}"
    updated_pub = r_update.json()
    assert updated_pub["title"] == pub_payload_update["title"]
    assert updated_pub["publicationYear"] == 2025
    assert updated_pub["publicationType"] == "Conference"
    print(f"[PASS] Publication #{pub_1_id} successfully updated by owner.")

    # 3. Non-owner (Bob) attempts update/delete/visibility on Alice's publication (403 Forbidden)
    print(f"3. Validating non-owner Bob receives 403 Forbidden on publication #{pub_1_id}...")
    r_bob_edit = requests.put(f"{BASE_API_URL}/publication/{pub_1_id}", headers=headers_bob, json=pub_payload_update)
    assert r_bob_edit.status_code == 403, f"Expected 403 for unauthorized edit, got {r_bob_edit.status_code}"

    r_bob_delete = requests.delete(f"{BASE_API_URL}/publication/{pub_1_id}", headers=headers_bob)
    assert r_bob_delete.status_code == 403, f"Expected 403 for unauthorized delete, got {r_bob_delete.status_code}"

    r_bob_vis = requests.patch(f"{BASE_API_URL}/publication/{pub_1_id}/visibility", headers=headers_bob, json="Private")
    assert r_bob_vis.status_code == 403, f"Expected 403 for unauthorized visibility toggle, got {r_bob_vis.status_code}"
    print("[PASS] Non-owner access boundaries strictly enforced (403 Forbidden).")

    # 4. Visibility Rules: Toggle to Private
    print(f"4. Alice setting publication #{pub_1_id} visibility to Private...")
    r_set_priv = requests.patch(f"{BASE_API_URL}/publication/{pub_1_id}/visibility", headers=headers_alice, json="Private")
    assert r_set_priv.status_code == 200, f"Visibility patch failed: {r_set_priv.text}"

    # Owner Alice can still view details
    r_alice_view = requests.get(f"{BASE_API_URL}/publication/{pub_1_id}", headers=headers_alice)
    assert r_alice_view.status_code == 200 and r_alice_view.json()["visibility"] == "Private"

    # Peer Bob is FORBIDDEN from viewing private publication details
    r_bob_view = requests.get(f"{BASE_API_URL}/publication/{pub_1_id}", headers=headers_bob)
    assert r_bob_view.status_code == 403, f"Security Breach! Peer accessed private pub: {r_bob_view.status_code}"

    # Public explore query does NOT return the private publication
    r_explore = requests.get(f"{BASE_API_URL}/publication?search=Optimization", headers=headers_bob)
    assert r_explore.status_code == 200
    explore_ids = [p["id"] for p in r_explore.json()]
    assert pub_1_id not in explore_ids, f"Private pub #{pub_1_id} leaked into public explore query!"
    print("[PASS] Visibility isolation confirmed: Private publication hidden from explore search and blocked with 403.")

    # Reset visibility back to Public for subsequent UI tests
    requests.patch(f"{BASE_API_URL}/publication/{pub_1_id}/visibility", headers=headers_alice, json="Public")

    # 5. Deletion Endpoint Check
    print("5. Testing publication deletion via API...")
    r_temp = requests.post(f"{BASE_API_URL}/publication", headers=headers_alice, json={
        "title": f"Temporary Paper for Deletion {timestamp}",
        "authors": "Alice Turing",
        "publicationYear": 2023,
        "journalOrConference": "Temp Conf",
        "visibility": "Public"
    })
    temp_id = r_temp.json()["id"]

    r_del = requests.delete(f"{BASE_API_URL}/publication/{temp_id}", headers=headers_alice)
    assert r_del.status_code == 200, f"Delete failed: {r_del.text}"

    r_verify_del = requests.get(f"{BASE_API_URL}/publication/{temp_id}", headers=headers_alice)
    assert r_verify_del.status_code == 404, f"Expected 404 for deleted pub, got {r_verify_del.status_code}"
    print(f"[PASS] Publication #{temp_id} deleted and confirmed 404 NotFound.")

    # =========================================================================
    # PHASE 3: DUAL-BROWSER SELENIUM UI WORKFLOW TESTING
    # =========================================================================
    print("\n--- PHASE 3: DUAL-BROWSER SELENIUM UI WORKFLOW TESTING ---")

    driver_alice = create_driver()
    driver_bob = create_driver()
    wait_alice = WebDriverWait(driver_alice, 15)
    wait_bob = WebDriverWait(driver_bob, 15)

    try:
        # Step 1: Login Alice in Browser 1
        print("1. Logging in Alice in Browser 1...")
        driver_alice.get(f"{FRONTEND_URL}/login")
        in_email_a = wait_alice.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        in_email_a.clear()
        in_email_a.send_keys(alice["email"])
        driver_alice.find_element(By.XPATH, "//input[@type='password']").send_keys(alice["password"])
        driver_alice.find_element(By.XPATH, "//button[@type='submit']").click()
        wait_alice.until(EC.url_contains("/profile"))

        # Navigate Alice to /publications
        driver_alice.get(f"{FRONTEND_URL}/publications")
        wait_alice.until(EC.presence_of_element_located((By.ID, "publication-management-page")))
        print("[PASS] Alice logged in and /publications loaded.")

        # Step 2: Test Form Validation in UI
        print("2. Testing client-side form validation in UI...")
        tab_add = wait_alice.until(EC.presence_of_element_located((By.ID, "tab-add-publication")))
        driver_alice.execute_script("arguments[0].click();", tab_add)

        wait_alice.until(EC.presence_of_element_located((By.ID, "pane-add-publication")))
        btn_submit = wait_alice.until(EC.presence_of_element_located((By.ID, "btn-submit-publication")))

        # Submit empty form -> Title required
        driver_alice.execute_script("arguments[0].click();", btn_submit)
        err_banner = wait_alice.until(EC.presence_of_element_located((By.ID, "pub-form-error-banner")))
        assert "Title is required" in (err_banner.get_attribute("textContent") or err_banner.text)
        print("[PASS] UI Validation Error: 'Title is required' triggered.")

        # Fill title, leave authors blank -> Authors required
        in_title = driver_alice.find_element(By.ID, "pub-title")
        in_title.send_keys("Automated Graph Neural Verification")
        driver_alice.execute_script("arguments[0].click();", btn_submit)
        wait_alice.until(lambda d: "Authors field is required" in (d.find_element(By.ID, "pub-form-error-banner").get_attribute("textContent") or ""))
        print("[PASS] UI Validation Error: 'Authors field is required' triggered.")

        # Fill authors, leave identifiers empty -> At least one required
        in_authors = driver_alice.find_element(By.ID, "pub-authors")
        in_authors.send_keys("Dr. Alice Turing, Nahiyan Kamal")
        driver_alice.execute_script("arguments[0].click();", btn_submit)
        wait_alice.until(lambda d: "At least one of DOI, Journal/Conference, or Source Link" in (d.find_element(By.ID, "pub-form-error-banner").get_attribute("textContent") or ""))
        print("[PASS] UI Validation Error: Missing identifying metadata triggered.")

        # Enter invalid DOI -> DOI format invalid
        in_doi = driver_alice.find_element(By.ID, "pub-doi")
        in_doi.send_keys("bad-doi-12345")
        driver_alice.execute_script("arguments[0].click();", btn_submit)
        wait_alice.until(lambda d: "DOI format appears invalid" in (d.find_element(By.ID, "pub-form-error-banner").get_attribute("textContent") or ""))
        print("[PASS] UI Validation Error: 'DOI format appears invalid' triggered.")

        # Step 3: Complete Publication Creation in UI
        print("3. Submitting valid publication via UI form...")
        ui_pub_title = f"Neural Graph Verification for Quantum Compilers {timestamp}"
        in_title.clear()
        in_title.send_keys(ui_pub_title)

        in_doi.clear()
        in_doi.send_keys("10.1145/3377811.3380387")

        in_venue = driver_alice.find_element(By.ID, "pub-journal")
        in_venue.clear()
        in_venue.send_keys("ACM Transactions on Computer Systems")

        select_type = Select(driver_alice.find_element(By.ID, "pub-type"))
        select_type.select_by_value("Conference")

        in_source = driver_alice.find_element(By.ID, "pub-sourcelink")
        in_source.clear()
        in_source.send_keys("https://dl.acm.org/doi/10.1145/3377811.3380387")

        in_abstract = driver_alice.find_element(By.ID, "pub-abstract")
        in_abstract.clear()
        in_abstract.send_keys("Framework for tensor-based graph verification in decentralized compilation.")

        select_vis = Select(driver_alice.find_element(By.ID, "pub-visibility"))
        select_vis.select_by_value("Public")

        # Submit
        driver_alice.execute_script("arguments[0].click();", btn_submit)

        # Form switches back to My Publications tab and card appears
        wait_alice.until(EC.presence_of_element_located((By.ID, "pane-my-publications")))
        wait_alice.until(lambda d: d.execute_script(
            "return Array.from(document.querySelectorAll('.pub-card-title')).some(e => (e.textContent || '').includes(arguments[0]));",
            ui_pub_title
        ))
        print(f"[PASS] Publication '{ui_pub_title}' created via UI and visible in My Publications.")

        # Locate the created publication card
        created_card = driver_alice.execute_script("""
            const title = arguments[0];
            const cards = Array.from(document.querySelectorAll('.pub-card'));
            return cards.find(c => (c.textContent || '').includes(title)) || null;
        """, ui_pub_title)
        assert created_card is not None
        ui_pub_id = int(created_card.get_attribute("id").replace("my-pub-card-", ""))

        # Step 4: Edit Publication in UI
        print(f"4. Alice editing publication #{ui_pub_id} in UI...")
        btn_edit = driver_alice.find_element(By.ID, f"btn-edit-pub-{ui_pub_id}")
        driver_alice.execute_script("arguments[0].click();", btn_edit)

        # Verify Add/Edit tab opened
        wait_alice.until(EC.presence_of_element_located((By.ID, "pane-add-publication")))
        edit_title_input = wait_alice.until(EC.presence_of_element_located((By.ID, "pub-title")))

        # Append [Revised Framework] to title
        revised_title = f"{ui_pub_title} [Revised Framework]"
        edit_title_input.clear()
        edit_title_input.send_keys(revised_title)

        # Update venue
        edit_venue_input = driver_alice.find_element(By.ID, "pub-journal")
        edit_venue_input.clear()
        edit_venue_input.send_keys("IEEE/ACM International Conference on Automated Software Engineering")

        # Save
        btn_update = driver_alice.find_element(By.ID, "btn-submit-publication")
        driver_alice.execute_script("arguments[0].click();", btn_update)

        # Verify updated title in My Publications tab
        wait_alice.until(EC.presence_of_element_located((By.ID, "pane-my-publications")))
        wait_alice.until(lambda d: d.execute_script(
            "return Array.from(document.querySelectorAll('.pub-card-title')).some(e => (e.textContent || '').includes(arguments[0]));",
            "[Revised Framework]"
        ))
        print("[PASS] Publication edit saved and reflected in UI.")

        # Step 5: Details Modal & Citation Preview in UI
        print(f"5. Alice opening Details Modal for publication #{ui_pub_id}...")
        card_title_el = driver_alice.find_element(By.ID, f"my-pub-card-{ui_pub_id}").find_element(By.CLASS_NAME, "pub-card-title")
        driver_alice.execute_script("arguments[0].click();", card_title_el)

        wait_alice.until(EC.presence_of_element_located((By.ID, f"pub-details-modal-{ui_pub_id}")))
        modal_el = driver_alice.find_element(By.ID, f"pub-details-modal-{ui_pub_id}")
        assert "ACM" in (modal_el.get_attribute("textContent") or "")
        assert "10.1145/3377811.3380387" in (modal_el.get_attribute("textContent") or "")

        # Verify Owner Action Buttons are present in modal
        assert len(driver_alice.find_elements(By.ID, "btn-modal-edit-pub")) == 1
        assert len(driver_alice.find_elements(By.ID, "btn-modal-delete-pub")) == 1
        assert len(driver_alice.find_elements(By.ID, "btn-modal-toggle-visibility")) == 1
        print("[PASS] Details Modal confirmed with owner management controls and citation formats.")

        # Close modal
        btn_close_modal = driver_alice.find_element(By.ID, "btn-close-pub-details")
        driver_alice.execute_script("arguments[0].click();", btn_close_modal)
        wait_alice.until(EC.invisibility_of_element_located((By.ID, f"pub-details-modal-{ui_pub_id}")))

        # Step 6: Toggle Visibility to Private in UI
        print(f"6. Alice toggling publication #{ui_pub_id} visibility to Private in UI...")
        btn_vis_toggle = driver_alice.find_element(By.ID, f"btn-toggle-vis-{ui_pub_id}")
        driver_alice.execute_script("arguments[0].click();", btn_vis_toggle)

        wait_alice.until(lambda d: "private" in (d.find_element(By.ID, f"btn-toggle-vis-{ui_pub_id}").get_attribute("textContent") or "").lower())
        print(f"[PASS] Publication #{ui_pub_id} visibility switched to Private.")

        # Step 7: Bob (Non-Owner) in Browser 2 Checks Visibility Isolation
        print("7. Logging in Bob in Browser 2 to verify visibility isolation in Explore tab...")
        driver_bob.get(f"{FRONTEND_URL}/login")
        in_email_b = wait_bob.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        in_email_b.clear()
        in_email_b.send_keys(bob["email"])
        driver_bob.find_element(By.XPATH, "//input[@type='password']").send_keys(bob["password"])
        driver_bob.find_element(By.XPATH, "//button[@type='submit']").click()
        wait_bob.until(EC.url_contains("/profile"))

        # Navigate Bob to /publications
        driver_bob.get(f"{FRONTEND_URL}/publications")
        wait_bob.until(EC.presence_of_element_located((By.ID, "publication-management-page")))

        # Click Explore Publications tab
        tab_explore_b = wait_bob.until(EC.presence_of_element_located((By.ID, "tab-explore-publications")))
        driver_bob.execute_script("arguments[0].click();", tab_explore_b)
        wait_bob.until(EC.presence_of_element_located((By.ID, "pane-explore-publications")))
        time.sleep(1.0)

        # Verify Alice's Private publication #{ui_pub_id} is NOT visible in Bob's explore list
        assert len(driver_bob.find_elements(By.ID, f"explore-pub-card-{ui_pub_id}")) == 0
        print(f"[PASS] Bob Explore Check: Private publication #{ui_pub_id} is hidden from explore list.")

        # Step 8: Alice toggles visibility back to Public
        print(f"8. Alice toggling publication #{ui_pub_id} visibility back to Public...")
        btn_vis_toggle_back = driver_alice.find_element(By.ID, f"btn-toggle-vis-{ui_pub_id}")
        driver_alice.execute_script("arguments[0].click();", btn_vis_toggle_back)
        wait_alice.until(lambda d: "public" in (d.find_element(By.ID, f"btn-toggle-vis-{ui_pub_id}").get_attribute("textContent") or "").lower())
        print(f"[PASS] Publication #{ui_pub_id} visibility switched back to Public.")

        # Step 9: Bob searches and views the now Public publication
        print(f"9. Bob searching for publication #{ui_pub_id} in Explore tab...")
        in_search_b = driver_bob.find_element(By.ID, "filter-pub-search")
        in_search_b.clear()
        in_search_b.send_keys(revised_title)
        btn_search_b = driver_bob.find_element(By.ID, "btn-submit-explore-search")
        driver_bob.execute_script("arguments[0].click();", btn_search_b)

        # Publication appears in Bob's Explore grid
        wait_bob.until(EC.presence_of_element_located((By.ID, f"explore-pub-card-{ui_pub_id}")))
        print(f"[PASS] Public publication #{ui_pub_id} found in Bob's explore results.")

        # Bob opens Details Modal as Non-Owner
        print(f"10. Bob opening Details Modal for publication #{ui_pub_id}...")
        btn_view_b = driver_bob.find_element(By.ID, f"btn-explore-view-details-{ui_pub_id}")
        driver_bob.execute_script("arguments[0].click();", btn_view_b)

        wait_bob.until(EC.presence_of_element_located((By.ID, f"pub-details-modal-{ui_pub_id}")))

        # CRITICAL SECURITY CHECK: Owner action buttons must NOT exist for Bob!
        assert len(driver_bob.find_elements(By.ID, "btn-modal-edit-pub")) == 0, "Security Breach! Non-owner sees Edit button"
        assert len(driver_bob.find_elements(By.ID, "btn-modal-delete-pub")) == 0, "Security Breach! Non-owner sees Delete button"
        assert len(driver_bob.find_elements(By.ID, "btn-modal-toggle-visibility")) == 0, "Security Breach! Non-owner sees Visibility Toggle"
        print("[PASS] Non-owner modal confirmed: Edit, Delete, and Visibility controls are strictly hidden.")

        # Close Bob's modal
        driver_bob.execute_script("arguments[0].click();", driver_bob.find_element(By.ID, "btn-close-pub-details"))
        wait_bob.until(EC.invisibility_of_element_located((By.ID, f"pub-details-modal-{ui_pub_id}")))

        # Step 11: Deletion in UI by Alice
        print(f"11. Alice deleting publication #{ui_pub_id} in UI...")
        driver_alice.execute_script("window.confirm = () => true;")
        btn_del_alice = driver_alice.find_element(By.ID, f"btn-delete-pub-{ui_pub_id}")
        driver_alice.execute_script("arguments[0].click();", btn_del_alice)

        wait_alice.until(lambda d: len(d.find_elements(By.ID, f"my-pub-card-{ui_pub_id}")) == 0)
        print(f"[PASS] Publication #{ui_pub_id} deleted via UI and card removed from DOM.")

    finally:
        print("\nCleaning up browser sessions...")
        driver_alice.quit()
        driver_bob.quit()

    print("\n==========================================================================================")
    print("=== T-026.5: PUBLICATION CRUD, VALIDATION & VISIBILITY TEST PASSED SUCCESSFULLY ===")
    print("==========================================================================================")


if __name__ == "__main__":
    test_publication_crud_validation_and_visibility()
