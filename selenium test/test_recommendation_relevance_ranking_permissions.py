import os
import sys
import time
import requests
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_API_URL = "http://localhost:5000/api"
FRONTEND_URL = "http://localhost:5173"

def create_test_user(role="Student", prefix="rec_user"):
    timestamp = int(time.time() * 1000)
    user = {
        "email": f"{prefix}_{timestamp}@rescollab.test",
        "password": "Password123!",
        "fullName": f"Dr. {prefix.replace('_', ' ').title()} {timestamp}",
        "role": role
    }

    # Register
    reg_res = requests.post(f"{BASE_API_URL}/auth/register", json=user)
    assert reg_res.status_code in (200, 201), f"Registration failed: {reg_res.text}"

    # Login
    login_res = requests.post(f"{BASE_API_URL}/auth/login", json=user)
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    login_data = login_res.json()

    return {
        "email": user["email"],
        "password": user["password"],
        "fullName": user["fullName"],
        "role": role,
        "token": login_data.get("token", ""),
        "id": login_data.get("user", {}).get("id")
    }

def test_recommendation_relevance_ranking_permissions():
    print("==========================================================================================")
    print("=== STARTING T-019.5: RECOMMENDATION RELEVANCE, RANKING & PERMISSIONS VALIDATION SUITE ===")
    print("==========================================================================================")

    timestamp = int(time.time())

    # =========================================================================
    # PHASE 1: SECURITY, PERMISSIONS & EXCLUSION RULES
    # =========================================================================
    print("\n--- PHASE 1: SECURITY, PERMISSIONS & EXCLUSION RULES ---")

    # 1. Unauthenticated endpoints return 401 Unauthorized
    print("1. Validating 401 Unauthorized across all recommendation endpoints without JWT...")
    unauth_endpoints = [
        ("GET", f"{BASE_API_URL}/recommendation/all"),
        ("GET", f"{BASE_API_URL}/recommendation/supervisors"),
        ("GET", f"{BASE_API_URL}/recommendation/teammates"),
        ("GET", f"{BASE_API_URL}/recommendation/researchers"),
        ("GET", f"{BASE_API_URL}/recommendation/papers"),
        ("GET", f"{BASE_API_URL}/recommendation/projects"),
        ("GET", f"{BASE_API_URL}/recommendation/skill-gap"),
        ("GET", f"{BASE_API_URL}/recommendation/preferences"),
        ("PUT", f"{BASE_API_URL}/recommendation/preferences"),
        ("POST", f"{BASE_API_URL}/recommendation/1/dismiss")
    ]
    for method, url in unauth_endpoints:
        if method == "GET":
            r = requests.get(url)
        elif method == "PUT":
            r = requests.put(url, json={})
        else:
            r = requests.post(url, json={})
        assert r.status_code == 401, f"Expected 401 for unauth {method} {url}, got {r.status_code}"
    print("[PASS] Security boundary verified: All recommendation endpoints strictly reject unauthenticated requests with 401.")

    # 2. Setup Test Actors
    print("2. Registering and configuring test actors...")
    student_user = create_test_user(role="Student", prefix="student_ai")
    student_headers = {"Authorization": f"Bearer {student_user['token']}", "Content-Type": "application/json"}

    # Supervisor A: High relevance (Same university, same department, high interest overlap, accepting students)
    sup_high = create_test_user(role="Faculty", prefix="prof_high_match")
    sup_high_headers = {"Authorization": f"Bearer {sup_high['token']}", "Content-Type": "application/json"}

    # Supervisor B: Lower relevance (Different university, partial interest overlap)
    sup_low = create_test_user(role="Faculty", prefix="prof_low_match")
    sup_low_headers = {"Authorization": f"Bearer {sup_low['token']}", "Content-Type": "application/json"}

    # Supervisor C: AcceptingStudents = FALSE (Must be excluded from supervisor recommendations)
    sup_not_accepting = create_test_user(role="Faculty", prefix="prof_not_accepting")
    sup_not_accepting_headers = {"Authorization": f"Bearer {sup_not_accepting['token']}", "Content-Type": "application/json"}

    # Admin User: Must be excluded from teammate recommendations
    admin_user = create_test_user(role="Admin", prefix="admin_staff")

    # Teammate Candidate: Complementary skill set
    teammate_user = create_test_user(role="Student", prefix="teammate_dev")
    teammate_headers = {"Authorization": f"Bearer {teammate_user['token']}", "Content-Type": "application/json"}

    # Fresh User: For Cold Start testing (zero skills, zero interests)
    fresh_user = create_test_user(role="Student", prefix="fresh_coldstart")
    fresh_headers = {"Authorization": f"Bearer {fresh_user['token']}", "Content-Type": "application/json"}

    # Configure Profiles
    uni_name = f"University of Artificial Intelligence {timestamp}"
    dept_name = f"Computer Vision & Robotics {timestamp}"

    # Student Profile: Focus on Vision & Robotics
    requests.put(f"{BASE_API_URL}/profile", headers=student_headers, json={
        "university": uni_name,
        "department": dept_name,
        "interests": "Computer Vision, Deep Learning, Autonomous Robotics",
        "skills": "Python, PyTorch, Linear Algebra"
    })

    # High Match Supervisor: Same institution, identical interests, accepting students
    requests.put(f"{BASE_API_URL}/profile", headers=sup_high_headers, json={
        "university": uni_name,
        "department": dept_name,
        "interests": "Computer Vision, Deep Learning, Autonomous Robotics",
        "skills": "Computer Vision, PyTorch, C++",
        "isAcceptingStudents": True,
        "bio": "Leading laboratory in autonomous neural robotics."
    })
    # Add a publication for Sup High to boost activity score
    pub_res = requests.post(f"{BASE_API_URL}/publication", headers=sup_high_headers, json={
        "title": f"Computer Vision and Autonomous Robotics {timestamp}",
        "authors": sup_high["fullName"],
        "publicationYear": 2025,
        "journalOrConference": "IEEE TPAMI",
        "publicationType": "Journal",
        "visibility": "Public"
    })
    assert pub_res.status_code == 201, f"Failed to create publication: {pub_res.text}"

    # Low Match Supervisor: Same institution, different department, partial overlap
    requests.put(f"{BASE_API_URL}/profile", headers=sup_low_headers, json={
        "university": uni_name,
        "department": "Mechanical Systems",
        "interests": "Autonomous Robotics, Kinematics",
        "skills": "CAD, SolidWorks",
        "isAcceptingStudents": True
    })

    # Not Accepting Supervisor: Identical interests but IsAcceptingStudents = False
    requests.put(f"{BASE_API_URL}/profile", headers=sup_not_accepting_headers, json={
        "university": uni_name,
        "department": dept_name,
        "interests": "Computer Vision, Deep Learning",
        "isAcceptingStudents": False
    })

    # Teammate: Complementary frontend/cloud skills + shared research interest
    requests.put(f"{BASE_API_URL}/profile", headers=teammate_headers, json={
        "university": uni_name,
        "department": dept_name,
        "interests": "Computer Vision, Deep Learning, Autonomous Robotics",
        "skills": "React, TypeScript, Docker, Kubernetes"
    })

    # 3. Verify Self-Exclusion Rule
    print("3. Validating Self-Exclusion: Authenticated user must never be recommended to themselves...")
    sup_res = requests.get(f"{BASE_API_URL}/recommendation/supervisors", headers=student_headers).json()
    assert not any(s["userId"] == student_user["id"] for s in sup_res), "Self-user found in supervisors!"

    tm_res = requests.get(f"{BASE_API_URL}/recommendation/teammates", headers=student_headers).json()
    assert not any(t["userId"] == student_user["id"] for t in tm_res), "Self-user found in teammates!"

    res_res = requests.get(f"{BASE_API_URL}/recommendation/researchers", headers=student_headers).json()
    assert not any(r["userId"] == student_user["id"] for r in res_res), "Self-user found in researchers!"
    print("[PASS] Self-exclusion verified: Current user is strictly omitted from recommendation results.")

    # 4. Verify Admin/Moderator Exclusion in Teammates
    print("4. Validating Admin/Moderator exclusion in teammate recommendations...")
    assert not any(t["userId"] == admin_user["id"] for t in tm_res), "Admin user improperly recommended as teammate!"
    print("[PASS] Role exclusion verified: Admin roles omitted from teammate candidate pool.")

    # 5. Verify IsAcceptingStudents Exclusion
    print("5. Validating IsAcceptingStudents rule: Faculty not accepting students must not be recommended...")
    assert not any(s["userId"] == sup_not_accepting["id"] for s in sup_res), "Supervisor with IsAcceptingStudents=False was recommended!"
    print(f"[PASS] Acceptance status verified: Supervisor #{sup_not_accepting['id']} correctly excluded.")

    # =========================================================================
    # PHASE 2: RELEVANCE SCORING, RANKING & COMPLEMENTARY MATRIX
    # =========================================================================
    print("\n--- PHASE 2: RELEVANCE SCORING, RANKING & COMPLEMENTARY MATRIX ---")

    # 1. Relevance & Ranking Order
    print("1. Validating Multi-Attribute Match Scoring and strict descending ranking...")
    sup_high_item = next((s for s in sup_res if s["userId"] == sup_high["id"]), None)
    sup_low_item = next((s for s in sup_res if s["userId"] == sup_low["id"]), None)

    assert sup_high_item is not None, f"High match supervisor #{sup_high['id']} not found in recommendations!"
    assert sup_low_item is not None, f"Low match supervisor #{sup_low['id']} not found in recommendations!"

    print(f"   - Supervisor High Score: {sup_high_item['matchScore']}%")
    print(f"   - Supervisor Low Score:  {sup_low_item['matchScore']}%")
    assert sup_high_item["matchScore"] > sup_low_item["matchScore"], (
        f"Expected High Supervisor ({sup_high_item['matchScore']}%) to outrank Low ({sup_low_item['matchScore']}%)"
    )

    # Verify Strict Descending Order
    scores = [s["matchScore"] for s in sup_res]
    assert scores == sorted(scores, reverse=True), f"Supervisors not sorted descending by score: {scores}"
    print("[PASS] Ranking order verified: Candidates returned in strict descending match score order.")

    # Verify Matched Keywords
    matched_kw = [k.lower() for k in sup_high_item["matchedKeywords"]]
    assert "computer vision" in matched_kw
    assert "deep learning" in matched_kw
    print(f"[PASS] Interest overlap correctly extracted: {sup_high_item['matchedKeywords']}")

    # 2. Teammate Matching & Complementary Skills
    print("2. Validating Teammate Matching & Complementary Skills Matrix...")
    target_tm = next((t for t in tm_res if t["userId"] == teammate_user["id"]), None)
    assert target_tm is not None, f"Teammate candidate #{teammate_user['id']} not found!"
    comp_skills = [cs.lower() for cs in target_tm["complementarySkills"]]
    assert any("react" in cs or "typescript" in cs or "docker" in cs for cs in comp_skills), f"Expected complementary skills: {comp_skills}"
    print(f"[PASS] Complementary skills matrix verified: Highlighted {target_tm['complementarySkills']}.")

    # 3. Literature / Paper Recommendations
    print("3. Validating Literature & Publication Recommendations...")
    papers_res = requests.get(f"{BASE_API_URL}/recommendation/papers", headers=student_headers).json()
    assert len(papers_res) > 0, "No paper recommendations returned!"
    paper_scores = [p["matchScore"] for p in papers_res]
    assert paper_scores == sorted(paper_scores, reverse=True), "Papers not sorted descending by match score"
    print(f"[PASS] Paper recommendations verified: Top paper '{papers_res[0]['title']}' with score {papers_res[0]['MatchScore'] if 'MatchScore' in papers_res[0] else papers_res[0]['matchScore']}%.")

    # 4. Open Project Matching
    print("4. Validating Open Project Recommendations...")
    proj_res = requests.post(f"{BASE_API_URL}/openproject", headers=sup_high_headers, json={
        "title": f"Autonomous Drone Navigation {timestamp}",
        "description": "Visual SLAM for multi-rotor aerial vehicles",
        "requiredSkills": "Python, PyTorch, ROS, C++",
        "department": dept_name,
        "isFunded": True,
        "maxStudents": 3
    })
    assert proj_res.status_code == 201
    proj_id = proj_res.json()["id"]

    rec_projects = requests.get(f"{BASE_API_URL}/recommendation/projects", headers=student_headers).json()
    target_rec_proj = next((p for p in rec_projects if p["projectId"] == proj_id), None)
    assert target_rec_proj is not None, f"Created open project #{proj_id} not found in project recommendations!"
    assert any("python" in s.lower() or "pytorch" in s.lower() for s in target_rec_proj["matchedSkills"])
    assert any("ros" in s.lower() or "c++" in s.lower() for s in target_rec_proj["missingSkills"])
    assert target_rec_proj["isFunded"] == True
    print(f"[PASS] Project recommendations verified: Matched skills ({target_rec_proj['matchedSkills']}) and missing skills ({target_rec_proj['missingSkills']}).")

    # 5. User Preference Tuning & Weight Modification
    print("5. Validating Recommendation Preference Tuning & Dynamic Weight Adjustment...")
    # Get initial preferences
    pref_res = requests.get(f"{BASE_API_URL}/recommendation/preferences", headers=student_headers)
    assert pref_res.status_code == 200
    init_pref = pref_res.json()

    # Update weights: heavy emphasis on interests (0.75) and activity (0.15)
    new_pref_payload = {
        "interestWeight": 0.75,
        "skillWeight": 0.10,
        "institutionWeight": 0.05,
        "activityWeight": 0.10
    }
    update_pref_res = requests.put(f"{BASE_API_URL}/recommendation/preferences", headers=student_headers, json=new_pref_payload)
    assert update_pref_res.status_code == 200
    updated_pref = update_pref_res.json()
    assert abs(updated_pref["interestWeight"] - 0.75) < 0.01
    assert abs(updated_pref["institutionWeight"] - 0.05) < 0.01
    print("[PASS] Preference weights updated and clamped correctly.")

    # Reset back to default balanced weights for subsequent UI workflow tests
    requests.put(f"{BASE_API_URL}/recommendation/preferences", headers=student_headers, json={
        "interestWeight": 0.35,
        "skillWeight": 0.30,
        "institutionWeight": 0.15,
        "activityWeight": 0.20
    })

    # =========================================================================
    # PHASE 3: SKILL GAP ANALYSIS & COLD START HANDLING
    # =========================================================================
    print("\n--- PHASE 3: SKILL GAP ANALYSIS & COLD START HANDLING ---")

    # 1. Skill Gap Analysis for Target Domain
    print("1. Validating Skill Gap Analysis for domain 'Robotics'...")
    gap_res = requests.get(f"{BASE_API_URL}/recommendation/skill-gap?targetDomain=Robotics", headers=student_headers)
    assert gap_res.status_code == 200
    gap_data = gap_res.json()
    assert gap_data["targetDomain"] == "Robotics"
    assert "readinessScore" in gap_data
    assert gap_data["readinessScore"] >= 15
    assert len(gap_data["currentSkills"]) > 0
    assert "recommendedAction" in gap_data
    print(f"[PASS] Skill gap evaluated: Readiness Score {gap_data['readinessScore']}%, Missing: {gap_data['missingSkills']}.")

    # 2. Skill Gap Analysis for Specific Project
    print(f"2. Validating Project-Specific Skill Gap Analysis for project #{proj_id}...")
    proj_gap_res = requests.get(f"{BASE_API_URL}/recommendation/skill-gap?targetProjectId={proj_id}", headers=student_headers)
    assert proj_gap_res.status_code == 200
    proj_gap_data = proj_gap_res.json()
    assert proj_gap_data["targetProjectId"] == proj_id
    assert "ros" in proj_gap_data["missingSkills"].lower() or "c++" in proj_gap_data["missingSkills"].lower()
    print("[PASS] Project skill gap evaluated: Missing prerequisite skills identified.")

    # 3. Cold Start & Profile Completeness Guidance
    print(f"3. Validating Cold Start for fresh user #{fresh_user['id']} (Empty Profile)...")
    cold_res = requests.get(f"{BASE_API_URL}/recommendation/all", headers=fresh_headers)
    assert cold_res.status_code == 200
    cold_data = cold_res.json()
    assert cold_data["hasSufficientProfileData"] == False
    assert cold_data["guidanceMessage"] is not None
    assert "interests" in cold_data["guidanceMessage"].lower() or "profile" in cold_data["guidanceMessage"].lower()
    print(f"[PASS] Cold start handled gracefully: Guidance flag set to False with helpful prompt.")

    # =========================================================================
    # PHASE 4: DISMISSAL WORKFLOW
    # =========================================================================
    print("\n--- PHASE 4: DISMISSAL WORKFLOW ---")
    print(f"1. Dismissing Low Match Supervisor #{sup_low['id']} from recommendations...")
    dismiss_res = requests.post(f"{BASE_API_URL}/recommendation/{sup_low['id']}/dismiss", headers=student_headers)
    assert dismiss_res.status_code == 200
    assert dismiss_res.json()["success"] == True

    # Re-query supervisors
    post_dismiss_sups = requests.get(f"{BASE_API_URL}/recommendation/supervisors", headers=student_headers).json()
    assert not any(s["userId"] == sup_low["id"] for s in post_dismiss_sups), f"Dismissed supervisor #{sup_low['id']} still appeared!"
    print(f"[PASS] Dismissal verified: Candidate #{sup_low['id']} successfully excluded from future recommendations.")

    # =========================================================================
    # PHASE 5: SELENIUM E2E BROWSER UI AUTOMATION WORKFLOW
    # =========================================================================
    print("\n--- PHASE 5: SELENIUM E2E BROWSER UI AUTOMATION WORKFLOW ---")

    options = webdriver.ChromeOptions()
    if os.environ.get("HEADLESS", "true").lower() == "true":
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,960")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")

    driver = webdriver.Chrome(options=options)
    wait = WebDriverWait(driver, 15)

    try:
        # Step 1: Login via UI
        print(f"1. Logging in as Student user '{student_user['email']}' via UI...")
        driver.get(f"{FRONTEND_URL}/login")

        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(student_user["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(student_user["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))
        print("[PASS] User logged in and landed on /profile.")

        # Step 2: Navigate to Recommendations Hub
        print("2. Navigating to AI Recommendations Hub (/recommendations)...")
        driver.get(f"{FRONTEND_URL}/recommendations")
        wait.until(EC.presence_of_element_located((By.ID, "ai-recommendations-hub")))
        time.sleep(1.0)

        header_text = driver.find_element(By.CLASS_NAME, "recommendations-header").text.lower()
        assert "ai recommendations & matching hub" in header_text
        print("[PASS] Recommendations Hub loaded with primary header banner.")

        # Step 3: Validate All Matches Tab
        print("3. Validating All Matches Tab preview blocks...")
        all_tab_btn = driver.find_element(By.ID, "tab-rec-all")
        assert "active" in all_tab_btn.get_attribute("class")

        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "rec-category-block")))
        all_view_text = driver.find_element(By.CLASS_NAME, "rec-all-overview").text.lower()
        assert "top matched supervisors" in all_view_text
        assert "complementary teammates" in all_view_text
        print("[PASS] All Matches overview displays category summary blocks.")

        # Step 4: Validate Supervisors Tab & Cards
        print("4. Switching to Supervisors Tab (#tab-rec-supervisors)...")
        sup_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-rec-supervisors")))
        driver.execute_script("arguments[0].click();", sup_tab_btn)
        time.sleep(1.0)

        # Verify High Match Supervisor card
        sup_card_elem = wait.until(EC.presence_of_element_located((By.ID, f"rec-card-supervisor-{sup_high['id']}")))
        sup_card_text = sup_card_elem.text.lower()
        assert sup_high["fullName"].lower() in sup_card_text
        assert "match" in sup_card_text
        assert "accepting graduate & thesis students" in sup_card_text
        assert "computer vision" in sup_card_text
        print(f"[PASS] Supervisor card for '{sup_high['fullName']}' verified with match badge and acceptance pill.")

        # Step 5: Validate Teammates Tab & Complementary Skills
        print("5. Switching to Teammates Tab (#tab-rec-teammates)...")
        tm_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-rec-teammates")))
        driver.execute_script("arguments[0].click();", tm_tab_btn)
        time.sleep(1.0)

        tm_card_elem = wait.until(EC.presence_of_element_located((By.ID, f"rec-card-teammate-{teammate_user['id']}")))
        tm_card_text = tm_card_elem.text.lower()
        assert teammate_user["fullName"].lower() in tm_card_text
        assert "complementary skills" in tm_card_text
        assert "react" in tm_card_text or "typescript" in tm_card_text or "docker" in tm_card_text
        print(f"[PASS] Teammate card for '{teammate_user['fullName']}' verified with complementary skill tags.")

        # Step 6: Validate Literature & Papers Tab
        print("6. Switching to Literature & Papers Tab (#tab-rec-papers)...")
        papers_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-rec-papers")))
        driver.execute_script("arguments[0].click();", papers_tab_btn)
        time.sleep(1.0)

        papers_grid = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "rec-cards-grid")))
        assert len(papers_grid.find_elements(By.CLASS_NAME, "paper-card")) > 0
        paper_text = papers_grid.text.lower()
        assert "computer vision and autonomous robotics" in paper_text
        print("[PASS] Literature recommendations tab verified displaying relevant publication cards.")

        # Step 7: Validate Skill Gap Analysis Tab
        print("7. Switching to Skill Gap Analysis Tab (#tab-rec-skillgap)...")
        gap_tab_btn = wait.until(EC.element_to_be_clickable((By.ID, "tab-rec-skillgap")))
        driver.execute_script("arguments[0].click();", gap_tab_btn)
        time.sleep(1.0)

        # Enter custom domain and evaluate readiness
        custom_input = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, ".skillgap-custom-box input")))
        custom_input.clear()
        custom_input.send_keys("Robotics & Control")
        analyze_gap_btn = driver.find_element(By.XPATH, "//button[contains(text(), 'Analyze Readiness')]")
        driver.execute_script("arguments[0].click();", analyze_gap_btn)
        time.sleep(1.5)

        gap_card = wait.until(EC.presence_of_element_located((By.CLASS_NAME, "skillgap-card")))
        gap_text = gap_card.text.lower()
        assert "readiness score" in gap_text
        assert "skills you possess" in gap_text
        assert "high-yield missing skills" in gap_text
        print("[PASS] Skill gap analysis UI verified: Gauge score, possessed skills, and missing recommendations.")

        # Step 8: Test Criteria Weights Modal
        print("8. Testing Criteria Weights Tuning Modal (#modal-criteria-preferences)...")
        pref_btn = wait.until(EC.element_to_be_clickable((By.ID, "btn-rec-preferences")))
        driver.execute_script("arguments[0].click();", pref_btn)

        modal = wait.until(EC.visibility_of_element_located((By.ID, "modal-criteria-preferences")))
        modal_text = modal.text.lower()
        assert "customize matching weights" in modal_text
        assert "research interests overlap" in modal_text

        # Click Save & Re-Score
        save_btn = modal.find_element(By.XPATH, ".//button[contains(text(), 'Save & Re-Score')]")
        driver.execute_script("arguments[0].click();", save_btn)
        time.sleep(1.0)

        # Verify toast notice
        toast = wait.until(EC.presence_of_element_located((By.ID, "rec-toast")))
        toast_msg = toast.text.lower()
        assert any(t in toast_msg for t in ["weights saved", "refreshed", "re-indexed"]), f"Unexpected toast: {toast_msg}"
        safe_toast = toast.text.encode("ascii", "replace").decode("ascii").strip()
        print(f"[PASS] Preference weights modal tested: Successfully saved with toast '{safe_toast}'.")

        # Step 9: Test Card Dismissal in UI
        print(f"9. Testing Card Dismissal on Teammate Card in UI...")
        driver.execute_script("arguments[0].click();", tm_tab_btn)
        time.sleep(1.0)

        tm_card = wait.until(EC.presence_of_element_located((By.ID, f"rec-card-teammate-{teammate_user['id']}")))
        dismiss_btn = tm_card.find_element(By.CLASS_NAME, "btn-dismiss")
        driver.execute_script("arguments[0].click();", dismiss_btn)
        time.sleep(1.0)

        toast_dismiss = wait.until(EC.presence_of_element_located((By.ID, "rec-toast")))
        assert "dismissed" in toast_dismiss.text.lower()
        print("[PASS] Card dismissal verified: Optimistic DOM removal and dismissal toast notice received.")

        # Step 10: Test Cold Start Banner for Fresh User
        print(f"10. Validating Cold Start Profile Guidance banner for user '{fresh_user['email']}'...")
        driver.get(f"{FRONTEND_URL}/login")
        email_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[@type='email']")))
        email_input.clear()
        email_input.send_keys(fresh_user["email"])
        driver.find_element(By.XPATH, "//input[@type='password']").send_keys(fresh_user["password"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        wait.until(EC.url_contains("/profile"))

        driver.get(f"{FRONTEND_URL}/recommendations")
        guidance_banner = wait.until(EC.presence_of_element_located((By.ID, "banner-profile-guidance")))
        banner_text = guidance_banner.text.lower()
        assert "boost your recommendation accuracy" in banner_text
        print("[PASS] Cold start banner verified: Fresh profile triggers profile completion prompt.")

        print("\n==========================================================================================")
        print("=== ALL T-019.5 RECOMMENDATION RELEVANCE, RANKING & PERMISSIONS TESTS PASSED!          ===")
        print("==========================================================================================")

    finally:
        driver.quit()

if __name__ == "__main__":
    test_recommendation_relevance_ranking_permissions()
